"""
Traffic page — detector locations and traffic intensity / speed trends.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, Query

from services.data_loader import _DATA

router = APIRouter()


@router.get("/api/traffic/detectors")
def get_detectors():
    """List of all traffic detector stations."""
    td = _DATA.get("traffic_detectors", pd.DataFrame())
    if td.empty:
        return []
    return td.fillna("").to_dict(orient="records")


@router.get("/api/traffic/trend")
def get_traffic_trend(days: int = Query(default=30, ge=1, le=365)):
    """Daily vehicle counts and average speed for the past N days."""
    tm = _DATA.get("traffic_measurements", pd.DataFrame())
    if tm.empty or "measured_at" not in tm.columns:
        return []

    df = tm.copy()
    df["measured_at"] = pd.to_datetime(df["measured_at"], errors="coerce")
    df["intensity"] = pd.to_numeric(df["intensity"], errors="coerce").fillna(0)
    df["speed"] = pd.to_numeric(df["speed"], errors="coerce")
    df["date"] = df["measured_at"].dt.date

    if not df["measured_at"].isna().all():
        cutoff = df["measured_at"].max() - pd.Timedelta(days=days)
        df = df.loc[df["measured_at"] >= cutoff]

    agg = df.groupby("date").agg(
        vehicles=("intensity", "sum"),
        avg_speed=("speed", "mean"),
    ).reset_index()
    agg["avg_speed"] = agg["avg_speed"].round(1)
    agg = agg.sort_values("date")

    return [
        {
            "date": str(row["date"]),
            "vehicles": int(row["vehicles"]),
            "avg_speed": float(row["avg_speed"]) if pd.notna(row["avg_speed"]) else None,
        }
        for _, row in agg.iterrows()
    ]


@router.get("/api/traffic/by-detector")
def get_traffic_by_detector(days: int = Query(default=30, ge=1, le=365)):
    """Total vehicle counts and avg speed per detector for the past N days."""
    tm = _DATA.get("traffic_measurements", pd.DataFrame())
    td = _DATA.get("traffic_detectors", pd.DataFrame())

    if tm.empty or "detector_id" not in tm.columns:
        return []

    df = tm.copy()
    df["measured_at"] = pd.to_datetime(df["measured_at"], errors="coerce")
    df["intensity"] = pd.to_numeric(df["intensity"], errors="coerce").fillna(0)
    df["speed"] = pd.to_numeric(df["speed"], errors="coerce")

    if not df["measured_at"].isna().all():
        cutoff = df["measured_at"].max() - pd.Timedelta(days=days)
        df = df.loc[df["measured_at"] >= cutoff]

    agg = df.groupby("detector_id").agg(
        total_vehicles=("intensity", "sum"),
        avg_speed=("speed", "mean"),
    ).reset_index()
    agg["total_vehicles"] = agg["total_vehicles"].astype(int)
    agg["avg_speed"] = agg["avg_speed"].round(1)

    if not td.empty and "id" in td.columns:
        td_slim = td[["id"] + [c for c in ["name", "latitude", "longitude", "road"] if c in td.columns]]
        td_slim = td_slim.rename(columns={"id": "detector_id"})
        agg = agg.merge(td_slim, on="detector_id", how="left")

    return agg.fillna("").sort_values("total_vehicles", ascending=False).to_dict(orient="records")


@router.get("/api/traffic/hourly")
def get_traffic_hourly(days: int = Query(default=7, ge=1, le=30)):
    """Average vehicle intensity by hour of day for the past N days."""
    tm = _DATA.get("traffic_measurements", pd.DataFrame())
    if tm.empty or "measured_at" not in tm.columns:
        return []

    df = tm.copy()
    df["measured_at"] = pd.to_datetime(df["measured_at"], errors="coerce")
    df["intensity"] = pd.to_numeric(df["intensity"], errors="coerce").fillna(0)
    df["hour"] = df["measured_at"].dt.hour

    if not df["measured_at"].isna().all():
        cutoff = df["measured_at"].max() - pd.Timedelta(days=days)
        df = df.loc[df["measured_at"] >= cutoff]

    grouped = df.groupby("hour")["intensity"].mean().reset_index()
    grouped = grouped.rename(columns={"intensity": "avg_vehicles"})
    grouped["avg_vehicles"] = grouped["avg_vehicles"].round(1)

    return grouped.sort_values("hour").to_dict(orient="records")
