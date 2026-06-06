import logging

from flask import current_app

logger = logging.getLogger(__name__)


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
    api_key = current_app.config.get("RESEND_API_KEY", "")

    if dev_mode or not api_key:
        logger.warning("[MAIL_DEV_MODE] OTP for %s: %s", email, code)
        return

    mail_from = current_app.config.get("MAIL_FROM", "Vidyajyoti <onboarding@resend.dev>")
    import resend

    resend.api_key = api_key
    resend.Emails.send(
        {
            "from": mail_from,
            "to": [email],
            "subject": subject,
            "text": body,
            "html": html,
        }
    )
