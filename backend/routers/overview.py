"""
Přehled — celostátní KPI a trendy pro Praha Demo.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from services.data_loader import _DATA

router = APIRouter()


def _safe_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce").fillna(0) if col in df.columns else pd.Series(dtype=float)


@router.get("/api/kpis")
def get_kpis():
    """KPI karty pro stránku Přehled."""
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())
    bc = _DATA.get("bicycle_counters", pd.DataFrame())
    pk = _DATA.get("parking_occupancy", pd.DataFrame())

    total_cyclists = int(_safe_numeric(bm, "total_count").sum()) if not bm.empty else 0
    num_counters = len(bc) if not bc.empty else 0

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

    # Parkování — pouze TSK Praha P+R
    parking_pct_free = None
    parking_free = None
    parking_total = None
    if not pk.empty:
        pk_prg = pk[pk["source"] == "tsk-offstreet"] if "source" in pk.columns else pk
        total_spots = pd.to_numeric(pk_prg.get("total_spots", pd.Series()), errors="coerce").fillna(0).sum()
        free_spots = pd.to_numeric(pk_prg.get("free_spots", pd.Series()), errors="coerce").fillna(0).sum()
        if total_spots > 0:
            parking_pct_free = round(float(free_spots) / float(total_spots) * 100, 1)
            parking_free = int(free_spots)
            parking_total = int(total_spots)

    return [
        {
            "label": "Cyklisté celkem",
            "value": total_cyclists,
            "description": "Kumulativní počet průjezdů kol na všech počítadlech Golemio",
            "formula": "SUM(total_count) from bicycle_measurements",
            "sources": ["bicycle_measurements"],
            "icon": "bike",
        },
        {
            "label": "Cyklisté – posl. 7 dní",
            "value": daily_cyclists,
            "description": "Průjezdy kol v posledním 7denním okně",
            "formula": "SUM(total_count) WHERE measured_from >= max_date - 7d",
            "sources": ["bicycle_measurements"],
            "icon": "trend",
        },
        {
            "label": "Chodci – posl. 7 dní",
            "value": daily_pedestrians,
            "description": "Průjezdy chodců na lokalitách počítadel za posledních 7 dní",
            "formula": "SUM(total_pedestrians) WHERE measured_from >= max_date - 7d",
            "sources": ["bicycle_measurements"],
            "icon": "walk",
        },
        {
            "label": "Počítadla kol",
            "value": num_counters,
            "description": "Počet aktivních stanic počítadel kol Golemio v Praze",
            "formula": "COUNT(*) from bicycle_counters",
            "sources": ["bicycle_counters"],
            "icon": "sensor",
        },
        {
            "label": "Volné parkování",
            "value": parking_pct_free,
            "description": f"{parking_free} z {parking_total} míst volných v P+R parkovištích TSK Praha" if parking_free is not None else "Žádná data o parkování",
            "formula": "SUM(free_spots)/SUM(total_spots)*100 from parking_occupancy",
            "sources": ["parking_occupancy"],
            "icon": "parking",
            "unit": "%",
        },
    ]


@router.get("/api/overview-chart")
def get_overview_chart():
    """Denní trend cyklistů pro přehledový graf."""
    bm = _DATA.get("bicycle_measurements", pd.DataFrame())

    if bm.empty or "measured_from" not in bm.columns:
        return []

    bm_copy = bm.copy()
    bm_copy["date"] = pd.to_datetime(bm_copy["measured_from"], errors="coerce").dt.date.astype(str)
    bm_copy["total_count"] = pd.to_numeric(bm_copy["total_count"], errors="coerce").fillna(0)
    daily = bm_copy.groupby("date")["total_count"].sum().reset_index()

    return [
        {"date": str(row["date"]), "cyclists": int(row["total_count"])}
        for _, row in daily.sort_values("date").iterrows()
    ]
