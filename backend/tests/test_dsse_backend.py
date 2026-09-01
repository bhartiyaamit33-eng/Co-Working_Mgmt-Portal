"""DSSE Booking Portal - comprehensive backend API tests."""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta, date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "ideas.iitb@gmail.com")
SUPER_ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")

# shared state across tests
STATE = {}


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token")
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    STATE["admin_user"] = data["user"]
    return s


# ---------------- AUTH ----------------
class TestAuth:
    def test_super_admin_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "super_admin"
        assert d["user"]["status"] == "active"
        assert d["token"]

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": SUPER_ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_rejects_non_iitb(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"outsider_{datetime.utcnow().timestamp()}@gmail.com",
            "password": "Test@123",
            "first_name": "Out", "last_name": "Sider",
        })
        assert r.status_code == 400

    def test_login_rejects_non_iitb(self):
        r = requests.post(f"{API}/auth/login", json={"email": "random.person@gmail.com", "password": "whatever"})
        assert r.status_code == 400

    def test_register_applicant(self):
        email = f"test_applicant_{datetime.utcnow().timestamp()}@iitb.ac.in"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Test@123",
            "first_name": "Test", "last_name": "Applicant",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["status"] == "pending"
        assert d["user"]["role"] == "applicant"
        STATE["applicant_id"] = d["user"]["id"]
        STATE["applicant_email"] = email

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": STATE["applicant_email"], "password": "Test@123",
            "first_name": "A", "last_name": "B",
        })
        assert r.status_code == 400

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["user"]["email"] == SUPER_ADMIN_EMAIL

    def test_forgot_password_returns_token(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": STATE["applicant_email"]})
        assert r.status_code == 200
        data = r.json()
        assert data.get("reset_token")
        STATE["reset_token"] = data["reset_token"]

    def test_reset_password(self):
        r = requests.post(f"{API}/auth/reset-password", json={
            "token": STATE["reset_token"], "new_password": "NewPass@123"
        })
        assert r.status_code == 200
        # login with new password
        r2 = requests.post(f"{API}/auth/login", json={"email": STATE["applicant_email"], "password": "NewPass@123"})
        # Pending users can login (status check only blocks suspended)
        assert r2.status_code == 200


# ---------------- SEATS & CONFIG ----------------
class TestSeatsConfig:
    def test_55_seats(self, admin_session):
        r = admin_session.get(f"{API}/seats")
        assert r.status_code == 200
        seats = r.json()
        assert len(seats) == 55
        ids = sorted(s["id"] for s in seats)
        assert ids == list(range(1, 56))
        assert all("position_x" in s and "position_y" in s for s in seats)

    def test_configuration(self, admin_session):
        r = admin_session.get(f"{API}/configuration")
        assert r.status_code == 200
        cfg = r.json()
        assert cfg["working_hours_start"] == 9
        assert cfg["working_hours_end"] == 18
        assert cfg["daily_cap_hours"] == 4
        assert cfg["weekly_cap_hours"] == 20
        assert cfg.get("monthly_cap_hours", 80) == 80
        assert cfg["lead_time_hours"] == 0
        assert cfg["booking_window_days"] == 7

    def test_admin_update_seat_maintenance(self, admin_session):
        r = admin_session.put(f"{API}/admin/seats/55", json={"status": "maintenance"})
        assert r.status_code == 200
        # verify
        r2 = admin_session.get(f"{API}/seats")
        s55 = next(s for s in r2.json() if s["id"] == 55)
        assert s55["status"] == "maintenance"
        # revert
        admin_session.put(f"{API}/admin/seats/55", json={"status": "available"})

    def test_configuration_update_admin(self, admin_session):
        r = admin_session.put(f"{API}/admin/configuration", json={"lead_time_hours": 2})
        assert r.status_code == 200
        assert r.json()["lead_time_hours"] == 2
        # Restore default for downstream tests
        admin_session.put(f"{API}/admin/configuration", json={"lead_time_hours": 0})


# ---------------- TEAMS ----------------
class TestTeams:
    def test_list_teams(self, admin_session):
        r = admin_session.get(f"{API}/admin/teams")
        assert r.status_code == 200
        teams = r.json()
        names = [t["name"] for t in teams]
        assert "Lumen Ventures" in names
        assert "Bharat Robotics" in names
        assert "GrowwLabs Alpha" in names
        STATE["team_id"] = next(t["id"] for t in teams if t["name"] == "Lumen Ventures")

    def test_csv_import_dry_run(self, admin_session):
        csv = "name,program,priority_tier,active_from,active_until\nTEST_Csv_Team,ideas_l1,3,2026-01-01,2026-12-31\n"
        files = {"file": ("teams.csv", csv, "text/csv")}
        r = admin_session.post(f"{API}/admin/teams/import?dry_run=true", files=files)
        assert r.status_code == 200
        assert r.json()["would_create"] == 1
        assert len(r.json()["errors"]) == 0

    def test_create_team(self, admin_session):
        name = f"TEST_Team_{int(datetime.utcnow().timestamp())}"
        r = admin_session.post(f"{API}/admin/teams", json={
            "name": name, "program": "individual", "priority_tier": 3,
            "active_from": "2026-01-01", "active_until": "2026-12-31",
        })
        assert r.status_code == 200


# ---------------- RBAC ----------------
class TestRBAC:
    def test_admin_endpoints_blocked_for_unauth(self):
        r = requests.get(f"{API}/admin/users")
        assert r.status_code == 401

    def test_admin_endpoints_blocked_for_applicant(self):
        r = requests.post(f"{API}/auth/login", json={"email": STATE["applicant_email"], "password": "NewPass@123"})
        assert r.status_code == 200
        token = r.json()["token"]
        r2 = requests.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 403


# ---------------- USER MANAGEMENT ----------------
class TestUserManagement:
    def test_create_member(self, admin_session):
        email = f"test_member_{int(datetime.utcnow().timestamp())}@iitb.ac.in"
        r = admin_session.post(f"{API}/admin/users", json={
            "email": email, "first_name": "Test", "last_name": "Member",
            "role": "member", "initial_password": "Member@123",
            "team_id": STATE["team_id"],
        })
        assert r.status_code == 200
        STATE["member_id"] = r.json()["id"]
        STATE["member_email"] = email

    def test_member_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": STATE["member_email"], "password": "Member@123"})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "member"
        assert d["user"]["status"] == "active"
        STATE["member_token"] = d["token"]

    def test_me_returns_team(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {STATE['member_token']}"})
        assert r.status_code == 200
        assert r.json()["team"] is not None
        assert r.json()["team"]["id"] == STATE["team_id"]

    def test_approve_applicant(self, admin_session):
        # Create fresh applicant
        email = f"test_app2_{int(datetime.utcnow().timestamp())}@iitb.ac.in"
        rr = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Test@123",
            "first_name": "Pend", "last_name": "User",
        })
        uid = rr.json()["user"]["id"]
        r = admin_session.post(f"{API}/admin/users/{uid}/approve", json={
            "team_id": STATE["team_id"], "role": "member"
        })
        assert r.status_code == 200
        # login
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test@123"})
        assert r2.status_code == 200
        assert r2.json()["user"]["status"] == "active"
        assert r2.json()["user"]["role"] == "member"


# ---------------- BOOKINGS ----------------
def _next_weekday_at_hour(hour: int, days_ahead: int = 1):
    """Return UTC iso string for a date hour."""
    d = datetime.now(timezone.utc) + timedelta(days=days_ahead)
    dt = d.replace(hour=hour, minute=0, second=0, microsecond=0)
    return dt


class TestBookings:
    def test_applicant_cannot_book(self):
        # login as applicant (not active - pending)
        r = requests.post(f"{API}/auth/login", json={"email": STATE["applicant_email"], "password": "NewPass@123"})
        token = r.json()["token"]
        start = _next_weekday_at_hour(10, 1)
        end = start + timedelta(hours=1)
        r2 = requests.post(f"{API}/bookings", json={
            "seat_id": 1, "start_time": start.isoformat(), "end_time": end.isoformat()
        }, headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 403  # require_active

    def test_create_booking_success(self):
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        # Try several seats/hours until we find a free one (to avoid collisions with previous runs)
        created = None
        for seat in range(1, 56):
            for day_off in range(2, 7):
                for hr in range(9, 17):
                    start = _next_weekday_at_hour(hr, day_off)
                    end = start + timedelta(hours=1)
                    r = requests.post(f"{API}/bookings", json={
                        "seat_id": seat, "start_time": start.isoformat(), "end_time": end.isoformat()
                    }, headers=h)
                    if r.status_code == 200:
                        created = (r.json(), seat, start, end)
                        break
                    if r.status_code == 400 and "Daily cap" in r.text:
                        # We've hit team's daily cap; skip to a different day
                        continue
                if created:
                    break
            if created:
                break
        assert created, "Could not create any booking"
        b, seat, start, end = created
        assert b["status"] == "pending"
        STATE["booking_id"] = b["id"]
        STATE["booking_seat"] = seat
        STATE["booking_start"] = start
        STATE["booking_end"] = end

    def test_overlap_rejected(self):
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        start = STATE["booking_start"]
        end = STATE["booking_end"]
        r = requests.post(f"{API}/bookings", json={
            "seat_id": STATE["booking_seat"], "start_time": start.isoformat(), "end_time": end.isoformat()
        }, headers=h)
        assert r.status_code == 409

    def test_working_hours_rejected(self):
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        # UTC 02:00 → IST 07:30, which is before 09:00 IST working hours
        start = _next_weekday_at_hour(2, 2)
        end = start + timedelta(hours=1)
        r = requests.post(f"{API}/bookings", json={
            "seat_id": 2, "start_time": start.isoformat(), "end_time": end.isoformat()
        }, headers=h)
        assert r.status_code == 400

    def test_lead_time_rule_disabled(self):
        """Lead time is now 0 — same-day immediate bookings should succeed."""
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        cfg = requests.get(f"{API}/configuration", headers=h).json()
        assert cfg["lead_time_hours"] == 0

    def test_daily_cap_rejected(self):
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        # On same day as existing booking, try booking 4 more hours => should exceed cap
        base_day = STATE["booking_start"].replace(hour=13, minute=0, second=0, microsecond=0)
        # use a seat != booking seat to isolate from overlap
        seat = 2 if STATE["booking_seat"] != 2 else 3
        r = requests.post(f"{API}/bookings", json={
            "seat_id": seat,
            "start_time": base_day.isoformat(),
            "end_time": (base_day + timedelta(hours=4)).isoformat()
        }, headers=h)
        # Should be 400 (either daily cap, or max booking hours 4 ok, but already used 1h => cap fail)
        assert r.status_code == 400

    def test_max_booking_hours(self):
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        start = _next_weekday_at_hour(10, 3)
        end = start + timedelta(hours=5)  # > 4
        r = requests.post(f"{API}/bookings", json={
            "seat_id": 2, "start_time": start.isoformat(), "end_time": end.isoformat()
        }, headers=h)
        assert r.status_code == 400

    def test_booking_window(self):
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        start = _next_weekday_at_hour(10, 10)  # > 7 days ahead
        end = start + timedelta(hours=1)
        r = requests.post(f"{API}/bookings", json={
            "seat_id": 2, "start_time": start.isoformat(), "end_time": end.isoformat()
        }, headers=h)
        assert r.status_code == 400

    def test_my_bookings(self):
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        r = requests.get(f"{API}/bookings/mine", headers=h)
        assert r.status_code == 200
        assert any(b["id"] == STATE["booking_id"] for b in r.json())

    def test_admin_pending_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/bookings/pending")
        assert r.status_code == 200
        assert any(b["id"] == STATE["booking_id"] for b in r.json())

    def test_admin_approve_booking(self, admin_session):
        r = admin_session.post(f"{API}/admin/bookings/{STATE['booking_id']}/approve")
        assert r.status_code == 200
        # verify
        r2 = requests.get(f"{API}/bookings/mine", headers={"Authorization": f"Bearer {STATE['member_token']}"})
        b = next(x for x in r2.json() if x["id"] == STATE["booking_id"])
        assert b["status"] == "approved"

    def test_bulk_approve(self, admin_session):
        # Create another booking on a different seat + different day to avoid caps
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        created_bid = None
        for seat in range(4, 56):
            for day_off in range(5, 7):
                for hr in range(9, 17):
                    start = _next_weekday_at_hour(hr, day_off)
                    end = start + timedelta(hours=1)
                    r = requests.post(f"{API}/bookings", json={
                        "seat_id": seat, "start_time": start.isoformat(), "end_time": end.isoformat()
                    }, headers=h)
                    if r.status_code == 200:
                        created_bid = r.json()["id"]
                        break
                if created_bid:
                    break
            if created_bid:
                break
        assert created_bid, "Could not create booking for bulk approve"
        r2 = admin_session.post(f"{API}/admin/bookings/bulk-approve", json={"ids": [created_bid]})
        assert r2.status_code == 200
        assert r2.json()["approved"] == 1


# ---------------- DASHBOARD ----------------
class TestDashboard:
    def test_admin_dashboard(self, admin_session):
        r = admin_session.get(f"{API}/admin/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["today_bookings", "occupancy", "pending_bookings", "pending_users",
                  "violations_this_month", "chart_14d"]:
            assert k in d
        assert len(d["chart_14d"]) == 14


# ---------------- VIOLATIONS ----------------
class TestViolations:
    def test_log_tier1_violation(self, admin_session):
        r = admin_session.post(f"{API}/admin/violations", json={
            "user_id": STATE["member_id"], "team_id": STATE["team_id"],
            "category": "no_show", "severity": "tier_1",
            "description": "Test tier 1 violation",
        })
        assert r.status_code == 200

    def test_log_tier3_suspends(self, admin_session):
        # Create another member so we can suspend them
        email = f"test_suspend_{int(datetime.utcnow().timestamp())}@iitb.ac.in"
        r = admin_session.post(f"{API}/admin/users", json={
            "email": email, "first_name": "Susp", "last_name": "End",
            "role": "member", "initial_password": "Pass@123",
            "team_id": STATE["team_id"],
        })
        uid = r.json()["id"]
        r2 = admin_session.post(f"{API}/admin/violations", json={
            "user_id": uid, "team_id": STATE["team_id"],
            "category": "damage", "severity": "tier_3",
            "description": "Severe damage",
        })
        assert r2.status_code == 200
        # verify user suspended
        users = admin_session.get(f"{API}/admin/users").json()
        suspended = next(u for u in users if u["id"] == uid)
        assert suspended["status"] == "suspended"


# ---------------- GUIDELINES ----------------
class TestGuidelines:
    def test_active_guidelines(self):
        r = requests.get(f"{API}/guidelines/active")
        assert r.status_code == 200
        g = r.json()
        assert g["active"] is True
        assert g["version"] == 1
        assert "content_md" in g
        STATE["guidelines_id"] = g["id"]

    def test_create_new_version(self, admin_session):
        r = admin_session.post(f"{API}/admin/guidelines", json={
            "content_md": "# New version content", "activate": False
        })
        assert r.status_code == 200
        assert r.json()["version"] >= 2

    def test_accept_guidelines(self):
        h = {"Authorization": f"Bearer {STATE['member_token']}"}
        r = requests.post(f"{API}/auth/accept-guidelines", json={
            "guidelines_id": STATE["guidelines_id"]
        }, headers=h)
        assert r.status_code == 200


# ---------------- OTP ----------------
class TestOtp:
    def test_member_otp_login(self):
        r = requests.post(f"{API}/auth/request-otp", json={"email": STATE["member_email"], "purpose": "login"})
        assert r.status_code == 200
        otp = r.json().get("otp")
        assert otp and len(otp) == 6
        r2 = requests.post(f"{API}/auth/verify-otp", json={"email": STATE["member_email"], "otp": otp})
        assert r2.status_code == 200
        assert r2.json()["user"]["email"] == STATE["member_email"]
        assert r2.json()["token"]

    def test_otp_rejects_gmail(self):
        r = requests.post(f"{API}/auth/request-otp", json={"email": "someone@gmail.com", "purpose": "login"})
        assert r.status_code == 400

    def test_admin_otp_allowed(self):
        r = requests.post(f"{API}/auth/request-otp", json={"email": SUPER_ADMIN_EMAIL, "purpose": "login"})
        assert r.status_code == 200
        otp = r.json().get("otp")
        assert otp
        r2 = requests.post(f"{API}/auth/verify-otp", json={"email": SUPER_ADMIN_EMAIL, "otp": otp})
        assert r2.status_code == 200
        assert r2.json()["user"]["role"] == "super_admin"


# ---------------- TEAM BOOKING ----------------
class TestTeamBooking:
    def test_setup_team_of_four(self, admin_session):
        stamp = int(datetime.utcnow().timestamp())
        team = admin_session.post(f"{API}/admin/teams", json={
            "name": f"TEST_Together_{stamp}", "program": "ideas_l1", "priority_tier": 3,
            "active_from": "2026-01-01", "active_until": "2026-12-31",
        })
        assert team.status_code == 200
        team_id = team.json()["id"]
        ids = []
        emails = []
        for i, role in enumerate(("team_lead", "member", "member", "member")):
            email = f"together_{stamp}_{i}@iitb.ac.in"
            r = admin_session.post(f"{API}/admin/users", json={
                "email": email, "first_name": f"P{i}", "last_name": "Sit",
                "role": role, "initial_password": "Member@123", "team_id": team_id,
            })
            assert r.status_code == 200, r.text
            ids.append(r.json()["id"])
            emails.append(email)
        STATE["together_team_id"] = team_id
        STATE["together_member_ids"] = ids
        STATE["together_lead_email"] = emails[0]
        login = requests.post(f"{API}/auth/login", json={"email": emails[0], "password": "Member@123"})
        assert login.status_code == 200
        STATE["together_lead_token"] = login.json()["token"]

    def test_admin_cannot_create_gmail_member(self, admin_session):
        r = admin_session.post(f"{API}/admin/users", json={
            "email": "someone.else@gmail.com", "first_name": "No", "last_name": "Gmail",
            "role": "member", "initial_password": "Member@123",
        })
        assert r.status_code == 400

    def test_member_cannot_team_book(self):
        member_email = STATE["together_lead_email"].replace("_0@", "_1@")
        login = requests.post(f"{API}/auth/login", json={"email": member_email, "password": "Member@123"})
        assert login.status_code == 200
        h = {"Authorization": f"Bearer {login.json()['token']}"}
        start = _next_weekday_at_hour(10, 6)
        end = start + timedelta(hours=1)
        r = requests.post(f"{API}/bookings/team", json={
            "seat_ids": [1, 2, 3, 4],
            "member_ids": STATE["together_member_ids"],
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        }, headers=h)
        assert r.status_code == 403

    def test_non_consecutive_rejected(self):
        h = {"Authorization": f"Bearer {STATE['together_lead_token']}"}
        start = _next_weekday_at_hour(10, 6)
        end = start + timedelta(hours=1)
        r = requests.post(f"{API}/bookings/team", json={
            "seat_ids": [1, 2, 3, 7],
            "member_ids": STATE["together_member_ids"],
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        }, headers=h)
        assert r.status_code == 400

    def test_team_book_four_consecutive(self):
        h = {"Authorization": f"Bearer {STATE['together_lead_token']}"}
        blocks = [
            [1, 2, 3, 4], [7, 8, 9, 10], [13, 14, 15, 16],
            [19, 20, 21, 22], [24, 25, 26, 27], [30, 31, 32, 33],
            [36, 37, 38, 39], [41, 42, 43, 44], [46, 47, 48, 49], [51, 52, 53, 54],
        ]
        created = None
        for seats in blocks:
            for day_off in range(2, 7):
                for hr in range(9, 12):
                    start = _next_weekday_at_hour(hr, day_off)
                    end = start + timedelta(hours=1)
                    r = requests.post(f"{API}/bookings/team", json={
                        "seat_ids": seats,
                        "member_ids": STATE["together_member_ids"],
                        "start_time": start.isoformat(),
                        "end_time": end.isoformat(),
                    }, headers=h)
                    if r.status_code == 200:
                        created = (r.json(), start, seats)
                        break
                if created:
                    break
            if created:
                break
        assert created, "Could not create a 4-seat team booking"
        data, start, seats = created
        assert len(data["bookings"]) == 4
        assert data["group_id"]
        assert sorted(b["seat_id"] for b in data["bookings"]) == seats
        STATE["together_booking"] = data
        STATE["together_start"] = start

    def test_team_booking_shares_group(self):
        data = STATE["together_booking"]
        assert {b["group_id"] for b in data["bookings"]} == {data["group_id"]}
        assert {b["booked_by"] for b in data["bookings"]} == {data["bookings"][0]["booked_by"]}
