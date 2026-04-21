"""
Map data endpoint — geo-located stations with latest values for the interactive map.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA
from routers.parking import PARKING_LOCATIONS, _pk as _parking_pk
from routers.pedestrian import PEDESTRIAN_COUNTER_IDS

router = APIRouter()


def _s(val) -> str:
    return "" if (val is None or (isinstance(val, float) and pd.isna(val))) else str(val)


def _f(val) -> float | None:
    return None if (val is None or (isinstance(val, float) and pd.isna(val))) else float(val)


@router.get("/api/map-data")
def get_map_data():
    result: dict[str, list] = {
        "bicycle_counters": [],
        "parking": [],
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
        ped_counts_7d: dict[str, int] = {}
        if not bm.empty and "measured_from" in bm.columns:
            bm_df = bm.copy()
            bm_df["measured_from"] = pd.to_datetime(bm_df["measured_from"], errors="coerce")
            bm_df["total_count"] = pd.to_numeric(bm_df["total_count"], errors="coerce").fillna(0)
            bm_df["total_pedestrians"] = pd.to_numeric(bm_df.get("total_pedestrians", 0), errors="coerce").fillna(0)
            if not bm_df["measured_from"].isna().all():
                cutoff = bm_df["measured_from"].max() - pd.Timedelta(days=7)
                recent = bm_df[bm_df["measured_from"] >= cutoff]
                counts_7d = recent.groupby("counter_id")["total_count"].sum().astype(int).to_dict()
                ped_counts_7d = (
                    recent[recent["counter_id"].isin(PEDESTRIAN_COUNTER_IDS)]
                    .groupby("counter_id")["total_pedestrians"].sum().astype(int).to_dict()
                )

        for _, row in bc_df.iterrows():
            cid = _s(row.get("id"))
            result["bicycle_counters"].append({
                "id": cid,
                "name": _s(row.get("name")),
                "lat": float(row["latitude"]),
                "lon": float(row["longitude"]),
                "route": _s(row.get("route")),
                "count_7d": counts_7d.get(cid, 0),
                "pedestrian_7d": ped_counts_7d.get(cid, 0),
                "has_pedestrian": cid in PEDESTRIAN_COUNTER_IDS,
            })

    # ── Prague P+R parking lots ───────────────────────────────────────────────
    pk_df = _parking_pk()
    if not pk_df.empty:
        for _, row in pk_df.iterrows():
            lot_id = _s(row.get("parking_id"))
            loc = PARKING_LOCATIONS.get(lot_id)
            if loc:
                result["parking"].append({
                    "parking_id":    lot_id,
                    "name":          loc["name"],
                    "lat":           loc["lat"],
                    "lon":           loc["lon"],
                    "total_spots":   int(row["total_spots"]),
                    "free_spots":    int(row["free_spots"]),
                    "occupied_spots": int(row.get("occupied_spots", 0)),
                    "pct_full":      float(row["pct_full"]),
                })

    return result
