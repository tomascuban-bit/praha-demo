"""
Pedestrian page — counts from the 6 shared bike/pedestrian path counters.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, Query

from services.data_loader import _DATA

router = APIRouter()

PEDESTRIAN_COUNTER_IDS = [
    "camea-BC_KA-KMML",
    "camea-BC_PN-VYBR",
    "camea-BC_CL-PVLI",
    "camea-BC_MB-PRVI",
    "camea-BC_ZA-KLBO",
    "camea-BC_KR-RAZB",
]


def _ped_df(days: int) -> pd.DataFrame:
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())
    if bm.empty or "measured_from" not in bm.columns:
        return pd.DataFrame()
    df = bm[bm["counter_id"].isin(PEDESTRIAN_COUNTER_IDS)].copy()
    df["measured_from"] = pd.to_datetime(df["measured_from"], errors="coerce")
    df["total_pedestrians"] = pd.to_numeric(df["total_pedestrians"], errors="coerce").fillna(0)
    df["total_count"] = pd.to_numeric(df["total_count"], errors="coerce").fillna(0)
    if not df["measured_from"].isna().all():
        cutoff = df["measured_from"].max() - pd.Timedelta(days=days)
        df = df.loc[df["measured_from"] >= cutoff]
    return df


@router.get("/api/pedestrian/kpis")
def get_pedestrian_kpis():
    df = _ped_df(7)
    if df.empty:
        return {
            "total_7d": 0, "avg_per_day": 0,
            "peak_hour": None, "active_counters": 0,
        }
    total = int(df["total_pedestrians"].sum())
    days_available = max(df["measured_from"].dt.date.nunique(), 1)
    avg = round(total / days_available)
    df["hour"] = df["measured_from"].dt.hour
    peak_hour = int(df.groupby("hour")["total_pedestrians"].sum().idxmax())
    active = int(df[df["total_pedestrians"] > 0]["counter_id"].nunique())
    return {
        "total_7d": total,
        "avg_per_day": avg,
        "peak_hour": peak_hour,
        "active_counters": active,
    }


@router.get("/api/pedestrian/trend")
def get_pedestrian_trend(days: int = Query(default=30, ge=1, le=365)):
    df = _ped_df(days)
    if df.empty:
        return []
    df["date"] = df["measured_from"].dt.date
    grouped = df.groupby("date")["total_pedestrians"].sum().reset_index()
    grouped = grouped.sort_values("date")
    return [
        {"date": str(r["date"]), "pedestrians": int(r["total_pedestrians"])}
        for _, r in grouped.iterrows()
    ]


@router.get("/api/pedestrian/by-counter")
def get_pedestrian_by_counter(days: int = Query(default=30, ge=1, le=365)):
    df = _ped_df(days)
    bc = _DATA.get("bicycle_counters", pd.DataFrame())
    if df.empty:
        return []
    grouped = df.groupby("counter_id")["total_pedestrians"].sum().reset_index()
    grouped = grouped.rename(columns={"total_pedestrians": "total_pedestrians"})
    grouped["total_pedestrians"] = grouped["total_pedestrians"].astype(int)
    if not bc.empty and "id" in bc.columns:
        bc_slim = bc[["id"] + [c for c in ["name", "route"] if c in bc.columns]].rename(columns={"id": "counter_id"})
        grouped = grouped.merge(bc_slim, on="counter_id", how="left")
    return grouped.fillna("").sort_values("total_pedestrians", ascending=False).to_dict(orient="records")


@router.get("/api/pedestrian/hourly")
def get_pedestrian_hourly(days: int = Query(default=7, ge=1, le=30)):
    df = _ped_df(days)
    if df.empty:
        return []
    df["hour"] = df["measured_from"].dt.hour
    grouped = df.groupby("hour")["total_pedestrians"].mean().reset_index()
    grouped["avg_pedestrians"] = grouped["total_pedestrians"].round(1)
    return grouped[["hour", "avg_pedestrians"]].sort_values("hour").to_dict(orient="records")


@router.get("/api/pedestrian/comparison")
def get_pedestrian_comparison(days: int = Query(default=30, ge=1, le=365)):
    """Daily cyclists vs pedestrians for the 6 shared-path counters."""
    df = _ped_df(days)
    if df.empty:
        return []
    df["date"] = df["measured_from"].dt.date
    grouped = df.groupby("date").agg(
        cyclists=("total_count", "sum"),
        pedestrians=("total_pedestrians", "sum"),
    ).reset_index().sort_values("date")
    return [
        {"date": str(r["date"]), "cyclists": int(r["cyclists"]), "pedestrians": int(r["pedestrians"])}
        for _, r in grouped.iterrows()
    ]
