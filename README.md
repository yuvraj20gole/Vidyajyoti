# Vidyajyoti Tracker

A web-based ground station dashboard for the **Vidyajyoti** student satellite program. It visualizes environmental telemetry, orbital parameters, and mission data through an interactive three-screen interface.

**Location:** Mumbai, India · **Data:** Simulated demo telemetry (replaceable with live feeds)

---

## Overview

Vidyajyoti Tracker is a full-stack demo application that mimics a real satellite operations console. Operators can monitor weather-style sensors at the ground station, track satellite position on world and regional maps, and review a consolidated mission dashboard.

The project is structured for both **local development** (Python backend serving JSON APIs) and **static hosting** (GitHub Pages with in-browser demo data).

### Features

| Screen | Purpose |
|--------|---------|
| **Telemetry** | Temperature, humidity, pressure, wind, UV, AQI, and 24h climate history (Mumbai) |
| **Orbit Tracker** | Latitude, longitude, altitude, velocity, ground track, world map, 3D globe, polar plot |
| **Dashboard** | Summary metrics, India coverage map, signal quality gauge, orbit stats |

### Architecture

```
Browser (HTML / CSS / JavaScript)
        │
        ├── Local dev ──► Flask API ──► Simulated data generators
        │
        └── GitHub Pages ──► Static docs/ ──► Client-side demo data
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3, Flask |
| Frontend | HTML, CSS, JavaScript |
| Maps & 3D | Leaflet, Globe.gl, Three.js |
| Typography | Google Fonts (Syne, Space Grotesk, JetBrains Mono) |

---

## Project structure

```
vidyajyoti-tracker/
├── main.py              # Flask entry point
├── build.py             # Builds docs/ for GitHub Pages
├── requirements.txt
├── data/                # Telemetry & orbit generators
├── routes/              # REST API (/api/telemetry, /api/orbit, /api/satellites)
├── templates/           # Dashboard HTML
├── static/              # CSS and JavaScript modules
└── docs/                # Pre-built static site for GitHub Pages
```

---

## Quick start (local)

```bash
pip install -r requirements.txt
python main.py
```

Open **http://127.0.0.1:5001** in your browser.

Port **5001** is used to avoid conflicts with macOS AirPlay on port 5000.

---

## Deploy (GitHub Pages)

GitHub Pages hosts **static files only** — no Python runtime on the server. The live site uses client-side simulated data; Python source remains in the repo for development and review.

1. Build the static site:
   ```bash
   python build.py
   ```
2. Push the repository (include the `docs/` folder).
3. Enable Pages: **Settings → Pages →** branch **`main`**, folder **`/docs`**.

Live URL: `https://<username>.github.io/<repo-name>/`

**First push to a new repo:**

```bash
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main
```

After editing `static/` or `templates/`, run `python build.py` again before pushing.

---

## API endpoints (local only)

| Endpoint | Description |
|----------|-------------|
| `GET /api/telemetry` | Ground station sensor readings |
| `GET /api/orbit` | Satellite position and pass countdown |
| `GET /api/satellites` | Tracked satellite catalog |

---

## Notes

- **Online demo:** Maps and fonts load from CDNs; an internet connection is required.
- **Legacy file:** `vidyajyoti-tracker.html` is a single-file backup of an earlier version.
- **Production backend:** Not required for the hosted demo. Use Render or similar only if you later connect real telemetry or a database.
