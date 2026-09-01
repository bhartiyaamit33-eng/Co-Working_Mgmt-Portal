"""Unit tests for email and consecutive-seat policy (no server required)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from policy import (
    ADMIN_EMAIL,
    are_consecutive_in_cluster,
    find_consecutive_block,
    login_email_error,
    account_email_error,
)


def test_iitb_email_allowed():
    assert login_email_error("student@iitb.ac.in") is None
    assert login_email_error("student@gmail.com") is not None


def test_admin_gmail_allowed():
    assert login_email_error(ADMIN_EMAIL) is None
    assert account_email_error(ADMIN_EMAIL, "super_admin") is None


def test_cannot_make_iitb_user_admin():
    assert account_email_error("lead@iitb.ac.in", "admin") is not None
    assert account_email_error("lead@iitb.ac.in", "team_lead") is None


def test_consecutive_same_cluster():
    assert are_consecutive_in_cluster([1, 2, 3, 4])
    assert not are_consecutive_in_cluster([1, 2, 3, 7])
    assert not are_consecutive_in_cluster([33, 34, 35, 36])
    assert are_consecutive_in_cluster([51, 52, 53, 54])


def test_find_block_prefers_start_at_click():
    block = find_consecutive_block(range(1, 7), 3, 4)
    assert block == [3, 4, 5, 6]
