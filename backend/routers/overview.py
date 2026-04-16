"""
Overview page — city-wide KPIs and trends for Praha Demo.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA

router = APIRouter()


def _safe_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce").fillna(0) if col in df.columns else pd.Series(dtype=float)


@router.get("/api/kpis")
def get_kpis():
    """City-wide KPI cards for the Overview page."""
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())
    tm = _DATA.get("traffic_measurements", pd.DataFrame())
    bc = _DATA.get("bicycle_counters", pd.DataFrame())
    td = _DATA.get("traffic_detectors", pd.DataFrame())

    total_cyclists = int(_safe_numeric(bm, "total_count").sum()) if not bm.empty else 0
    total_vehicles = int(_safe_numeric(tm, "intensity").sum()) if not tm.empty else 0
    avg_speed = round(float(_safe_numeric(tm, "speed").mean()), 1) if not tm.empty else 0.0
    num_counters = len(bc) if not bc.empty else 0
    num_detectors = len(td) if not td.empty else 0

    # Daily trend: last 7 days cyclists
    daily_cyclists = 0
    if not bm.empty and "measured_from" in bm.columns:
        bm_copy = bm.copy()
        bm_copy["measured_from"] = pd.to_datetime(bm_copy["measured_from"], errors="coerce")
        bm_copy["total_count"] = _safe_numeric(bm_copy, "total_count")
        if not bm_copy["measured_from"].isna().all():
            cutoff = bm_copy["measured_from"].max() - pd.Timedelta(days=7)
            daily_cyclists = int(bm_copy.loc[bm_copy["measured_from"] >= cutoff, "total_count"].sum())

    return [
        {
            "label": "Total Cyclists Counted",
            "value": total_cyclists,
            "description": "Cumulative bicycle passages across all Golemio counters",
            "formula": "SUM(total_count) from bicycle_measurements",
            "sources": ["bicycle_measurements"],
            "icon": "bike",
        },
        {
            "label": "Last 7 Days Cyclists",
            "value": daily_cyclists,
            "description": "Bicycle passages in the most recent 7-day window",
            "formula": "SUM(total_count) WHERE measured_from >= max_date - 7d",
            "sources": ["bicycle_measurements"],
            "icon": "trend",
        },
        {
            "label": "Total Vehicle Passages",
            "value": total_vehicles,
            "description": "Total vehicle intensities recorded across all traffic detectors",
            "formula": "SUM(intensity) from traffic_measurements",
            "sources": ["traffic_measurements"],
            "icon": "car",
        },
        {
            "label": "Avg Traffic Speed",
            "value": avg_speed,
            "description": "Average vehicle speed across all measurement periods (km/h)",
            "formula": "AVG(speed) from traffic_measurements",
            "sources": ["traffic_measurements"],
            "icon": "speed",
        },
        {
            "label": "Bicycle Counters",
            "value": num_counters,
            "description": "Number of active Golemio bicycle counter stations",
            "formula": "COUNT(*) from bicycle_counters",
            "sources": ["bicycle_counters"],
            "icon": "sensor",
        },
        {
            "label": "Traffic Detectors",
            "value": num_detectors,
            "description": "Number of active traffic measurement stations in Prague",
            "formula": "COUNT(*) from traffic_detectors",
            "sources": ["traffic_detectors"],
            "icon": "sensor",
        },
    ]


@router.get("/api/overview-chart")
def get_overview_chart():
    """Daily cyclists vs vehicles trend for the overview line chart."""
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())
    tm = _DATA.get("traffic_measurements", pd.DataFrame())

    result: dict[str, dict] = {}

    if not bm.empty and "measured_from" in bm.columns:
        bm_copy = bm.copy()
        bm_copy["date"] = pd.to_datetime(bm_copy["measured_from"], errors="coerce").dt.date.astype(str)
        bm_copy["total_count"] = pd.to_numeric(bm_copy["total_count"], errors="coerce").fillna(0)
        daily = bm_copy.groupby("date")["total_count"].sum().reset_index()
        for _, row in daily.iterrows():
            result.setdefault(str(row["date"]), {})["cyclists"] = int(row["total_count"])

    if not tm.empty and "measured_at" in tm.columns:
        tm_copy = tm.copy()
        tm_copy["date"] = pd.to_datetime(tm_copy["measured_at"], errors="coerce").dt.date.astype(str)
        tm_copy["intensity"] = pd.to_numeric(tm_copy["intensity"], errors="coerce").fillna(0)
        daily = tm_copy.groupby("date")["intensity"].sum().reset_index()
        for _, row in daily.iterrows():
            result.setdefault(str(row["date"]), {})["vehicles"] = int(row["intensity"])

    return [
        {
            "date": date,
            "cyclists": vals.get("cyclists", 0),
            "vehicles": vals.get("vehicles", 0),
        }
        for date, vals in sorted(result.items())
    ]
