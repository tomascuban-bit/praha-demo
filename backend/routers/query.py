"""
Sestavy — /api/data-schema, /api/query-data, /api/dimension-values.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from services.data_loader import _DATA
from .parking import PARKING_LOCATIONS

router = APIRouter()

SCHEMA: dict[str, dict] = {
    "bicycle_measurements": {
        "date_col": "measured_from",
        "dimensions": {"measured_from", "counter_id"},
        "measures": {
            "total_count": "sum",
            "direction_a": "sum",
            "direction_b": "sum",
        },
        "supports_period": True,
        "filterable": {"measured_from": "counter_id"},
    },
    "parking_occupancy": {
        "date_col": None,
        "dimensions": {"parking_id"},
        "measures": {
            "total_spots": "sum",
            "free_spots": "sum",
            "occupied_spots": "sum",
            "pct_full": "mean",
        },
        "supports_period": False,
        "filterable": {},
    },
}

LABEL_MAP: dict[str, str] = {
    "measured_from":  "Datum/hodina",
    "counter_id":     "Počítadlo",
    "total_count":    "Celkem cyklistů",
    "direction_a":    "Směr A",
    "direction_b":    "Směr B",
    "parking_id":     "Parkoviště",
    "total_spots":    "Celková kapacita",
    "free_spots":     "Volná místa",
    "occupied_spots": "Obsazená místa",
    "pct_full":       "Obsazenost (%)",
}

DATA_SCHEMA_RESPONSE = {
    "sources": [
        {
            "id": "bicycle_measurements",
            "label": "Cyklistická počítadla",
            "supports_period": True,
            "dimensions": [
                {
                    "column": "measured_from",
                    "label": "Datum/hodina",
                    "is_date": True,
                    "filterable_by": {"column": "counter_id", "label": "Počítadlo"},
                },
                {
                    "column": "counter_id",
                    "label": "Počítadlo",
                    "is_date": False,
                    "filterable_by": None,
                },
            ],
            "measures": [
                {"column": "total_count", "label": "Celkem cyklistů"},
                {"column": "direction_a", "label": "Směr A"},
                {"column": "direction_b", "label": "Směr B"},
            ],
        },
        {
            "id": "parking_occupancy",
            "label": "P+R Parkoviště",
            "supports_period": False,
            "dimensions": [
                {
                    "column": "parking_id",
                    "label": "Parkoviště",
                    "is_date": False,
                    "filterable_by": None,
                },
            ],
            "measures": [
                {"column": "total_spots",    "label": "Celková kapacita"},
                {"column": "free_spots",     "label": "Volná místa"},
                {"column": "occupied_spots", "label": "Obsazená místa"},
                {"column": "pct_full",       "label": "Obsazenost (%)"},
            ],
        },
    ]
}


def _fmt_number(val: object) -> str:
    if isinstance(val, float):
        return str(int(val)) if val == int(val) else f"{val:.1f}"
    return str(val)


def _prepare_df(
    source: str,
    df: pd.DataFrame,
    days: int | None,
    filter_col: str | None,
    filter_val: str | None,
) -> pd.DataFrame:
    df = df.copy()

    if source == "parking_occupancy":
        if "source" in df.columns:
            df = df[df["source"] == "tsk-offstreet"]
        for col in ["total_spots", "free_spots", "occupied_spots"]:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
        df = df[df["total_spots"] > 0]
        df["pct_full"] = (df["occupied_spots"] / df["total_spots"] * 100).round(1)

    date_col = SCHEMA[source].get("date_col")
    if date_col and date_col in df.columns:
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        if days:
            max_date = df[date_col].max()
            if pd.notna(max_date):
                cutoff = max_date - pd.Timedelta(days=days)
                df = df[df[date_col] >= cutoff]

    if filter_col and filter_val and filter_col in df.columns:
        df = df[df[filter_col].astype(str) == filter_val]

    return df


@router.get("/api/data-schema")
def get_data_schema():
    return DATA_SCHEMA_RESPONSE


@router.get("/api/dimension-values")
def dimension_values(source: str = Query(...), column: str = Query(...)):
    if source not in SCHEMA:
        raise HTTPException(status_code=422, detail=f"Neplatný zdroj: {source}")
    if column not in SCHEMA[source]["dimensions"]:
        raise HTTPException(status_code=422, detail=f"Neplatná dimenze: {column}")

    df = _DATA.get(source)
    if df is None or df.empty:
        return []

    if source == "bicycle_measurements" and column == "counter_id":
        counters = _DATA.get("bicycle_counters")
        measurement_ids = sorted(df["counter_id"].dropna().astype(str).unique())
        if counters is not None and not counters.empty:
            name_map = dict(zip(counters["id"].astype(str), counters["name"].astype(str)))
            return [{"value": cid, "label": name_map.get(cid, cid)} for cid in measurement_ids]
        return [{"value": cid, "label": cid} for cid in measurement_ids]

    if source == "parking_occupancy" and column == "parking_id":
        pk = df.copy()
        if "source" in pk.columns:
            pk = pk[pk["source"] == "tsk-offstreet"]
        unique_ids = sorted(pk["parking_id"].dropna().astype(str).unique())
        return [
            {"value": pid, "label": PARKING_LOCATIONS.get(pid, {}).get("name", pid)}
            for pid in unique_ids
        ]

    unique = sorted(df[column].dropna().astype(str).unique())
    return [{"value": v, "label": v} for v in unique]


@router.get("/api/query-data")
def query_data(
    source: str = Query(...),
    dimension: str = Query(...),
    measures: str = Query(...),
    days: int | None = Query(None),
    filter_col: str | None = Query(None),
    filter_val: str | None = Query(None),
    granularity: str = Query("day"),
    top_n: int | None = Query(None),
    sort_dir: str = Query("desc"),
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

    raw_df = _DATA.get(source)
    empty_headers = [LABEL_MAP.get(dimension, dimension)] + [LABEL_MAP.get(m, m) for m in measure_list]
    if raw_df is None or raw_df.empty:
        return {"headers": empty_headers, "rows": []}

    df = _prepare_df(source, raw_df, days, filter_col, filter_val)
    if df.empty:
        return {"headers": empty_headers, "rows": []}

    for m in measure_list:
        if m in df.columns and m != "pct_full":
            df[m] = pd.to_numeric(df[m], errors="coerce").fillna(0)

    dim_col = dimension
    date_col = schema.get("date_col")
    is_date_dim = date_col and dimension == date_col

    if source == "bicycle_measurements" and dimension == "counter_id":
        counters = _DATA.get("bicycle_counters")
        if counters is not None and not counters.empty:
            name_map = dict(zip(counters["id"].astype(str), counters["name"].astype(str)))
            df[dim_col] = df[dim_col].astype(str).map(lambda x: name_map.get(x, x))

    if source == "parking_occupancy" and dimension == "parking_id":
        df[dim_col] = df[dim_col].astype(str).map(
            lambda x: PARKING_LOCATIONS.get(x, {}).get("name", x)
        )

    if is_date_dim and pd.api.types.is_datetime64_any_dtype(df[dim_col]):
        if granularity == "hour":
            df[dim_col] = df[dim_col].dt.strftime("%Y-%m-%d %H:00")
        elif granularity == "week":
            df[dim_col] = df[dim_col].dt.to_period("W").astype(str)
        elif granularity == "month":
            df[dim_col] = df[dim_col].dt.to_period("M").astype(str)
        else:
            df[dim_col] = df[dim_col].dt.to_period("D").astype(str)

    agg_dict = {m: schema["measures"][m] for m in measure_list}
    grouped = df.groupby(dim_col, sort=True).agg(agg_dict).reset_index()

    if not is_date_dim and measure_list:
        grouped = grouped.sort_values(measure_list[0], ascending=(sort_dir == "asc"))

    if top_n and top_n > 0:
        grouped = grouped.head(top_n)

    friendly_headers = [LABEL_MAP.get(dimension, dimension)] + [LABEL_MAP.get(m, m) for m in measure_list]
    rows = [
        [str(r[dim_col])] + [_fmt_number(r[m]) for m in measure_list]
        for _, r in grouped.iterrows()
    ]
    return {"headers": friendly_headers, "rows": rows}
