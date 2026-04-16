"""
Cycling page — bicycle counter locations and measurement trends.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, Query

from services.data_loader import _DATA

router = APIRouter()


@router.get("/api/cycling/counters")
def get_counters():
    """List of all bicycle counter stations with metadata."""
    bc = _DATA.get("bicycle_counters", pd.DataFrame())
    if bc.empty:
        return []
    return bc.fillna("").to_dict(orient="records")


@router.get("/api/cycling/trend")
def get_cycling_trend(days: int = Query(default=30, ge=1, le=365)):
    """Daily cyclist counts for the past N days, grouped by counter."""
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())
    if bm.empty or "measured_from" not in bm.columns:
        return []

    df = bm.copy()
    df["measured_from"] = pd.to_datetime(df["measured_from"], errors="coerce")
    df["total_count"] = pd.to_numeric(df["total_count"], errors="coerce").fillna(0)
    df["date"] = df["measured_from"].dt.date

    if not df["measured_from"].isna().all():
        cutoff = df["measured_from"].max() - pd.Timedelta(days=days)
        df = df.loc[df["measured_from"] >= cutoff]

    grouped = df.groupby("date")["total_count"].sum().reset_index()
    grouped = grouped.sort_values("date")

    return [
        {"date": str(row["date"]), "cyclists": int(row["total_count"])}
        for _, row in grouped.iterrows()
    ]


@router.get("/api/cycling/by-counter")
def get_cycling_by_counter(days: int = Query(default=30, ge=1, le=365)):
    """Total counts per bicycle counter for the past N days."""
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())
    bc = _DATA.get("bicycle_counters", pd.DataFrame())

    if bm.empty or "counter_id" not in bm.columns:
        return []

    df = bm.copy()
    df["measured_from"] = pd.to_datetime(df["measured_from"], errors="coerce")
    df["total_count"] = pd.to_numeric(df["total_count"], errors="coerce").fillna(0)

    if not df["measured_from"].isna().all():
        cutoff = df["measured_from"].max() - pd.Timedelta(days=days)
        df = df.loc[df["measured_from"] >= cutoff]

    grouped = df.groupby("counter_id")["total_count"].sum().reset_index()
    grouped = grouped.rename(columns={"total_count": "total_cyclists"})
    grouped["total_cyclists"] = grouped["total_cyclists"].astype(int)

    # Join with counter metadata for name/location
    if not bc.empty and "id" in bc.columns:
        bc_slim = bc[["id"] + [c for c in ["name", "latitude", "longitude", "route"] if c in bc.columns]]
        bc_slim = bc_slim.rename(columns={"id": "counter_id"})
        grouped = grouped.merge(bc_slim, on="counter_id", how="left")

    return grouped.fillna("").sort_values("total_cyclists", ascending=False).to_dict(orient="records")


@router.get("/api/cycling/hourly")
def get_cycling_hourly(days: int = Query(default=7, ge=1, le=30)):
    """Average cyclist count by hour of day (for the past N days)."""
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())
    if bm.empty or "measured_from" not in bm.columns:
        return []

    df = bm.copy()
    df["measured_from"] = pd.to_datetime(df["measured_from"], errors="coerce")
    df["total_count"] = pd.to_numeric(df["total_count"], errors="coerce").fillna(0)
    df["hour"] = df["measured_from"].dt.hour

    if not df["measured_from"].isna().all():
        cutoff = df["measured_from"].max() - pd.Timedelta(days=days)
        df = df.loc[df["measured_from"] >= cutoff]

    grouped = df.groupby("hour")["total_count"].mean().reset_index()
    grouped = grouped.rename(columns={"total_count": "avg_cyclists"})
    grouped["avg_cyclists"] = grouped["avg_cyclists"].round(1)

    return grouped.sort_values("hour").to_dict(orient="records")
