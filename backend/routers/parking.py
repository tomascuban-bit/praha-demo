"""
Parkování — obsazenost P+R parkovišť TSK Praha.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA

router = APIRouter()

# Coordinates and names for all 17 Prague TSK P+R lots (from Golemio /v3/parking/{id})
PARKING_LOCATIONS: dict[str, dict] = {
    "tsk-offstreet-6b737fe9-6f24-450c-9868-819cb9377ad8": {"lat": 50.109993, "lon": 14.578965, "name": "P+R Garáže Černý Most"},
    "tsk-offstreet-f589ef8e-1209-4793-87ba-7e405839f506": {"lat": 50.061188, "lon": 14.429288, "name": "P+R Kongresové centrum Praha"},
    "tsk-offstreet-67000fcd-d2d1-4861-8de1-4afd35c706c0": {"lat": 50.081032, "lon": 14.433357, "name": "Muzeum"},
    "tsk-offstreet-b567b2eb-b89c-4549-846a-e82cbda1dcf9": {"lat": 50.098620, "lon": 14.416533, "name": "Letná"},
    "tsk-offstreet-58b9c5cc-02e0-468d-b8a6-a3e49a528025": {"lat": 50.052086, "lon": 14.349985, "name": "P+R Nové Butovice"},
    "tsk-offstreet-bba3106f-e408-466f-8f75-bbd919ee4efa": {"lat": 50.068458, "lon": 14.357180, "name": "P+R Kotlářka"},
    "tsk-offstreet-4145ef72-c325-41c9-8b34-2af23290f942": {"lat": 50.110351, "lon": 14.582407, "name": "P+R Černý most 2"},
    "tsk-offstreet-f01831c1-415d-463d-b51f-1a91ba7bd4ed": {"lat": 50.026619, "lon": 14.509140, "name": "P+R Opatov"},
    "tsk-offstreet-0de6185c-f3a8-4ce6-b684-bdb6d95fe737": {"lat": 50.038511, "lon": 14.476998, "name": "P+R Roztyly"},
    "tsk-offstreet-52551797-f7f0-44e0-8e06-988c96ab319f": {"lat": 50.069501, "lon": 14.507758, "name": "P+R Skalka 1"},
    "tsk-offstreet-0a25bd51-0851-4766-b884-e5bf8cf0aac7": {"lat": 50.054594, "lon": 14.289794, "name": "P+R Zličín 1"},
    "tsk-offstreet-519a4124-9f6c-49c9-89f3-da28b8192ca1": {"lat": 50.107008, "lon": 14.562708, "name": "P+R Rajská zahrada"},
    "tsk-offstreet-ae77736b-399d-462e-901d-bf91ef7ab96c": {"lat": 50.070360, "lon": 14.511567, "name": "P+R Skalka 2"},
    "tsk-offstreet-8f1abd57-4366-41a3-b800-3604400a1ec0": {"lat": 50.108952, "lon": 14.441237, "name": "P+R Holešovice"},
    "tsk-offstreet-eef53536-16f5-4772-b28e-466e9d4fa6c1": {"lat": 50.053156, "lon": 14.291256, "name": "P+R Zličín 2"},
    "tsk-offstreet-8d125ea8-8f76-4045-4792-f6edb76e73f6": {"lat": 50.083408, "lon": 14.434139, "name": "Hlavní nádraží – Terasa"},
    "tsk-offstreet-360e4af6-3a4e-433b-49bb-cbb4c773f9cf": {"lat": 50.082692, "lon": 14.434147, "name": "Hlavní nádraží – jih"},
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
