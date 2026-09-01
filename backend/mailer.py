"""Best-effort transactional email. Logs when no provider is configured."""
import json
import logging
import os
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage

logger = logging.getLogger("dsse.mailer")


def send_email(to: str, subject: str, text: str) -> bool:
    """Send email via Resend or SMTP. Returns True only when a provider accepted it."""
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if api_key:
        from_addr = os.environ.get("RESEND_FROM", "DSSE Booking <onboarding@resend.dev>")
        payload = json.dumps({"from": from_addr, "to": [to], "subject": subject, "text": text}).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                if 200 <= resp.status < 300:
                    return True
                logger.warning("Resend rejected email to %s: %s", to, resp.status)
        except urllib.error.HTTPError as e:
            body = e.read()[:300] if e.fp else b""
            logger.warning("Resend rejected email to %s: %s %s", to, e.code, body)
        except Exception:
            logger.exception("Resend send failed for %s", to)
        return False

    host = os.environ.get("SMTP_HOST", "").strip()
    if host:
        port = int(os.environ.get("SMTP_PORT", "587"))
        user = os.environ.get("SMTP_USER", "")
        password = os.environ.get("SMTP_PASSWORD", "")
        from_addr = os.environ.get("SMTP_FROM", user or "noreply@localhost")
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to
        msg.set_content(text)
        try:
            with smtplib.SMTP(host, port, timeout=15) as smtp:
                smtp.starttls()
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
            return True
        except Exception:
            logger.exception("SMTP send failed for %s", to)
            return False

    logger.info("[EMAIL undelivered — configure RESEND_API_KEY or SMTP_HOST]\nTo: %s\nSubject: %s\n%s", to, subject, text)
    return False
