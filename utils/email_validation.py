import re
from functools import lru_cache

MIN_PASSWORD_LEN = 8
VIT_DOMAIN = "vit.edu.in"
VIT_EMAIL_RE = re.compile(
    rf"^[a-z0-9](?:[a-z0-9._-]{{1,62}}[a-z0-9])?@{re.escape(VIT_DOMAIN)}$"
)
DOMAIN_TYPOS = {
    "vit.ed.in": VIT_DOMAIN,
    "vit.edu.com": VIT_DOMAIN,
    "vit.ac.in": VIT_DOMAIN,
    "vitstudent.ac.in": VIT_DOMAIN,
}
BLOCKED_LOCAL_PARTS = {"test", "admin", "fake", "user", "demo", "example", "null", "none"}


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_vit_email_format(email: str, domain: str = VIT_DOMAIN) -> tuple[bool, str | None]:
    email = normalize_email(email)
    if not email:
        return False, "Email is required."
    if "@" not in email:
        return False, "Enter a valid email address."

    local, _, seen_domain = email.partition("@")
    if seen_domain != domain:
        if seen_domain in DOMAIN_TYPOS:
            return False, f"Did you mean @{DOMAIN_TYPOS[seen_domain]}? Use your official VIT email."
        return False, f"Only @{domain} addresses are allowed."
    if local in BLOCKED_LOCAL_PARTS:
        return False, "This email address is not allowed."
    if len(local) < 3:
        return False, "Use your official VIT email (e.g. firstname.lastname@vit.edu.in)."
    if not VIT_EMAIL_RE.match(email):
        return False, "Use your official VIT email (e.g. firstname.lastname@vit.edu.in)."

    return True, None


@lru_cache(maxsize=1)
def vit_domain_has_mx(domain: str = VIT_DOMAIN) -> bool | None:
    try:
        import dns.resolver

        answers = dns.resolver.resolve(domain, "MX")
        return len(answers) > 0
    except Exception:
        return None


def verify_vit_email(email: str, domain: str = VIT_DOMAIN) -> tuple[bool, str | None]:
    ok, err = validate_vit_email_format(email, domain=domain)
    if not ok:
        return False, err

    mx_ok = vit_domain_has_mx(domain)
    if mx_ok is False:
        return False, "The @vit.edu.in mail domain could not be verified. Check for typos."
    if mx_ok is True:
        return True, "Valid VIT email format and domain."

    return True, "Valid VIT email format."
