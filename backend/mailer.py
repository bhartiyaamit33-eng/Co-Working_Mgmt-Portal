"""Best-effort transactional email. Logs when no provider is configured."""
import json
import logging
import os
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage

logger = logging.getLogger("dsse.mailer")


def _send_ses(to: str, subject: str, text: str, from_addr: str) -> bool:
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError:
        logger.warning("boto3 is not installed; cannot send via SES")
        return False
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "ap-south-1"
    try:
        boto3.client("ses", region_name=region).send_email(
            Source=from_addr,
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": text, "Charset": "UTF-8"}},
            },
        )
        return True
    except (BotoCoreError, ClientError):
        logger.exception("SES send failed for %s", to)
        return False


def send_email(to: str, subject: str, text: str) -> bool:
    """Send email via Resend, SMTP, or Amazon SES. Returns True only when a provider accepted it."""
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

    ses_from = os.environ.get("SES_FROM", "").strip()
    if ses_from:
        return _send_ses(to, subject, text, ses_from)

    logger.info("[EMAIL undelivered — configure RESEND_API_KEY, SMTP_HOST, or SES_FROM]\nTo: %s\nSubject: %s\n%s", to, subject, text)
    return False
