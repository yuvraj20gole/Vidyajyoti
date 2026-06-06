import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app

logger = logging.getLogger(__name__)


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

    mail_from = current_app.config.get("MAIL_FROM") or current_app.config["SMTP_USER"]
    host = current_app.config.get("SMTP_HOST", "smtp.gmail.com")
    port = int(current_app.config.get("SMTP_PORT", 587))
    user = current_app.config["SMTP_USER"]
    password = current_app.config["SMTP_PASSWORD"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = email
    msg.attach(MIMEText(body, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(host, port, timeout=30) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(user, password)
        server.sendmail(mail_from, [email], msg.as_string())
