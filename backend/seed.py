"""Seed data: 55 seats (fishbone layout), default config, guidelines, demo teams.

Layout (from DSSE 4th floor sketch):
  Right column (6 clusters, top→bottom): 1-6, 7-12, 13-18, 19-23 (pillar=5 seats), 24-29, 30-35
  Left column (4 clusters, top→bottom near gate→away): 51-55, 46-50, 41-45, 36-40
  Each cluster is a fishbone around a horizontal spine. Coordinates are normalized 0..100.
"""
from datetime import datetime, timezone, date, timedelta
import os
import uuid


# --- Build the fishbone seat layout ---
def _right_cluster(start_id, cy, has_pillar=False):
    """Right cluster: spine runs left→right, A on left, D on right.
    Seats numbered counter-clockwise starting from A.
    Returns list of dicts (id, x, y, role)."""
    # Right column horizontal centre is around x=72; spine spans 60..84
    x_a = 60.0
    x_b = 67.0
    x_c = 77.0
    x_d = 84.0
    dy = 5.0
    seats = []
    if has_pillar:
        # 5 seats: A, B, C, end, F (no E because pillar blocks it)
        seats.append({"id": start_id, "x": x_a, "y": cy, "role": "spine_left"})
        seats.append({"id": start_id + 1, "x": x_b, "y": cy - dy, "role": "top_near"})
        seats.append({"id": start_id + 2, "x": x_c, "y": cy - dy, "role": "top_far"})
        seats.append({"id": start_id + 3, "x": x_d, "y": cy, "role": "spine_right"})
        seats.append({"id": start_id + 4, "x": x_b, "y": cy + dy, "role": "bottom_near"})
        # pillar replaces bottom_far
    else:
        seats.append({"id": start_id, "x": x_a, "y": cy, "role": "spine_left"})
        seats.append({"id": start_id + 1, "x": x_b, "y": cy - dy, "role": "top_near"})
        seats.append({"id": start_id + 2, "x": x_c, "y": cy - dy, "role": "top_far"})
        seats.append({"id": start_id + 3, "x": x_d, "y": cy, "role": "spine_right"})
        seats.append({"id": start_id + 4, "x": x_c, "y": cy + dy, "role": "bottom_far"})
        seats.append({"id": start_id + 5, "x": x_b, "y": cy + dy, "role": "bottom_near"})
    return seats


def _left_cluster(start_id, cy):
    """Left cluster (5 seats, mirrored): spine tip on right (closer to aisle).
    Numbering varies but we map A(spine_right)=start_id, then top-near, top-far, bottom-far, bottom-near.
    """
    x_a = 40.0  # spine tip (aisle side)
    x_b = 33.0  # top near
    x_c = 23.0  # top far
    dy = 5.0
    seats = []
    seats.append({"id": start_id, "x": x_a, "y": cy, "role": "spine_right"})
    seats.append({"id": start_id + 3, "x": x_b, "y": cy - dy, "role": "top_near"})  # 54
    seats.append({"id": start_id + 4, "x": x_c, "y": cy - dy, "role": "top_far"})   # 55
    seats.append({"id": start_id + 1, "x": x_b, "y": cy + dy, "role": "bottom_near"})  # 52
    seats.append({"id": start_id + 2, "x": x_c, "y": cy + dy, "role": "bottom_far"})   # 53
    return seats


def build_seat_layout():
    seats = []
    # Right column: clusters at y = 12, 27, 42, 57(pillar), 72, 87
    right_y = [12, 27, 42, 57, 72, 87]
    right_starts = [1, 7, 13, 19, 24, 30]
    right_pillar = [False, False, False, True, False, False]
    for sid, y, pillar in zip(right_starts, right_y, right_pillar):
        for s in _right_cluster(sid, y, pillar):
            seats.append(s)

    # Left column: clusters near gate (top) to bottom: 51-55 (top), 46-50, 41-45, 36-40 (bottom)
    left_y = [20, 38, 56, 78]
    left_starts = [51, 46, 41, 36]
    for sid, y in zip(left_starts, left_y):
        for s in _left_cluster(sid, y):
            seats.append(s)
    seats.sort(key=lambda x: x["id"])
    return seats


# --- Default guidelines content ---
GUIDELINES_MD = """# DSSE Co-Working Space – Usage Framework

## 1. Objective
To create a structured and professional environment for DSSE venture teams to work on their startup ideas, ensuring efficient utilization of space and resources.

## 2. Booking & Access
- All teams must book the space via the DSSE portal.
- Booking happens on an hourly basis between **9 AM and 6 PM**.
- Maximum **4 hours per day** and **20 hours per week** per team.
- Bookings must be requested at least **1 hour in advance** and at most **7 days ahead**.
- Every booking is confirmed only after admin approval.

## 3. Seat Allocation
- Seats are numbered 1 to 55. The selected seat is reserved exclusively during your booked window.
- A seat marked under maintenance is unavailable for booking.

## 4. Conduct
- Maintain silence/low-volume discussions; use the discussion zones for calls.
- No food at the workstations; beverages with closed lids permitted.
- Keep the area clean and report any damage immediately.
- Treat fellow members and the space with respect.

## 5. Violations
- **Tier 1 (Warning):** No-show, late check-in, minor cleanliness lapses.
- **Tier 2 (Restriction):** Repeated Tier 1, sharing seat with non-team members, exceeding booked time.
- **Tier 3 (Suspension):** Damage to property, disrespectful behaviour, repeated Tier 2.

## 6. Acceptance
By booking a seat you accept these guidelines and the consequences of any violation.
"""


DEFAULT_CONFIG = {
    "id": "default",
    "working_hours_start": 9,    # 9 AM
    "working_hours_end": 18,     # 6 PM
    "daily_cap_hours": 4,
    "weekly_cap_hours": 20,
    "lead_time_hours": 0,
    "booking_window_days": 7,
    "max_booking_hours": 4,
    "min_booking_hours": 1,
    "auto_approve_programs": [],   # programs auto-approved
    "updated_at": datetime.now(timezone.utc).isoformat(),
}


async def run_seed(db, hash_password_fn):
    """Idempotent seed."""
    now = datetime.now(timezone.utc)

    # 1. Seats
    if await db.seats.count_documents({}) == 0:
        seats = build_seat_layout()
        docs = []
        for s in seats:
            docs.append({
                "id": s["id"],
                "label": str(s["id"]),
                "zone": "Right" if s["x"] >= 50 else "Left",
                "status": "available",
                "position_x": s["x"],
                "position_y": s["y"],
                "role": s["role"],
            })
        await db.seats.insert_many(docs)

    # Clear any legacy blocked flag on seats 4 & 18 so they stay bookable.
    await db.seats.update_many({"id": {"$in": [4, 18]}}, {"$set": {"status": "available"}})

    # 2. Super admin (ideas.iitb@gmail.com / Admin@123 by default)
    admin_email = os.environ.get("ADMIN_EMAIL", "ideas.iitb@gmail.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    sync_admin = os.environ.get("ADMIN_SYNC_ON_START", "").lower() in ("1", "true", "yes")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password_fn(admin_password),
            "first_name": "DSSE",
            "last_name": "Admin",
            "phone": "",
            "roll_number": "",
            "role": "super_admin",
            "status": "active",
            "guidelines_accepted_version": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        })
    elif sync_admin:
        # Use when this email was already used (e.g. applicant signup) or password unknown locally.
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "password_hash": hash_password_fn(admin_password),
                "first_name": "DSSE",
                "last_name": "Admin",
                "role": "super_admin",
                "status": "active",
                "updated_at": now.isoformat(),
            }},
        )

    # 3. Guidelines (one active version)
    if await db.guidelines.count_documents({}) == 0:
        await db.guidelines.insert_one({
            "id": str(uuid.uuid4()),
            "version": 1,
            "content_md": GUIDELINES_MD,
            "active": True,
            "created_at": now.isoformat(),
        })

    # 4. Configuration
    if not await db.configuration.find_one({"id": "default"}):
        await db.configuration.insert_one(DEFAULT_CONFIG)

    # 5. Demo teams (one per program)
    if await db.teams.count_documents({}) == 0:
        active_from = date.today().isoformat()
        active_until = (date.today() + timedelta(days=180)).isoformat()
        demo_teams = [
            {"name": "Lumen Ventures", "program": "ideas_l1", "priority_tier": 3},
            {"name": "Bharat Robotics", "program": "ideas_l2", "priority_tier": 2},
            {"name": "GrowwLabs Alpha", "program": "groww", "priority_tier": 1},
        ]
        for t in demo_teams:
            await db.teams.insert_one({
                "id": str(uuid.uuid4()),
                "name": t["name"],
                "program": t["program"],
                "priority_tier": t["priority_tier"],
                "active_from": active_from,
                "active_until": active_until,
                "team_lead_id": None,
                "status": "active",
                "created_at": now.isoformat(),
            })
