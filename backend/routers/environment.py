"""
Environment page — air quality and parking data for Praha Demo.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA

router = APIRouter()


def _safe_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce").fillna(0) if col in df.columns else pd.Series(dtype=float)


@router.get("/api/environment/parking")
def get_parking():
    """Current parking occupancy across all monitored lots."""
    pk = _DATA.get("parking_occupancy", pd.DataFrame())
    if pk.empty:
        return {"summary": {}, "lots": []}

    df = pk.copy()
    for col in ["total_spots", "free_spots", "occupied_spots"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

    total = int(df["total_spots"].sum())
    free = int(df["free_spots"].sum())
    occupied = int(df["occupied_spots"].sum())
    pct_free = round(free / total * 100, 1) if total > 0 else 0.0

    lots = df.fillna("").to_dict(orient="records")

    return {
        "summary": {
            "total_spots": total,
            "free_spots": free,
            "occupied_spots": occupied,
            "pct_free": pct_free,
            "num_lots": len(df),
        },
        "lots": lots,
    }
