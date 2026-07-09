"""Bundled TLE lines so orbit APIs work without outbound CelesTrak on cold start."""

from typing import Any

# Updated 2026-06-18 — amateur-group CelesTrak GP elements
TLE_BY_NORAD: dict[int, dict[str, str]] = {
    32791: {
        "name": "VO-52",
        "line1": "1 32791U 08021J   26168.52727106  .00014659  00000+0  46558-3 0  9991",
        "line2": "2 32791  97.7515 166.4411 0001013   2.1401 357.9844 15.32761121987344",
    },
    27607: {
        "name": "SO-50",
        "line1": "1 27607U 02058C   26168.89705227  .00000776  00000+0  10901-3 0  9993",
        "line2": "2 27607  64.5511 126.7887 0075200 262.3451  96.9110 14.83048298264568",
    },
    22825: {
        "name": "AO-27",
        "line1": "1 22825U 93061C   26168.76903799  .00000075  00000+0  45510-4 0  9991",
        "line2": "2 22825  98.6881 236.1824 0009541  98.2958 261.9307 14.30942422707088",
    },
    24278: {
        "name": "FO-29",
        "line1": "1 24278U 96046B   26168.53292174 -.00000001  00000+0  31612-4 0  9992",
        "line2": "2 24278  98.5239  17.3577 0350906  95.5376 268.5887 13.53274425473216",
    },
    36122: {
        "name": "HO-68",
        "line1": "1 36122U 09072B   26168.92787475  .00000131  00000+0  46070-3 0  9998",
        "line2": "2 36122 100.4030 122.7487 0006862 229.8560 130.1952 13.16439165793109",
    },
    43111: {
        "name": "CARTOSAT-2F",
        "line1": "1 43111U 18004A   26188.56064297  .00006056  00000+0  29061-3 0  9994",
        "line2": "2 43111  97.4776 247.9958 0002116 150.9562 209.1791 15.19238236470420",
    },
    44233: {
        "name": "RISAT-2B",
        "line1": "1 44233U 19028A   26188.56445720  .00001724  00000+0  13595-3 0  9993",
        "line2": "2 44233  36.9962 233.2239 0005299 213.8538 146.1867 15.01777033390898",
    },
    40697: {
        "name": "SENTINEL-2A",
        "line1": "1 40697U 15028A   26188.56433306  .00000170  00000+0  81634-4 0  9990",
        "line2": "2 40697  98.5673 263.1268 0001240  95.2843 264.8482 14.30821730576643",
    },
    41877: {
        "name": "RESOURCESAT-2A",
        "line1": "1 41877U 16074A   26188.62244933  .00000331  00000+0  17095-3 0  9994",
        "line2": "2 41877  98.7516 261.9597 0002812  44.1412 315.9990 14.21608143497201",
    },
}


def fallback_tle(norad_id: int) -> dict[str, str] | None:
    entry = TLE_BY_NORAD.get(norad_id)
    if not entry:
        return None
    return dict(entry)


def catalog_for_frontend() -> list[dict[str, Any]]:
    """Same shape as /api/satellites entries with bundled TLE."""
    from services.tle import SATELLITE_CATALOG

    rows: list[dict[str, Any]] = []
    for sat in SATELLITE_CATALOG:
        entry: dict[str, Any] = {
            "name": sat["name"],
            "norad_id": sat["norad_id"],
            "color": sat["color"],
            "is_simulated": sat["is_simulated"],
            "tle_available": False,
            "line1": None,
            "line2": None,
            "tle_name": None,
            "status": "simulated" if sat["is_simulated"] else "unknown",
        }
        if sat["is_simulated"]:
            rows.append(entry)
            continue
        tle = fallback_tle(sat["norad_id"])
        if tle:
            entry["tle_available"] = True
            entry["line1"] = tle["line1"]
            entry["line2"] = tle["line2"]
            entry["tle_name"] = tle["name"]
            entry["status"] = "active"
        rows.append(entry)
    return rows
