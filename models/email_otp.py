from datetime import datetime

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


class EmailOtp(db.Model):
    __tablename__ = "email_otps"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    otp_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_sent_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_otp(self, code: str) -> None:
        self.otp_hash = generate_password_hash(code)

    def check_otp(self, code: str) -> bool:
        return check_password_hash(self.otp_hash, code)
