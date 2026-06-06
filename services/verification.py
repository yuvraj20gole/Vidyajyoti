from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from flask import current_app


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"],
        salt="vidyajyoti-email-verify",
    )


def make_verification_token(email: str) -> str:
    return _serializer().dumps({"email": email.strip().lower()})


def verify_verification_token(token: str, email: str, max_age: int = 1800) -> bool:
    if not token:
        return False
    try:
        data = _serializer().loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return False
    return data.get("email") == email.strip().lower()
