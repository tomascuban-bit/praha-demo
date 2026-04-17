"""
Parking page — occupancy dashboard across Czech city operators.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA

router = APIRouter()

SOURCE_LABELS: dict[str, str] = {
    "tsk-offstreet": "TSK Prague (garages)",
    "korid":         "KORID (Liberec)",
    "smart4city":    "Smart4City (Prague P+R)",
    "isphk":         "ISP (Hradec Králové)",
    "bedrichov":     "Bedřichov (ski resort)",
    "pmdp":          "PMDP (Pilsen)",
    "greencenter":   "Green Center",
    "mr_parkit":     "Mr. Parkit",
}


def _pk() -> pd.DataFrame:
    pk = _DATA.get("parking_occupancy", pd.DataFrame())
    if pk.empty:
        return pk
    df = pk.copy()
    for col in ["total_spots", "free_spots", "occupied_spots"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)
    df = df[df["total_spots"] > 0]
    df["pct_full"] = (df["occupied_spots"] / df["total_spots"] * 100).round(1)
    return df


@router.get("/api/parking/summary")
def parking_summary():
    df = _pk()
    if df.empty:
        return {"total_lots": 0, "total_spots": 0, "free_spots": 0, "occupied_spots": 0,
                "pct_free": 0.0, "lots_full": 0, "lots_available": 0, "lots_empty": 0}

    total_spots = int(df["total_spots"].sum())
    free_spots = int(df["free_spots"].sum())
    occupied_spots = int(df["occupied_spots"].sum())
    pct_free = round(free_spots / total_spots * 100, 1) if total_spots else 0.0

    return {
        "total_lots":     len(df),
        "total_spots":    total_spots,
        "free_spots":     free_spots,
        "occupied_spots": occupied_spots,
        "pct_free":       pct_free,
        "lots_full":      int((df["pct_full"] >= 90).sum()),
        "lots_available": int(((df["pct_full"] >= 25) & (df["pct_full"] < 90)).sum()),
        "lots_empty":     int((df["pct_full"] < 25).sum()),
    }


@router.get("/api/parking/by-operator")
def parking_by_operator():
    df = _pk()
    if df.empty:
        return []

    grouped = df.groupby("source").agg(
        lot_count=("parking_id", "count"),
        total_spots=("total_spots", "sum"),
        free_spots=("free_spots", "sum"),
        occupied_spots=("occupied_spots", "sum"),
    ).reset_index()

    grouped["pct_full"] = (grouped["occupied_spots"] / grouped["total_spots"] * 100).round(1)

    return [
        {
            "source":        row["source"],
            "label":         SOURCE_LABELS.get(row["source"], row["source"]),
            "lot_count":     int(row["lot_count"]),
            "total_spots":   int(row["total_spots"]),
            "free_spots":    int(row["free_spots"]),
            "occupied_spots": int(row["occupied_spots"]),
            "pct_full":      float(row["pct_full"]),
        }
        for _, row in grouped.sort_values("total_spots", ascending=False).iterrows()
    ]


@router.get("/api/parking/lots")
def parking_lots():
    df = _pk()
    if df.empty:
        return []

    return [
        {
            "parking_id":    row["parking_id"],
            "source":        row["source"],
            "label":         SOURCE_LABELS.get(row["source"], row["source"]),
            "total_spots":   int(row["total_spots"]),
            "free_spots":    int(row["free_spots"]),
            "occupied_spots": int(row["occupied_spots"]),
            "pct_full":      float(row["pct_full"]),
            "has_free_spots": bool(row.get("has_free_spots", True)),
            "last_updated":  str(row.get("last_updated", "")),
        }
        for _, row in df.sort_values("pct_full", ascending=False).iterrows()
    ]


@router.get("/api/parking/distribution")
def parking_distribution():
    df = _pk()
    if df.empty:
        return []

    buckets = [
        ("0–25% full",   0,  25),
        ("25–50% full", 25,  50),
        ("50–75% full", 50,  75),
        ("75–90% full", 75,  90),
        ("90–100% full", 90, 101),
    ]

    return [
        {
            "bucket":      label,
            "lot_count":   int(((df["pct_full"] >= lo) & (df["pct_full"] < hi)).sum()),
            "total_spots": int(df.loc[(df["pct_full"] >= lo) & (df["pct_full"] < hi), "total_spots"].sum()),
        }
        for label, lo, hi in buckets
    ]
