"""DSSE Co-Working Space Booking Portal — FastAPI backend."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import csv
import io
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, decode_token, extract_token,
    make_get_current_user, gen_reset_token,
)
from seed import run_seed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dsse")

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- App ----------
app = FastAPI(title="DSSE Booking Portal")
api = APIRouter(prefix="/api")

get_current_user = make_get_current_user(lambda: db)

ALL_ADMIN_ROLES = {"super_admin", "admin"}
ROLES = ["super_admin", "admin", "team_lead", "member", "applicant"]


def require_active(user: dict = Depends(get_current_user)) -> dict:
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account not active")
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ALL_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    return user


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    first_name: str
    last_name: str
    roll_number: Optional[str] = ""
    phone: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class TeamIn(BaseModel):
    name: str
    program: Literal["ideas_l1", "ideas_l2", "groww", "individual"]
    priority_tier: int = 3
    active_from: str  # YYYY-MM-DD
    active_until: str
    team_lead_id: Optional[str] = None


class UserCreateAdmin(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: Literal["super_admin", "admin", "team_lead", "member"]
    initial_password: str = Field(min_length=6)
    roll_number: Optional[str] = ""
    phone: Optional[str] = ""
    team_id: Optional[str] = None


class UserStatusUpdate(BaseModel):
    status: Literal["active", "suspended", "inactive", "pending"]


class ApprovalIn(BaseModel):
    team_id: Optional[str] = None
    role: Optional[Literal["team_lead", "member"]] = "member"


class RejectIn(BaseModel):
    reason: str


class BookingIn(BaseModel):
    seat_id: int
    start_time: str   # ISO with TZ
    end_time: str
    team_id: Optional[str] = None  # if user belongs to multiple teams


class BookingApprove(BaseModel):
    pass


class ViolationIn(BaseModel):
    user_id: str
    team_id: Optional[str] = None
    booking_id: Optional[str] = None
    category: str  # no_show, cleanliness, damage, conduct, time_overrun, other
    severity: Literal["tier_1", "tier_2", "tier_3"]
    description: str


class ConfigUpdate(BaseModel):
    working_hours_start: Optional[int] = None
    working_hours_end: Optional[int] = None
    daily_cap_hours: Optional[int] = None
    weekly_cap_hours: Optional[int] = None
    lead_time_hours: Optional[int] = None
    booking_window_days: Optional[int] = None
    max_booking_hours: Optional[int] = None
    min_booking_hours: Optional[int] = None
    auto_approve_programs: Optional[List[str]] = None


class GuidelineIn(BaseModel):
    content_md: str
    activate: bool = False


class GuidelinesAccept(BaseModel):
    guidelines_id: str


class SeatUpdate(BaseModel):
    status: Optional[Literal["available", "maintenance"]] = None
    zone: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class NotificationCreate(BaseModel):
    user_id: str
    title: str
    body: str
    type: str = "info"


# ---------- Helpers ----------
async def get_config() -> dict:
    cfg = await db.configuration.find_one({"id": "default"}, {"_id": 0})
    return cfg


def parse_iso(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def iso_week(d: date):
    return d.isocalendar()[:2]


async def user_team(user_id: str, team_id: Optional[str] = None) -> Optional[dict]:
    """Return the user's active team membership doc + team."""
    q = {"user_id": user_id, "left_at": None}
    if team_id:
        q["team_id"] = team_id
    membership = await db.team_memberships.find_one(q, {"_id": 0})
    if not membership:
        return None
    team = await db.teams.find_one({"id": membership["team_id"]}, {"_id": 0})
    return {"membership": membership, "team": team}


async def notify(user_id: str, title: str, body: str, ntype: str = "info"):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "body": body,
        "type": ntype,
        "read": False,
        "created_at": utcnow_iso(),
    })


# ---------- Booking rules ----------
async def validate_booking(user: dict, payload: BookingIn) -> tuple[dict, dict]:
    """Returns (config, team) on success, raises HTTPException otherwise."""
    cfg = await get_config()

    if user.get("status") != "active":
        raise HTTPException(400, "Your account is not active.")

    # Resolve team
    membership = await user_team(user["id"], payload.team_id)
    if not membership or not membership["team"]:
        raise HTTPException(400, "You are not a member of any active team. Contact admin.")
    team = membership["team"]
    today = date.today()
    af = date.fromisoformat(team["active_from"])
    au = date.fromisoformat(team["active_until"])
    if not (af <= today <= au):
        raise HTTPException(400, "Your team is not active for the current period.")

    # Times
    start = parse_iso(payload.start_time)
    end = parse_iso(payload.end_time)
    if end <= start:
        raise HTTPException(400, "End time must be after start time.")
    if start.minute != 0 or end.minute != 0:
        raise HTTPException(400, "Bookings must be on the hour.")

    duration_h = int((end - start).total_seconds() // 3600)
    if duration_h < cfg["min_booking_hours"]:
        raise HTTPException(400, f"Minimum booking is {cfg['min_booking_hours']} hour(s).")
    if duration_h > cfg["max_booking_hours"]:
        raise HTTPException(400, f"Maximum booking is {cfg['max_booking_hours']} hours per slot.")

    # Working hours
    if start.hour < cfg["working_hours_start"] or end.hour > cfg["working_hours_end"]:
        raise HTTPException(400, f"Bookings allowed only between {cfg['working_hours_start']}:00 and {cfg['working_hours_end']}:00.")

    # Lead time
    now = datetime.now(timezone.utc)
    if start < now + timedelta(hours=cfg["lead_time_hours"]):
        raise HTTPException(400, f"Bookings must be at least {cfg['lead_time_hours']} hour(s) in advance.")

    # Booking window
    if start.date() > today + timedelta(days=cfg["booking_window_days"]):
        raise HTTPException(400, f"Cannot book more than {cfg['booking_window_days']} days ahead.")

    # Seat existence + maintenance
    seat = await db.seats.find_one({"id": payload.seat_id}, {"_id": 0})
    if not seat:
        raise HTTPException(404, "Seat not found.")
    if seat["status"] == "maintenance":
        raise HTTPException(400, "Seat is under maintenance.")

    # Overlap on same seat (pending/approved)
    overlap = await db.bookings.find_one({
        "seat_id": payload.seat_id,
        "status": {"$in": ["pending", "approved"]},
        "start_time": {"$lt": end.isoformat()},
        "end_time": {"$gt": start.isoformat()},
    })
    if overlap:
        raise HTTPException(409, "This seat is already booked for the selected time.")

    # Daily cap (team)
    day_start = datetime.combine(start.date(), datetime.min.time(), tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    daily_total = 0
    cur = db.bookings.find({
        "team_id": team["id"],
        "status": {"$in": ["pending", "approved"]},
        "start_time": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()},
    }, {"_id": 0, "start_time": 1, "end_time": 1})
    async for b in cur:
        daily_total += int((parse_iso(b["end_time"]) - parse_iso(b["start_time"])).total_seconds() // 3600)
    if daily_total + duration_h > cfg["daily_cap_hours"]:
        remaining = max(0, cfg["daily_cap_hours"] - daily_total)
        raise HTTPException(400, f"Daily cap reached. Your team has used {daily_total} of {cfg['daily_cap_hours']} hours today. You can book at most {remaining} more.")

    # Weekly cap (team) — ISO week
    week_start = (start.date() - timedelta(days=start.weekday()))
    week_end = week_start + timedelta(days=7)
    week_start_dt = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
    week_end_dt = datetime.combine(week_end, datetime.min.time(), tzinfo=timezone.utc)
    weekly_total = 0
    cur = db.bookings.find({
        "team_id": team["id"],
        "status": {"$in": ["pending", "approved"]},
        "start_time": {"$gte": week_start_dt.isoformat(), "$lt": week_end_dt.isoformat()},
    }, {"_id": 0, "start_time": 1, "end_time": 1})
    async for b in cur:
        weekly_total += int((parse_iso(b["end_time"]) - parse_iso(b["start_time"])).total_seconds() // 3600)
    if weekly_total + duration_h > cfg["weekly_cap_hours"]:
        remaining = max(0, cfg["weekly_cap_hours"] - weekly_total)
        raise HTTPException(400, f"Weekly cap reached. Your team has used {weekly_total} of {cfg['weekly_cap_hours']} hours this week. You can book at most {remaining} more.")

    return cfg, team


# ===================== AUTH =====================
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email is already registered.")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "roll_number": payload.roll_number or "",
        "phone": payload.phone or "",
        "role": "applicant",
        "status": "pending",
        "guidelines_accepted_version": None,
        "created_at": utcnow_iso(),
        "updated_at": utcnow_iso(),
    }
    await db.users.insert_one(doc)
    # Notify all admins
    async for adm in db.users.find({"role": {"$in": list(ALL_ADMIN_ROLES)}, "status": "active"}, {"_id": 0, "id": 1}):
        await notify(adm["id"], "New signup awaiting approval", f"{payload.first_name} {payload.last_name} ({email}) has signed up.", "approval")
    user = {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}
    return {"user": user, "message": "Signup received. You will be notified when approved."}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password.")
    if user.get("status") == "suspended":
        raise HTTPException(403, "Your account has been suspended.")
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"user": user, "token": access}


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    # Attach team info if any
    team_info = await user_team(user["id"])
    return {"user": user, "team": team_info["team"] if team_info else None}


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(401, "No refresh token")
    try:
        payload = decode_token(rt)
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
    except Exception:
        raise HTTPException(401, "Invalid refresh token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    access = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    # Don't leak whether email exists
    if user:
        token = gen_reset_token()
        await db.password_reset_tokens.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "token": token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "used": False,
            "created_at": utcnow_iso(),
        })
        logger.info(f"[PASSWORD RESET] Link for {email}: /reset-password?token={token}")
        return {"ok": True, "reset_token": token}  # in dev, return for testing
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(payload: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": payload.token, "used": False}, {"_id": 0})
    if not rec:
        raise HTTPException(400, "Invalid or used token.")
    if parse_iso(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Token expired.")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": utcnow_iso()}})
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"ok": True}


@api.post("/auth/accept-guidelines")
async def accept_guidelines(payload: GuidelinesAccept, user: dict = Depends(get_current_user)):
    g = await db.guidelines.find_one({"id": payload.guidelines_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Guidelines not found")
    await db.users.update_one({"id": user["id"]}, {"$set": {"guidelines_accepted_version": g["version"]}})
    await db.guideline_acceptances.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "guidelines_id": g["id"],
        "version": g["version"],
        "accepted_at": utcnow_iso(),
    })
    return {"ok": True}


# ===================== PROFILE =====================
@api.put("/profile")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        update["updated_at"] = utcnow_iso()
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    new_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return new_user


@api.post("/profile/change-password")
async def change_password(payload: PasswordChange, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(payload.current_password, full["password_hash"]):
        raise HTTPException(400, "Current password incorrect.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": utcnow_iso()}})
    return {"ok": True}


# ===================== USERS (admin) =====================
@api.get("/admin/users")
async def list_users(role: Optional[str] = None, status: Optional[str] = None, _: dict = Depends(require_admin)):
    q = {}
    if role:
        q["role"] = role
    if status:
        q["status"] = status
    out = []
    async for u in db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1):
        # attach team
        team_info = await user_team(u["id"])
        u["team"] = team_info["team"] if team_info else None
        out.append(u)
    return out


@api.post("/admin/users")
async def admin_create_user(payload: UserCreateAdmin, _: dict = Depends(require_admin)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid,
        "email": email,
        "password_hash": hash_password(payload.initial_password),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "roll_number": payload.roll_number or "",
        "phone": payload.phone or "",
        "role": payload.role,
        "status": "active",
        "guidelines_accepted_version": None,
        "created_at": utcnow_iso(),
        "updated_at": utcnow_iso(),
    })
    if payload.team_id:
        await db.team_memberships.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "team_id": payload.team_id,
            "role_in_team": payload.role,
            "joined_at": utcnow_iso(),
            "left_at": None,
        })
    await notify(uid, "Welcome to DSSE Booking", f"Your account has been created. Initial password: {payload.initial_password}", "info")
    return {"ok": True, "id": uid}


@api.post("/admin/users/{user_id}/approve")
async def approve_applicant(user_id: str, payload: ApprovalIn, admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(404, "User not found")
    new_role = payload.role or "member"
    await db.users.update_one({"id": user_id}, {"$set": {"role": new_role, "status": "active", "updated_at": utcnow_iso()}})
    if payload.team_id:
        await db.team_memberships.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "team_id": payload.team_id,
            "role_in_team": new_role,
            "joined_at": utcnow_iso(),
            "left_at": None,
        })
    await notify(user_id, "Account approved", "You're in. You can now book seats.", "success")
    return {"ok": True}


@api.post("/admin/users/{user_id}/reject")
async def reject_applicant(user_id: str, payload: RejectIn, _: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"status": "inactive", "rejection_reason": payload.reason, "updated_at": utcnow_iso()}})
    await notify(user_id, "Signup rejected", payload.reason, "warning")
    return {"ok": True}


@api.put("/admin/users/{user_id}/status")
async def change_user_status(user_id: str, payload: UserStatusUpdate, _: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"status": payload.status, "updated_at": utcnow_iso()}})
    return {"ok": True}


# ===================== TEAMS =====================
@api.get("/admin/teams")
async def list_teams(_: dict = Depends(require_admin)):
    out = []
    async for t in db.teams.find({}, {"_id": 0}).sort("name", 1):
        members = await db.team_memberships.count_documents({"team_id": t["id"], "left_at": None})
        t["member_count"] = members
        out.append(t)
    return out


@api.post("/admin/teams")
async def create_team(payload: TeamIn, _: dict = Depends(require_admin)):
    if await db.teams.find_one({"name": payload.name}):
        raise HTTPException(400, "Team name already exists")
    tid = str(uuid.uuid4())
    await db.teams.insert_one({
        "id": tid,
        "name": payload.name,
        "program": payload.program,
        "priority_tier": payload.priority_tier,
        "active_from": payload.active_from,
        "active_until": payload.active_until,
        "team_lead_id": payload.team_lead_id,
        "status": "active",
        "created_at": utcnow_iso(),
    })
    return {"ok": True, "id": tid}


@api.get("/teams/{team_id}")
async def team_detail(team_id: str, user: dict = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(404, "Team not found")
    members = []
    async for m in db.team_memberships.find({"team_id": team_id, "left_at": None}, {"_id": 0}):
        u = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "password_hash": 0})
        if u:
            members.append({**u, "role_in_team": m["role_in_team"]})
    upcoming = []
    async for b in db.bookings.find({"team_id": team_id, "status": {"$in": ["pending", "approved"]}, "start_time": {"$gte": utcnow_iso()}}, {"_id": 0}).sort("start_time", 1).limit(20):
        upcoming.append(b)
    # Weekly usage
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_start_dt = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
    weekly_hours = 0
    async for b in db.bookings.find({"team_id": team_id, "status": {"$in": ["pending", "approved"]}, "start_time": {"$gte": week_start_dt.isoformat()}}, {"_id": 0}):
        weekly_hours += int((parse_iso(b["end_time"]) - parse_iso(b["start_time"])).total_seconds() // 3600)
    return {"team": team, "members": members, "upcoming": upcoming, "weekly_hours": weekly_hours}


@api.post("/admin/teams/import")
async def import_teams_csv(file: UploadFile = File(...), dry_run: bool = True, _: dict = Depends(require_admin)):
    """CSV columns: name, program, priority_tier, active_from, active_until"""
    content = (await file.read()).decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    preview = []
    errors = []
    valid_programs = {"ideas_l1", "ideas_l2", "groww", "individual"}
    for i, row in enumerate(rows, 1):
        try:
            name = row["name"].strip()
            program = row["program"].strip()
            if program not in valid_programs:
                errors.append(f"Row {i}: invalid program '{program}'")
                continue
            tier = int(row.get("priority_tier", 3))
            af = row["active_from"].strip()
            au = row["active_until"].strip()
            date.fromisoformat(af)
            date.fromisoformat(au)
            preview.append({"name": name, "program": program, "priority_tier": tier, "active_from": af, "active_until": au})
        except Exception as e:
            errors.append(f"Row {i}: {e}")
    if dry_run:
        return {"preview": preview, "errors": errors, "would_create": len(preview)}
    created = 0
    for r in preview:
        if await db.teams.find_one({"name": r["name"]}):
            continue
        await db.teams.insert_one({
            "id": str(uuid.uuid4()),
            **r,
            "team_lead_id": None,
            "status": "active",
            "created_at": utcnow_iso(),
        })
        created += 1
    return {"preview": preview, "errors": errors, "created": created}


@api.post("/admin/teams/{team_id}/add-member")
async def add_team_member(team_id: str, payload: dict, _: dict = Depends(require_admin)):
    user_id = payload.get("user_id")
    role_in_team = payload.get("role_in_team", "member")
    if not user_id:
        raise HTTPException(400, "user_id required")
    existing = await db.team_memberships.find_one({"user_id": user_id, "team_id": team_id, "left_at": None})
    if existing:
        raise HTTPException(400, "User already in team")
    await db.team_memberships.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "team_id": team_id,
        "role_in_team": role_in_team,
        "joined_at": utcnow_iso(),
        "left_at": None,
    })
    return {"ok": True}


# ===================== SEATS =====================
@api.get("/seats")
async def list_seats(_: dict = Depends(get_current_user)):
    out = []
    async for s in db.seats.find({}, {"_id": 0}).sort("id", 1):
        out.append(s)
    return out


@api.put("/admin/seats/{seat_id}")
async def update_seat(seat_id: int, payload: SeatUpdate, _: dict = Depends(require_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.seats.update_one({"id": seat_id}, {"$set": update})
    return {"ok": True}


@api.get("/seats/{seat_id}/day")
async def seat_day(seat_id: int, day: str, user: dict = Depends(get_current_user)):
    """Return all bookings for a seat on a given day."""
    d = date.fromisoformat(day)
    start = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    out = []
    async for b in db.bookings.find({
        "seat_id": seat_id,
        "status": {"$in": ["pending", "approved"]},
        "start_time": {"$gte": start.isoformat(), "$lt": end.isoformat()},
    }, {"_id": 0}).sort("start_time", 1):
        out.append(b)
    return out


# ===================== BOOKINGS =====================
@api.get("/bookings/day-overview")
async def day_overview(day: str, user: dict = Depends(get_current_user)):
    """All bookings on the given day across all seats — for floor/timeline view."""
    d = date.fromisoformat(day)
    start = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    out = []
    async for b in db.bookings.find({
        "status": {"$in": ["pending", "approved"]},
        "start_time": {"$gte": start.isoformat(), "$lt": end.isoformat()},
    }, {"_id": 0}).sort("start_time", 1):
        out.append(b)
    return out


@api.post("/bookings")
async def create_booking(payload: BookingIn, user: dict = Depends(require_active)):
    cfg, team = await validate_booking(user, payload)
    bid = str(uuid.uuid4())
    auto_approve = team["program"] in (cfg.get("auto_approve_programs") or [])
    status = "approved" if auto_approve else "pending"
    doc = {
        "id": bid,
        "team_id": team["id"],
        "team_name": team["name"],
        "user_id": user["id"],
        "user_name": f"{user['first_name']} {user['last_name']}",
        "seat_id": payload.seat_id,
        "start_time": parse_iso(payload.start_time).isoformat(),
        "end_time": parse_iso(payload.end_time).isoformat(),
        "status": status,
        "rejection_reason": None,
        "approved_by": None,
        "approved_at": None,
        "created_at": utcnow_iso(),
        "updated_at": utcnow_iso(),
    }
    await db.bookings.insert_one(doc)
    if auto_approve:
        await notify(user["id"], "Booking approved", f"Seat #{payload.seat_id} confirmed.", "success")
    else:
        await notify(user["id"], "Booking submitted", f"Seat #{payload.seat_id} pending approval.", "info")
        async for adm in db.users.find({"role": {"$in": list(ALL_ADMIN_ROLES)}, "status": "active"}, {"_id": 0, "id": 1}):
            await notify(adm["id"], "New booking awaiting approval", f"{user['first_name']} requested seat #{payload.seat_id}.", "approval")
    doc.pop("_id", None)
    return doc


@api.get("/bookings/mine")
async def my_bookings(user: dict = Depends(get_current_user)):
    out = []
    async for b in db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("start_time", -1):
        out.append(b)
    return out


@api.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Not found")
    if b["user_id"] != user["id"] and user["role"] not in ALL_ADMIN_ROLES:
        raise HTTPException(403, "Not allowed")
    if b["status"] not in ("pending", "approved"):
        raise HTTPException(400, "Cannot cancel this booking")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled", "updated_at": utcnow_iso()}})
    await notify(b["user_id"], "Booking cancelled", f"Seat #{b['seat_id']} on {b['start_time'][:10]}", "info")
    return {"ok": True}


@api.get("/admin/bookings/pending")
async def pending_bookings(_: dict = Depends(require_admin)):
    out = []
    async for b in db.bookings.find({"status": "pending"}, {"_id": 0}).sort("created_at", 1):
        team = await db.teams.find_one({"id": b["team_id"]}, {"_id": 0, "priority_tier": 1, "program": 1})
        b["priority_tier"] = team.get("priority_tier") if team else 99
        b["program"] = team.get("program") if team else None
        out.append(b)
    out.sort(key=lambda x: (x.get("priority_tier") or 99, x.get("created_at")))
    return out


@api.post("/admin/bookings/{booking_id}/approve")
async def approve_booking(booking_id: str, admin: dict = Depends(require_admin)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Not found")
    if b["status"] != "pending":
        raise HTTPException(400, "Already processed")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "approved", "approved_by": admin["id"], "approved_at": utcnow_iso(), "updated_at": utcnow_iso()}})
    await notify(b["user_id"], "Booking approved", f"Seat #{b['seat_id']} on {b['start_time'][:10]} confirmed.", "success")
    return {"ok": True}


@api.post("/admin/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, payload: RejectIn, admin: dict = Depends(require_admin)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Not found")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "rejected", "rejection_reason": payload.reason, "approved_by": admin["id"], "approved_at": utcnow_iso(), "updated_at": utcnow_iso()}})
    await notify(b["user_id"], "Booking rejected", payload.reason, "warning")
    return {"ok": True}


@api.post("/admin/bookings/bulk-approve")
async def bulk_approve(payload: dict, admin: dict = Depends(require_admin)):
    ids = payload.get("ids", [])
    n = 0
    for bid in ids:
        b = await db.bookings.find_one({"id": bid})
        if b and b["status"] == "pending":
            await db.bookings.update_one({"id": bid}, {"$set": {"status": "approved", "approved_by": admin["id"], "approved_at": utcnow_iso(), "updated_at": utcnow_iso()}})
            await notify(b["user_id"], "Booking approved", f"Seat #{b['seat_id']} on {b['start_time'][:10]}", "success")
            n += 1
    return {"approved": n}


# ===================== VIOLATIONS =====================
@api.get("/admin/violations")
async def list_violations(_: dict = Depends(require_admin)):
    out = []
    async for v in db.violations.find({}, {"_id": 0}).sort("created_at", -1):
        u = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
        v["user"] = u
        out.append(v)
    return out


@api.post("/admin/violations")
async def create_violation(payload: ViolationIn, admin: dict = Depends(require_admin)):
    auto_action = {"tier_1": "warning", "tier_2": "restriction", "tier_3": "suspension"}[payload.severity]
    vid = str(uuid.uuid4())
    await db.violations.insert_one({
        "id": vid,
        "user_id": payload.user_id,
        "team_id": payload.team_id,
        "booking_id": payload.booking_id,
        "category": payload.category,
        "severity": payload.severity,
        "description": payload.description,
        "auto_action": auto_action,
        "logged_by": admin["id"],
        "created_at": utcnow_iso(),
    })
    if auto_action == "suspension":
        await db.users.update_one({"id": payload.user_id}, {"$set": {"status": "suspended"}})
    await notify(payload.user_id, f"Violation logged ({payload.severity})", f"{payload.description}\nAction: {auto_action}", "warning")
    return {"ok": True, "id": vid}


# ===================== GUIDELINES =====================
@api.get("/guidelines/active")
async def active_guidelines():
    g = await db.guidelines.find_one({"active": True}, {"_id": 0})
    return g


@api.get("/admin/guidelines")
async def all_guidelines(_: dict = Depends(require_admin)):
    out = []
    async for g in db.guidelines.find({}, {"_id": 0}).sort("version", -1):
        out.append(g)
    return out


@api.post("/admin/guidelines")
async def create_guidelines(payload: GuidelineIn, _: dict = Depends(require_admin)):
    last = await db.guidelines.find_one(sort=[("version", -1)])
    version = (last["version"] + 1) if last else 1
    gid = str(uuid.uuid4())
    if payload.activate:
        await db.guidelines.update_many({}, {"$set": {"active": False}})
    await db.guidelines.insert_one({
        "id": gid,
        "version": version,
        "content_md": payload.content_md,
        "active": payload.activate,
        "created_at": utcnow_iso(),
    })
    return {"ok": True, "version": version}


@api.post("/admin/guidelines/{gid}/activate")
async def activate_guidelines(gid: str, _: dict = Depends(require_admin)):
    await db.guidelines.update_many({}, {"$set": {"active": False}})
    await db.guidelines.update_one({"id": gid}, {"$set": {"active": True}})
    return {"ok": True}


# ===================== CONFIGURATION =====================
@api.get("/configuration")
async def configuration(_: dict = Depends(get_current_user)):
    cfg = await get_config()
    return cfg


@api.put("/admin/configuration")
async def update_config(payload: ConfigUpdate, _: dict = Depends(require_admin)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        upd["updated_at"] = utcnow_iso()
        await db.configuration.update_one({"id": "default"}, {"$set": upd})
    cfg = await get_config()
    return cfg


# ===================== NOTIFICATIONS =====================
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    out = []
    async for n in db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50):
        out.append(n)
    return out


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ===================== REPORTS / ADMIN DASHBOARD =====================
@api.get("/admin/dashboard")
async def admin_dashboard(_: dict = Depends(require_admin)):
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)
    today_bookings = await db.bookings.count_documents({
        "status": {"$in": ["pending", "approved"]},
        "start_time": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()},
    })
    pending = await db.bookings.count_documents({"status": "pending"})
    pending_users = await db.users.count_documents({"status": "pending"})
    cfg = await get_config()
    total_seats = await db.seats.count_documents({"status": "available"})
    # Occupancy: hours booked / (working_hours * total seats)
    working_hours = cfg["working_hours_end"] - cfg["working_hours_start"]
    booked_hours = 0
    async for b in db.bookings.find({
        "status": "approved",
        "start_time": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()},
    }, {"_id": 0, "start_time": 1, "end_time": 1}):
        booked_hours += int((parse_iso(b["end_time"]) - parse_iso(b["start_time"])).total_seconds() // 3600)
    occupancy = round(100 * booked_hours / max(1, working_hours * total_seats), 1)

    month_start = datetime.combine(today.replace(day=1), datetime.min.time(), tzinfo=timezone.utc)
    violations_count = await db.violations.count_documents({"created_at": {"$gte": month_start.isoformat()}})

    # Last 14 days bookings chart
    chart = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        ds = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
        de = ds + timedelta(days=1)
        c = await db.bookings.count_documents({"start_time": {"$gte": ds.isoformat(), "$lt": de.isoformat()}})
        chart.append({"date": d.isoformat(), "count": c})

    return {
        "today_bookings": today_bookings,
        "occupancy": occupancy,
        "pending_bookings": pending,
        "pending_users": pending_users,
        "violations_this_month": violations_count,
        "chart_14d": chart,
    }


@api.get("/admin/reports/utilization")
async def utilization(_: dict = Depends(require_admin)):
    """Heatmap: seat × hour for last 30 days."""
    cfg = await get_config()
    hours = list(range(cfg["working_hours_start"], cfg["working_hours_end"]))
    today = date.today()
    start = datetime.combine(today - timedelta(days=30), datetime.min.time(), tzinfo=timezone.utc)
    matrix = {}
    async for b in db.bookings.find({
        "status": "approved",
        "start_time": {"$gte": start.isoformat()},
    }, {"_id": 0}):
        s = parse_iso(b["start_time"])
        e = parse_iso(b["end_time"])
        for h in range(s.hour, e.hour):
            key = f"{b['seat_id']}-{h}"
            matrix[key] = matrix.get(key, 0) + 1
    return {"hours": hours, "matrix": matrix}


@api.get("/admin/reports/team-usage")
async def team_usage(_: dict = Depends(require_admin)):
    today = date.today()
    start = datetime.combine(today - timedelta(days=30), datetime.min.time(), tzinfo=timezone.utc)
    out = {}
    async for b in db.bookings.find({"status": "approved", "start_time": {"$gte": start.isoformat()}}, {"_id": 0}):
        h = int((parse_iso(b["end_time"]) - parse_iso(b["start_time"])).total_seconds() // 3600)
        out[b["team_name"]] = out.get(b["team_name"], 0) + h
    return [{"team": k, "hours": v} for k, v in sorted(out.items(), key=lambda x: -x[1])]


@api.get("/admin/reports/export")
async def export_csv(_: dict = Depends(require_admin)):
    rows = ["id,user,team,seat,start,end,status"]
    async for b in db.bookings.find({}, {"_id": 0}):
        rows.append(f"{b['id']},{b.get('user_name','')},{b.get('team_name','')},{b['seat_id']},{b['start_time']},{b['end_time']},{b['status']}")
    return {"csv": "\n".join(rows)}


# ---------- Mount ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("status")
    await db.seats.create_index("id", unique=True)
    await db.bookings.create_index([("seat_id", 1), ("start_time", 1)])
    await db.bookings.create_index("user_id")
    await db.bookings.create_index("team_id")
    await db.bookings.create_index("status")
    await db.team_memberships.create_index([("user_id", 1), ("team_id", 1)])
    await db.password_reset_tokens.create_index("expires_at")
    await db.notifications.create_index("user_id")
    # Seed
    await run_seed(db, hash_password)
    logger.info("DSSE backend ready.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@app.get("/")
async def root():
    return {"service": "DSSE Booking Portal", "version": "1.0"}
