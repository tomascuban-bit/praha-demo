"""
Map data endpoint — all geo-located stations with latest values for the interactive map.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA

router = APIRouter()


@router.get("/api/map-data")
def get_map_data():
    """
    All station locations with their most recent metric values.
    Used by the frontend Leaflet map to render layer markers.
    """
    result: dict[str, list] = {
        "bicycle_counters": [],
        "traffic_detectors": [],
        "air_quality": [],
    }

    # ── Bicycle counters with 7-day counts ───────────────────────────────────
    bc = _DATA.get("bicycle_counters", pd.DataFrame())
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())

    if not bc.empty:
        bc_df = bc.copy()
        bc_df["latitude"] = pd.to_numeric(bc_df.get("latitude"), errors="coerce")
        bc_df["longitude"] = pd.to_numeric(bc_df.get("longitude"), errors="coerce")
        bc_df = bc_df.dropna(subset=["latitude", "longitude"])

        counts_7d: dict[str, int] = {}
        if not bm.empty and "measured_from" in bm.columns:
            bm_df = bm.copy()
            bm_df["measured_from"] = pd.to_datetime(bm_df["measured_from"], errors="coerce")
            bm_df["total_count"] = pd.to_numeric(bm_df["total_count"], errors="coerce").fillna(0)
            if not bm_df["measured_from"].isna().all():
                cutoff = bm_df["measured_from"].max() - pd.Timedelta(days=7)
                recent = bm_df[bm_df["measured_from"] >= cutoff]
                counts_7d = recent.groupby("counter_id")["total_count"].sum().astype(int).to_dict()

        for _, row in bc_df.iterrows():
            result["bicycle_counters"].append({
                "id": row.get("id", ""),
                "name": row.get("name", ""),
                "lat": float(row["latitude"]),
                "lon": float(row["longitude"]),
                "route": row.get("route", ""),
                "count_7d": counts_7d.get(str(row.get("id", "")), 0),
            })

    # ── Traffic detectors with latest intensity ───────────────────────────────
    td = _DATA.get("traffic_detectors", pd.DataFrame())
    tm = _DATA.get("traffic_measurements", pd.DataFrame())

    if not td.empty:
        td_df = td.copy()
        td_df["latitude"] = pd.to_numeric(td_df.get("latitude"), errors="coerce")
        td_df["longitude"] = pd.to_numeric(td_df.get("longitude"), errors="coerce")
        td_df = td_df.dropna(subset=["latitude", "longitude"])

        latest_intensity: dict[str, int] = {}
        latest_speed: dict[str, float] = {}
        if not tm.empty and "detector_id" in tm.columns:
            tm_df = tm.copy()
            tm_df["intensity"] = pd.to_numeric(tm_df["intensity"], errors="coerce").fillna(0)
            tm_df["speed"] = pd.to_numeric(tm_df["speed"], errors="coerce")
            agg = tm_df.groupby("detector_id").agg(
                intensity=("intensity", "sum"),
                speed=("speed", "mean"),
            ).reset_index()
            latest_intensity = agg.set_index("detector_id")["intensity"].astype(int).to_dict()
            latest_speed = agg.set_index("detector_id")["speed"].round(1).to_dict()

        for _, row in td_df.iterrows():
            det_id = str(row.get("id", ""))
            result["traffic_detectors"].append({
                "id": det_id,
                "name": row.get("name", ""),
                "lat": float(row["latitude"]),
                "lon": float(row["longitude"]),
                "road": row.get("road", ""),
                "intensity": latest_intensity.get(det_id, 0),
                "avg_speed": latest_speed.get(det_id, None),
            })

    # ── Air quality stations ──────────────────────────────────────────────────
    aq = _DATA.get("air_quality_stations", pd.DataFrame())

    if not aq.empty:
        aq_df = aq.copy()
        aq_df["latitude"] = pd.to_numeric(aq_df.get("latitude"), errors="coerce")
        aq_df["longitude"] = pd.to_numeric(aq_df.get("longitude"), errors="coerce")
        aq_df["aq_index"] = pd.to_numeric(aq_df.get("aq_index"), errors="coerce")
        aq_df = aq_df.dropna(subset=["latitude", "longitude"])

        for _, row in aq_df.iterrows():
            aq_idx = row.get("aq_index")
            result["air_quality"].append({
                "id": row.get("id", ""),
                "name": row.get("name", ""),
                "lat": float(row["latitude"]),
                "lon": float(row["longitude"]),
                "district": row.get("district", ""),
                "aq_index": int(aq_idx) if pd.notna(aq_idx) else None,
                "updated_at": row.get("updated_at", ""),
            })

    return result
