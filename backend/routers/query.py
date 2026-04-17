"""
Sestavy — /api/data-schema a /api/query-data.
Umožňuje uživatelům sestavovat vlastní grafy z dat pražské mobility.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from services.data_loader import _DATA

router = APIRouter()

SCHEMA = {
    "bicycle_measurements": {
        "date_col": "measured_from",
        "dimensions": {"measured_from", "counter_id"},
        "measures": {"total_count": "sum", "direction_a": "sum", "direction_b": "sum"},
        "supports_period": False,
    },
}

LABEL_MAP: dict[str, str] = {
    "measured_from": "Datum/hodina",
    "counter_id":    "ID počítadla",
    "total_count":   "Celkem cyklistů",
    "direction_a":   "Směr A",
    "direction_b":   "Směr B",
}


def _fmt_number(val: object) -> str:
    if isinstance(val, float):
        return str(int(val)) if val == int(val) else f"{val:_.1f}".replace("_", "\u00a0")
    return str(val)

DATA_SCHEMA_RESPONSE = {
    "sources": [
        {
            "id": "bicycle_measurements",
            "label": "Cyklistická počítadla",
            "dimensions": [
                {"column": "measured_from", "label": "Datum/hodina", "is_date": True},
                {"column": "counter_id", "label": "ID počítadla", "is_date": False},
            ],
            "measures": [
                {"column": "total_count", "label": "Celkem cyklistů"},
                {"column": "direction_a", "label": "Směr A"},
                {"column": "direction_b", "label": "Směr B"},
            ],
            "supports_period": False,
        },
    ]
}


@router.get("/api/data-schema")
def get_data_schema():
    return DATA_SCHEMA_RESPONSE


@router.get("/api/query-data")
def query_data(
    source: str = Query(...),
    dimension: str = Query(...),
    measures: str = Query(...),
):
    if source not in SCHEMA:
        raise HTTPException(status_code=422, detail=f"Neplatný zdroj: {source}")
    schema = SCHEMA[source]
    if dimension not in schema["dimensions"]:
        raise HTTPException(status_code=422, detail=f"Neplatná dimenze '{dimension}'")
    measure_list = [m.strip() for m in measures.split(",") if m.strip()]
    if not measure_list:
        raise HTTPException(status_code=422, detail="Musí být zadán alespoň jeden ukazatel")
    invalid = [m for m in measure_list if m not in schema["measures"]]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Neplatné ukazatele: {invalid}")

    df = _DATA.get(source)
    if df is None or df.empty:
        return {"headers": [dimension] + measure_list, "rows": []}

    date_col = schema["date_col"]
    df = df.copy()
    if dimension == date_col:
        df[dimension] = pd.to_datetime(df[dimension], errors="coerce").dt.to_period("D").astype(str)

    for m in measure_list:
        df[m] = pd.to_numeric(df[m], errors="coerce").fillna(0)

    agg_dict = {m: schema["measures"][m] for m in measure_list}
    grouped = df.groupby(dimension, sort=True).agg(agg_dict).reset_index()

    friendly_headers = [LABEL_MAP.get(dimension, dimension)] + [LABEL_MAP.get(m, m) for m in measure_list]
    rows = [
        [str(r[dimension])] + [_fmt_number(r[m]) for m in measure_list]
        for _, r in grouped.iterrows()
    ]
    return {"headers": friendly_headers, "rows": rows}
