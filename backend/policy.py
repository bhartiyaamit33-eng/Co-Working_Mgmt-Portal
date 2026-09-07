"""Account and seating policy: IITB emails, sole admin, consecutive team seats."""
import os
from typing import Iterable, List, Optional, Sequence, Tuple

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "ideas.iitb@gmail.com").lower()


def _parse_member_email_domains() -> frozenset:
    raw = os.environ.get("MEMBER_EMAIL_DOMAINS", "").strip()
    if raw:
        return frozenset(d.strip().lower().lstrip("@") for d in raw.split(",") if d.strip())
    primary = os.environ.get("MEMBER_EMAIL_DOMAIN", "iitb.ac.in").strip().lower().lstrip("@") or "iitb.ac.in"
    return frozenset({primary, "iitbombay.org"})


MEMBER_EMAIL_DOMAINS = _parse_member_email_domains()
MEMBER_EMAIL_DOMAIN = os.environ.get("MEMBER_EMAIL_DOMAIN", "iitb.ac.in").strip().lower().lstrip("@") or "iitb.ac.in"

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


def member_domains_phrase() -> str:
    preferred = ("iitb.ac.in", "iitbombay.org")
    ordered = [d for d in preferred if d in MEMBER_EMAIL_DOMAINS]
    ordered.extend(sorted(MEMBER_EMAIL_DOMAINS.difference(preferred)))
    labels = [f"@{d}" for d in ordered]
    if not labels:
        return "@iitb.ac.in"
    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]} or {labels[1]}"
    return ", ".join(labels[:-1]) + f", or {labels[-1]}"


def is_admin_email(email: str) -> bool:
    return normalize_email(email) == ADMIN_EMAIL


def is_member_email(email: str) -> bool:
    e = normalize_email(email)
    if "@" not in e:
        return False
    return e.rsplit("@", 1)[-1] in MEMBER_EMAIL_DOMAINS


def is_allowed_login_email(email: str) -> bool:
    """Public self-serve: member domains, plus the configured admin mailbox."""
    return is_admin_email(email) or is_member_email(email)


def login_email_error(email: str) -> Optional[str]:
    """Sign-in / OTP / reset: any mailbox may try; unknown accounts still fail later."""
    if not normalize_email(email):
        return "Email is required."
    return None


def signup_email_error(email: str) -> Optional[str]:
    """Self-serve register: IITB member domains only."""
    e = normalize_email(email)
    if not e:
        return "Email is required."
    if is_allowed_login_email(e):
        return None
    return f"Only {member_domains_phrase()} emails can register."


def account_email_error(
    email: str,
    role: Optional[str] = None,
    *,
    enforce_member_domain: bool = True,
) -> Optional[str]:
    """Reject disallowed emails, and any admin role that is not the sole admin account.

    When enforce_member_domain is False (admin create / CSV), any domain is allowed.
    """
    e = normalize_email(email)
    if not e:
        return "Email is required."
    if enforce_member_domain:
        domain_err = signup_email_error(e)
        if domain_err:
            return domain_err
    if role in ADMIN_ROLES and not is_admin_email(e):
        return "This account cannot be given an admin role."
    if is_admin_email(e) and role not in (None, *ADMIN_ROLES):
        return "This email cannot be used for a member account."
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
