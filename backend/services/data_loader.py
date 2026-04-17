"""
Keboola Storage API data loader — Praha Demo edition.

DATA SOURCE PRIORITY:
  1. KBC_TOKEN + KBC_URL env vars → Keboola Storage API (production)
  2. backend/data/*.csv files     → local dev fallback (no credentials needed)

TABLES:
  - bicycle_counters    : Golemio bicycle counter locations
  - bicycle_measurements: Hourly bicycle count measurements
  - traffic_detectors   : Traffic measurement station metadata
  - traffic_measurements: Hourly traffic intensity / speed data
"""
from __future__ import annotations

import concurrent.futures
import io
import logging
import os
import time
from pathlib import Path
from typing import Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

# ─── Keboola table IDs ────────────────────────────────────────────────────────
# Bucket: out.c-Praha-Demo-Golemio-to-Output-Tables
# Created by transformation: keboola.snowflake-transformation / 01kpb9a6nf71mwwwg88rh8xesy (project 347)
TABLE_IDS: dict[str, str] = {
    "bicycle_counters":     "out.c-Praha-Demo-Golemio-to-Output-Tables.bicycle_counters",
    "bicycle_measurements": "out.c-Praha-Demo-Golemio-to-Output-Tables.bicycle_measurements",
    "traffic_detectors":    "out.c-Praha-Demo-Golemio-to-Output-Tables.traffic_detectors",
    "traffic_measurements": "out.c-Praha-Demo-Golemio-to-Output-Tables.traffic_measurements",
}

# Module-level data store — populated once by init_data(), read by get_data()
_DATA: dict[str, pd.DataFrame] = {}


# ─── Keboola Storage API helpers ─────────────────────────────────────────────

def _get_table_columns(table_id: str, base: str, headers: dict) -> list[str]:
    resp = requests.get(f"{base}/v2/storage/tables/{table_id}", headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()["columns"]


def _download_keboola_table(table_id: str, kbc_url: str, kbc_token: str) -> pd.DataFrame:
    """Download a table from Keboola Storage API via async export.
    Handles AWS (S3), Azure (ABS), and GCP sliced exports.
    """
    headers = {"X-StorageApi-Token": kbc_token}
    base = kbc_url.rstrip("/")
    columns = _get_table_columns(table_id, base, headers)

    resp = requests.post(
        f"{base}/v2/storage/tables/{table_id}/export-async",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    job_id = resp.json()["id"]

    for _ in range(120):
        resp = requests.get(f"{base}/v2/storage/jobs/{job_id}", headers=headers, timeout=30)
        resp.raise_for_status()
        job = resp.json()
        status = job.get("status")
        if status == "success":
            break
        if status in ("error", "cancelled"):
            raise RuntimeError(f"Keboola export failed for {table_id}: {job.get('error', {})}")
        time.sleep(1)
    else:
        raise TimeoutError(f"Keboola export timed out for {table_id}")

    file_info = job["results"]["file"]

    if set(file_info.keys()) == {"id"}:
        file_resp = requests.get(
            f"{base}/v2/storage/files/{file_info['id']}?federationToken=1",
            headers=headers,
            timeout=30,
        )
        file_resp.raise_for_status()
        file_info = file_resp.json()

    # GCP sliced export
    if file_info.get("isSliced"):
        manifest_resp = requests.get(file_info["url"], timeout=30)
        manifest_resp.raise_for_status()
        manifest = manifest_resp.json()
        gcs_token = file_info["gcsCredentials"]["access_token"]
        gcs_headers = {"Authorization": f"Bearer {gcs_token}"}
        bucket = file_info["gcsPath"]["bucket"]
        frames: list[pd.DataFrame] = []
        for entry in manifest["entries"]:
            gs_url = entry["url"]
            obj_path = gs_url.replace(f"gs://{bucket}/", "", 1)
            https_url = f"https://storage.googleapis.com/{bucket}/{obj_path}"
            part_resp = requests.get(https_url, headers=gcs_headers, timeout=120)
            part_resp.raise_for_status()
            frames.append(pd.read_csv(io.StringIO(part_resp.text), names=columns, header=None, dtype=str))
        return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=columns)

    # Single-file export (AWS S3 or Azure ABS)
    url = file_info.get("url") or (file_info.get("absPath") or {}).get("signedUrl")
    if not url:
        raise KeyError(f"No download URL in file info: {list(file_info.keys())}")
    data_resp = requests.get(url, timeout=120)
    data_resp.raise_for_status()
    return pd.read_csv(io.StringIO(data_resp.text), dtype=str)


def _load_local_csv(name: str) -> Optional[pd.DataFrame]:
    data_dir = Path(__file__).parent.parent / "data"
    csv_path = data_dir / f"{name}.csv"
    if csv_path.exists():
        logger.info("Loading local CSV: %s", csv_path)
        return pd.read_csv(csv_path, dtype=str)
    return None


# ─── Public API ──────────────────────────────────────────────────────────────

def _load_storage_mapping(name: str) -> Optional[pd.DataFrame]:
    """Check /data/in/tables/ — Keboola storage input mapping path in deployed containers."""
    csv_path = Path("/data/in/tables") / f"{name}.csv"
    if csv_path.exists():
        logger.info("Loading storage mapping: %s", csv_path)
        return pd.read_csv(csv_path, dtype=str)
    return None


def init_data() -> None:
    """Load all configured tables. Called once during FastAPI startup.

    Priority: storage mapping (/data/in/tables/) → KBC API → local CSV fallback
    """
    global _DATA

    # 1. Keboola storage input mapping (deployed data app with table mapping configured)
    mapping_frames = {name: _load_storage_mapping(name) for name in TABLE_IDS}
    if all(df is not None for df in mapping_frames.values()):
        logger.info("Loading from Keboola storage input mapping...")
        for name, df in mapping_frames.items():
            _DATA[name] = df
            logger.info("  ✓ %s: %d rows (storage mapping)", name, len(df))
        logger.info("Data loading complete. %d/%d tables loaded.", len(_DATA), len(TABLE_IDS))
        return

    # 2. Keboola Storage API (KBC_TOKEN + KBC_URL set as secrets)
    kbc_token = os.getenv("KBC_TOKEN", "").strip()
    kbc_url = os.getenv("KBC_URL", "").strip()

    if kbc_token and kbc_url:
        logger.info("Loading %d tables from Keboola Storage API...", len(TABLE_IDS))
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                name: executor.submit(_download_keboola_table, tid, kbc_url, kbc_token)
                for name, tid in TABLE_IDS.items()
            }
            for name, future in futures.items():
                try:
                    _DATA[name] = future.result()
                    logger.info("  ✓ %s: %d rows", name, len(_DATA[name]))
                except Exception as exc:
                    logger.error("  ✗ %s: %s", name, exc)
                    raise
        logger.info("Data loading complete. %d/%d tables loaded.", len(_DATA), len(TABLE_IDS))
        return

    # 3. Local CSV fallback (local dev or repo-bundled synthetic data)
    logger.info("No storage mapping or KBC_TOKEN — loading from local CSVs...")
    for name in TABLE_IDS:
        df = _load_local_csv(name)
        if df is not None:
            _DATA[name] = df
            logger.info("  ✓ %s: %d rows (local)", name, len(df))
        else:
            logger.warning("  ✗ %s: no local CSV at backend/data/%s.csv", name, name)

    logger.info("Data loading complete. %d/%d tables loaded.", len(_DATA), len(TABLE_IDS))


def get_data() -> dict[str, pd.DataFrame]:
    """FastAPI dependency — returns the loaded DataFrames."""
    return _DATA
