"""
Parkování — obsazenost P+R parkovišť TSK Praha.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA

router = APIRouter()

# Coordinates and names for Prague TSK P+R lots (from Golemio /v3/parking/{id})
# 7 of the 17 lots return null centroid from Golemio — omitted from map layer
PARKING_LOCATIONS: dict[str, dict] = {
    "tsk-offstreet-f589ef8e-1209-4793-87ba-7e405839f506": {"lat": 50.0532, "lon": 14.2913, "name": "P+R Zličín 1"},
    "tsk-offstreet-360e4af6-3a4e-433b-49bb-cbb4c773f9cf": {"lat": 50.0546, "lon": 14.2898, "name": "P+R Zličín 2"},
    "tsk-offstreet-67000fcd-d2d1-4861-8de1-4afd35c706c0": {"lat": 50.0521, "lon": 14.3500, "name": "P+R Nové Butovice"},
    "tsk-offstreet-0de6185c-f3a8-4ce6-b684-bdb6d95fe737": {"lat": 50.0612, "lon": 14.4293, "name": "P+R Kongresové centrum"},
    "tsk-offstreet-4145ef72-c325-41c9-8b34-2af23290f942": {"lat": 50.0385, "lon": 14.4770, "name": "P+R Opatov"},
    "tsk-offstreet-b567b2eb-b89c-4549-846a-e82cbda1dcf9": {"lat": 50.0704, "lon": 14.5116, "name": "P+R Skalka 1"},
    "tsk-offstreet-bba3106f-e408-466f-8f75-bbd919ee4efa": {"lat": 50.0708, "lon": 14.5122, "name": "P+R Skalka 2"},
    "tsk-offstreet-58b9c5cc-02e0-468d-b8a6-a3e49a528025": {"lat": 50.1070, "lon": 14.5627, "name": "P+R Rajská zahrada"},
    "tsk-offstreet-8d125ea8-8f76-4045-4792-f6edb76e73f6": {"lat": 50.1100, "lon": 14.5790, "name": "P+R Černý Most"},
    "tsk-offstreet-f01831c1-415d-463d-b51f-1a91ba7bd4ed": {"lat": 50.0986, "lon": 14.4165, "name": "P+R Holešovice"},
}


def _pk() -> pd.DataFrame:
    pk = _DATA.get("parking_occupancy", pd.DataFrame())
    if pk.empty:
        return pk
    df = pk.copy()
    if "source" in df.columns:
        df = df[df["source"] == "tsk-offstreet"]
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
            "label":         "TSK Praha (P+R parkoviště)",
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
            "label":         "TSK Praha",
            "name":          PARKING_LOCATIONS.get(row["parking_id"], {}).get("name", ""),
            "total_spots":   int(row["total_spots"]),
            "free_spots":    int(row["free_spots"]),
            "occupied_spots": int(row.get("occupied_spots", 0)),
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
        ("0–25 % obsazeno",    0,  25),
        ("25–50 % obsazeno",  25,  50),
        ("50–75 % obsazeno",  50,  75),
        ("75–90 % obsazeno",  75,  90),
        ("90–100 % obsazeno", 90, 101),
    ]

    return [
        {
            "bucket":      label,
            "lot_count":   int(((df["pct_full"] >= lo) & (df["pct_full"] < hi)).sum()),
            "total_spots": int(df.loc[(df["pct_full"] >= lo) & (df["pct_full"] < hi), "total_spots"].sum()),
        }
        for label, lo, hi in buckets
    ]
