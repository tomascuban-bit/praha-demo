"""
Report Builder — /api/data-schema and /api/query-data endpoints.
Lets users build custom charts from Praha mobility data.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from services.data_loader import _DATA

router = APIRouter()

# Schema for the report builder UI
SCHEMA = {
    "bicycle_measurements": {
        "date_col": "measured_from",
        "dimensions": {"measured_from", "counter_id"},
        "measures": {"total_count": "sum", "direction_a": "sum", "direction_b": "sum"},
        "supports_period": False,
    },
    "traffic_measurements": {
        "date_col": "measured_at",
        "dimensions": {"measured_at", "detector_id"},
        "measures": {"intensity": "sum", "speed": "mean", "occupancy": "mean"},
        "supports_period": False,
    },
}

DATA_SCHEMA_RESPONSE = {
    "sources": [
        {
            "id": "bicycle_measurements",
            "label": "Bicycle Counters",
            "dimensions": [
                {"column": "measured_from", "label": "Date/Hour", "is_date": True},
                {"column": "counter_id", "label": "Counter ID", "is_date": False},
            ],
            "measures": [
                {"column": "total_count", "label": "Total Cyclists"},
                {"column": "direction_a", "label": "Direction A"},
                {"column": "direction_b", "label": "Direction B"},
            ],
            "supports_period": False,
        },
        {
            "id": "traffic_measurements",
            "label": "Traffic Detectors",
            "dimensions": [
                {"column": "measured_at", "label": "Date/Hour", "is_date": True},
                {"column": "detector_id", "label": "Detector ID", "is_date": False},
            ],
            "measures": [
                {"column": "intensity", "label": "Vehicle Count"},
                {"column": "speed", "label": "Avg Speed (km/h)"},
                {"column": "occupancy", "label": "Occupancy (%)"},
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
        raise HTTPException(status_code=422, detail=f"Invalid source: {source}")
    schema = SCHEMA[source]
    if dimension not in schema["dimensions"]:
        raise HTTPException(status_code=422, detail=f"Invalid dimension '{dimension}'")
    measure_list = [m.strip() for m in measures.split(",") if m.strip()]
    if not measure_list:
        raise HTTPException(status_code=422, detail="At least one measure required")
    invalid = [m for m in measure_list if m not in schema["measures"]]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Invalid measures: {invalid}")

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

    headers = [dimension] + measure_list
    rows = [
        [str(r[dimension])] + [
            f"{r[m]:.2f}" if isinstance(r[m], float) else str(r[m])
            for m in measure_list
        ]
        for _, r in grouped.iterrows()
    ]
    return {"headers": headers, "rows": rows}
