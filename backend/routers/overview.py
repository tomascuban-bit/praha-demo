"""
Overview page — city-wide KPIs and trends for Praha Demo.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA

router = APIRouter()

_AQ_LABELS = {1: "Excellent", 2: "Very Good", 3: "Good", 4: "Satisfactory", 5: "Poor", 6: "Bad", 7: "Very Bad"}


def _safe_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce").fillna(0) if col in df.columns else pd.Series(dtype=float)


@router.get("/api/kpis")
def get_kpis():
    """City-wide KPI cards for the Overview page."""
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())
    tm = _DATA.get("traffic_measurements", pd.DataFrame())
    bc = _DATA.get("bicycle_counters", pd.DataFrame())
    td = _DATA.get("traffic_detectors", pd.DataFrame())
    _ = _AQ_LABELS  # referenced in KPI description

    aq = _DATA.get("air_quality_stations", pd.DataFrame())
    pk = _DATA.get("parking_occupancy", pd.DataFrame())

    total_cyclists = int(_safe_numeric(bm, "total_count").sum()) if not bm.empty else 0
    total_vehicles = int(_safe_numeric(tm, "intensity").sum()) if not tm.empty else 0
    avg_speed = round(float(_safe_numeric(tm, "speed").mean()), 1) if not tm.empty else 0.0
    num_counters = len(bc) if not bc.empty else 0
    num_detectors = len(td) if not td.empty else 0

    # Daily trend: last 7 days cyclists + pedestrians
    daily_cyclists = 0
    daily_pedestrians = 0
    if not bm.empty and "measured_from" in bm.columns:
        bm_copy = bm.copy()
        bm_copy["measured_from"] = pd.to_datetime(bm_copy["measured_from"], errors="coerce")
        bm_copy["total_count"] = _safe_numeric(bm_copy, "total_count")
        bm_copy["total_pedestrians"] = _safe_numeric(bm_copy, "total_pedestrians")
        if not bm_copy["measured_from"].isna().all():
            cutoff = bm_copy["measured_from"].max() - pd.Timedelta(days=7)
            recent = bm_copy.loc[bm_copy["measured_from"] >= cutoff]
            daily_cyclists = int(recent["total_count"].sum())
            daily_pedestrians = int(recent["total_pedestrians"].sum())

    # Air quality: average AQ index across all reporting stations
    avg_aq_index = None
    if not aq.empty and "aq_index" in aq.columns:
        aq_vals = pd.to_numeric(aq["aq_index"], errors="coerce").dropna()
        if len(aq_vals) > 0:
            avg_aq_index = round(float(aq_vals.mean()), 1)

    # Parking: city-wide free spot pct
    parking_pct_free = None
    parking_free = None
    parking_total = None
    if not pk.empty:
        total_spots = pd.to_numeric(pk.get("total_spots", pd.Series()), errors="coerce").fillna(0).sum()
        free_spots = pd.to_numeric(pk.get("free_spots", pd.Series()), errors="coerce").fillna(0).sum()
        if total_spots > 0:
            parking_pct_free = round(float(free_spots) / float(total_spots) * 100, 1)
            parking_free = int(free_spots)
            parking_total = int(total_spots)

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
            "label": "Pedestrians (7 Days)",
            "value": daily_pedestrians,
            "description": "Pedestrian passages at bicycle counter locations in the last 7 days",
            "formula": "SUM(total_pedestrians) WHERE measured_from >= max_date - 7d",
            "sources": ["bicycle_measurements"],
            "icon": "walk",
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
        {
            "label": "Avg Air Quality Index",
            "value": avg_aq_index,
            "description": "Average AQ hourly index across all CHMI monitoring stations (1=excellent, 7=very poor; null=no data)",
            "formula": "AVG(aq_index) from air_quality_stations WHERE aq_index IS NOT NULL",
            "sources": ["air_quality_stations"],
            "icon": "air",
        },
        {
            "label": "Parking Availability",
            "value": parking_pct_free,
            "description": f"{parking_free} of {parking_total} monitored parking spots currently free" if parking_free is not None else "No parking data",
            "formula": "SUM(free_spots)/SUM(total_spots)*100 from parking_occupancy",
            "sources": ["parking_occupancy"],
            "icon": "parking",
            "unit": "%",
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
