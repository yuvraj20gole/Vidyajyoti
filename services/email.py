import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from flask import current_app

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    pass


def _smtp_configured() -> bool:
    return bool(
        current_app.config.get("SMTP_USER")
        and current_app.config.get("SMTP_PASSWORD")
    )


def send_otp_email(email: str, code: str) -> None:
    subject = "Your Vidyajyoti verification code"
    body = (
        f"Your Vidyajyoti registration code is: {code}\n\n"
        "This code expires in 10 minutes. If you did not request this, ignore this email."
    )
    html = (
        "<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;\">"
        "<h2 style=\"color:#1a3a6a;\">Vidyajyoti Tracker</h2>"
        "<p>Your verification code is:</p>"
        f"<p style=\"font-size:28px;font-weight:bold;letter-spacing:6px;color:#4d9fff;\">{code}</p>"
        "<p style=\"color:#666;font-size:14px;\">This code expires in 10 minutes.</p>"
        "</div>"
    )

    dev_mode = current_app.config.get("MAIL_DEV_MODE", False)
    if dev_mode or not _smtp_configured():
        logger.warning("[MAIL_DEV_MODE] OTP for %s: %s", email, code)
        return

    user = current_app.config["SMTP_USER"]
    password = current_app.config["SMTP_PASSWORD"]
    mail_from = current_app.config.get("MAIL_FROM") or formataddr(("Vidyajyoti", user))
    host = current_app.config.get("SMTP_HOST", "smtp.gmail.com")
    port = int(current_app.config.get("SMTP_PORT", 587))

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = email
    msg.attach(MIMEText(body, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(user, password)
            server.sendmail(user, [email], msg.as_string())
    except smtplib.SMTPAuthenticationError as exc:
        logger.exception("Gmail SMTP authentication failed")
        raise EmailSendError(
            "Gmail login failed. Check SMTP_USER and SMTP_PASSWORD (app password) on Render."
        ) from exc
    except smtplib.SMTPException as exc:
        logger.exception("SMTP error while sending OTP to %s", email)
        raise EmailSendError("Could not send email. Please try again in a minute.") from exc
    except TimeoutError as exc:
        logger.exception("SMTP timeout while sending OTP to %s", email)
        raise EmailSendError(
            "Email server timed out. Render free tier blocks Gmail SMTP (ports 587/465). "
            "Set MAIL_DEV_MODE=1 and read OTP from Render Logs, or upgrade to a paid Render plan."
        ) from exc
    except OSError as exc:
        logger.exception("Network error while sending OTP to %s", email)
        raise EmailSendError(
            "Cannot reach Gmail SMTP. Render free tier blocks ports 587 and 465. "
            "Use MAIL_DEV_MODE=1 (OTP in Render Logs) or upgrade Render to a paid plan."
        ) from exc
