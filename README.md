# Vidyajyoti Tracker

A web-based ground station dashboard for the **Vidyajyoti** student satellite program. It visualizes environmental telemetry, orbital parameters, and mission data through an interactive three-screen interface.

**Location:** Mumbai, India · **Access:** `@vit.edu.in` email only

---

## Overview

Vidyajyoti Tracker is a full-stack satellite operations console with **VIT-only authentication**. After signing in, operators can monitor ground station sensors, track satellites on interactive maps, and review a mission dashboard.

### Features

| Screen | Purpose |
|--------|---------|
| **Login / Register** | Secure access — only `@vit.edu.in` emails |
| **Telemetry** | Temperature, humidity, pressure, wind, UV, AQI, 24h climate history |
| **Orbit Tracker** | Lat/lon/alt/velocity, world map, 3D globe, polar plot |
| **Dashboard** | Summary metrics, India map, signal gauge, orbit stats |

### Architecture

```
Browser
   │
   ├── GET /login          → Auth page (register / sign in)
   ├── GET /dashboard      → Protected tracker UI
   └── GET /api/*          → Protected JSON APIs
           │
           ▼
      Flask + SQLAlchemy (SQLite local / PostgreSQL on Render)
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3, Flask, Flask-Login, SQLAlchemy |
| Database | SQLite (local) · PostgreSQL (Render production) |
| Frontend | HTML, CSS, JavaScript |
| Maps & 3D | Leaflet, Globe.gl, Three.js |
| Production | Gunicorn on [Render](https://render.com) with HTTPS |

---

## Quick start (local)

```bash
pip install -r requirements.txt
cp .env.example .env   # optional — edit SECRET_KEY
python main.py
```

Open **http://127.0.0.1:5001** → redirects to **/login**.

Register with any `@vit.edu.in` email (e.g. `student@vit.edu.in`) for local testing.

Port **5001** avoids macOS AirPlay conflict on port 5000.

---

## Deploy to Render (official HTTPS URL)

GitHub Pages cannot run login or a database. Use **Render** for the college demo.

### 1. Create Render service

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New → Blueprint** → connect repo.
3. Render reads [`render.yaml`](render.yaml) and creates:
   - Web service (`gunicorn main:app`)
   - PostgreSQL database
4. Deploy. Your URL will be like **`https://vidyajyoti-tracker.onrender.com`**.

### 2. Custom domain (e.g. vidyajyoti.com)

1. Buy a domain from any registrar.
2. In Render → your web service → **Settings → Custom Domains** → add `vidyajyoti.com` and `www.vidyajyoti.com`.
3. Add the DNS records Render shows at your registrar.
4. HTTPS (Let's Encrypt) is provisioned automatically.

### Environment variables (Render)

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Session signing (auto-generated on Render) |
| `DATABASE_URL` | PostgreSQL connection (linked from database) |
| `FLASK_DEBUG` | `0` in production |
| `ALLOWED_EMAIL_DOMAIN` | `vit.edu.in` |
| `RESEND_API_KEY` | Resend API key for OTP emails (production) |
| `MAIL_FROM` | Sender address, e.g. `Vidyajyoti <onboarding@resend.dev>` |
| `MAIL_DEV_MODE` | `1` logs OTP to server logs instead of sending email |

Copy [`.env.example`](.env.example) for local development.

### Email OTP (registration)

New users must verify their `@vit.edu.in` email before creating an account:

1. Enter email → **Send OTP**
2. Enter the 6-digit code → **Verify**
3. Complete the form → **Create Account**

**Local testing:** set `MAIL_DEV_MODE=1` — the OTP appears in the terminal where Flask runs.

**Production:** create a free [Resend](https://resend.com) account, add `RESEND_API_KEY` and `MAIL_FROM` in Render → Environment, set `MAIL_DEV_MODE=0`, and redeploy.

---

## API endpoints (authenticated)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/otp/send` | POST | Send 6-digit email verification code |
| `/api/auth/otp/verify` | POST | Verify OTP, returns `verification_token` |
| `/api/auth/register` | POST | Create account (requires verified email) |
| `/api/auth/login` | POST | Sign in |
| `/logout` | GET | Sign out |
| `/api/telemetry` | GET | Sensor readings |
| `/api/orbit` | GET | Satellite position |
| `/api/satellites` | GET | Satellite catalog |

---

## GitHub Pages (legacy static mirror)

The `docs/` folder is a **static preview without login**. For the official college site, use Render + custom domain.

```bash
python build.py   # rebuild docs/ after frontend changes
```

---

## Project structure

```
vidyajyoti-tracker/
├── main.py
├── config.py
├── extensions.py
├── models/user.py
├── models/email_otp.py
├── services/email.py
├── routes/auth.py
├── routes/api.py
├── templates/auth.html
├── templates/index.html
├── static/css/auth.css
├── static/js/auth.js
├── Procfile
├── render.yaml
└── instance/          # SQLite DB (local, gitignored)
```

---

## Notes

- Only emails ending in **`@vit.edu.in`** can register or sign in (enforced server-side).
- Maps require internet (CDN tiles).
- Set `FLASK_DEBUG=0` in production.
