"""Account and seating policy: IITB emails, sole admin, consecutive team seats."""
import os
from typing import Iterable, List, Optional, Sequence, Tuple

MEMBER_EMAIL_DOMAIN = os.environ.get("MEMBER_EMAIL_DOMAIN", "iitb.ac.in").lower()
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "ideas.iitb@gmail.com").lower()

# Fishbone clusters on the 4th floor (same grouping as the floor map).
SEAT_CLUSTERS: Tuple[Tuple[int, ...], ...] = (
    tuple(range(1, 7)),
    tuple(range(7, 13)),
    tuple(range(13, 19)),
    tuple(range(19, 24)),
    tuple(range(24, 30)),
    tuple(range(30, 36)),
    tuple(range(36, 41)),
    tuple(range(41, 46)),
    tuple(range(46, 51)),
    tuple(range(51, 56)),
)

_SEAT_TO_CLUSTER = {sid: idx for idx, cluster in enumerate(SEAT_CLUSTERS) for sid in cluster}

ADMIN_ROLES = frozenset({"admin", "super_admin"})


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def is_admin_email(email: str) -> bool:
    return normalize_email(email) == ADMIN_EMAIL


def is_member_email(email: str) -> bool:
    return normalize_email(email).endswith(f"@{MEMBER_EMAIL_DOMAIN}")


def is_allowed_login_email(email: str) -> bool:
    return is_admin_email(email) or is_member_email(email)


def login_email_error(email: str) -> Optional[str]:
    """Return a rejection message, or None if the email may sign in / sign up."""
    e = normalize_email(email)
    if not e:
        return "Email is required."
    if is_admin_email(e) or is_member_email(e):
        return None
    return (
        f"Only @{MEMBER_EMAIL_DOMAIN} emails can register or log in. "
        f"Admin access is limited to {ADMIN_EMAIL}."
    )


def account_email_error(email: str, role: Optional[str] = None) -> Optional[str]:
    """Reject disallowed emails, and any admin role that is not the sole admin account."""
    e = normalize_email(email)
    domain_err = login_email_error(e)
    if domain_err:
        return domain_err
    if role in ADMIN_ROLES and not is_admin_email(e):
        return f"Admin access is limited to {ADMIN_EMAIL}."
    if is_admin_email(e) and role not in (None, *ADMIN_ROLES):
        return f"{ADMIN_EMAIL} is reserved for admin access."
    return None


def cluster_index(seat_id: int) -> Optional[int]:
    return _SEAT_TO_CLUSTER.get(seat_id)


def are_consecutive_in_cluster(seat_ids: Sequence[int]) -> bool:
    if len(seat_ids) < 1:
        return False
    ids = sorted(seat_ids)
    if len(set(ids)) != len(ids):
        return False
    cid = cluster_index(ids[0])
    if cid is None:
        return False
    if any(cluster_index(s) != cid for s in ids):
        return False
    return ids == list(range(ids[0], ids[0] + len(ids)))


def find_consecutive_block(
    cluster_seat_ids: Sequence[int],
    clicked_id: int,
    count: int,
    allowed: Optional[Iterable[int]] = None,
) -> Optional[List[int]]:
    """Return a consecutive run of `count` seats in the cluster that includes clicked_id."""
    if count < 1:
        return None
    allowed_set = set(allowed) if allowed is not None else None
    ids = sorted({sid for sid in cluster_seat_ids if allowed_set is None or sid in allowed_set})
    windows: list[list[int]] = []
    for i in range(0, len(ids) - count + 1):
        window = ids[i : i + count]
        if window[-1] - window[0] != count - 1:
            continue
        if clicked_id in window:
            windows.append(window)
    start_at = next((w for w in windows if w[0] == clicked_id), None)
    return start_at or (windows[0] if windows else None)
