"""
Upload files to Supabase Storage with verification manifests.
Handles single files and directory trees with concurrent uploads.
"""

import hashlib
import json
import os
import mimetypes
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from supabase import create_client, Client
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, MofNCompleteColumn

console = Console()

BUCKET_NAME = "raw-archive"
MAX_STANDARD_UPLOAD = 50 * 1024 * 1024
CONCURRENT_UPLOADS = int(os.environ.get("CONCURRENT_UPLOADS", "20"))


def get_client() -> Client:
    """Create Supabase client from environment variables."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
    return create_client(url, key)


def ensure_bucket(client: Client):
    """Create the raw-archive bucket if it doesn't exist."""
    try:
        client.storage.get_bucket(BUCKET_NAME)
    except Exception:
        client.storage.create_bucket(BUCKET_NAME, options={"public": False})
        console.print(f"[green]Created bucket: {BUCKET_NAME}[/green]")


def file_sha256(filepath: str) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# Thread-local storage for reusing Supabase clients (avoids creating a new TCP connection per file)
_thread_local = threading.local()

MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))


def _get_thread_client(url: str, key: str) -> Client:
    """Get or create a per-thread Supabase client."""
    if not hasattr(_thread_local, "client") or _thread_local.client is None:
        _thread_local.client = create_client(url, key)
    return _thread_local.client


def upload_file_worker(url: str, key: str, local_path: str, remote_path: str) -> tuple[str, bool, int, str]:
    """
    Upload a single file to Supabase Storage with retry + exponential backoff.
    Reuses a per-thread client to avoid connection exhaustion.
    Returns (remote_path, success, file_size, error_msg).
    """
    file_size = os.path.getsize(local_path)
    mime_type = mimetypes.guess_type(local_path)[0] or "application/octet-stream"

    last_error = ""
    for attempt in range(MAX_RETRIES):
        try:
            client = _get_thread_client(url, key)
            with open(local_path, "rb") as f:
                client.storage.from_(BUCKET_NAME).upload(
                    path=remote_path,
                    file=f.read(),
                    file_options={"content-type": mime_type, "upsert": "true"},
                )
            return (remote_path, True, file_size, "")
        except Exception as e:
            last_error = str(e)
            if "already exists" in last_error.lower() or "duplicate" in last_error.lower():
                return (remote_path, True, file_size, "")
            if "InvalidKey" in last_error:
                return (remote_path, False, file_size, last_error)
            # Reset client on connection errors so next attempt gets a fresh connection
            _thread_local.client = None
            if attempt < MAX_RETRIES - 1:
                backoff = (2 ** attempt) + (time.monotonic() % 1)  # 1-2s, 2-3s, 4-5s
                time.sleep(backoff)

    return (remote_path, False, file_size, last_error)


def build_local_manifest(local_dir: str, skip_dirs: set | None = None,
                         compute_hashes: bool = True) -> list[dict]:
    """
    Build a manifest of all files in a local directory.
    Returns list of {path, size, sha256} dicts.
    Set compute_hashes=False to skip SHA-256 for large datasets (much faster).
    """
    skip_dirs = skip_dirs or {".git", "__pycache__", "node_modules", ".venv"}
    manifest = []
    local_path = Path(local_dir)

    for file_path in sorted(local_path.rglob("*")):
        if not file_path.is_file():
            continue
        rel_path = file_path.relative_to(local_path)
        if any(part in skip_dirs for part in rel_path.parts):
            continue
        entry = {
            "path": str(rel_path),
            "size": file_path.stat().st_size,
        }
        if compute_hashes:
            entry["sha256"] = file_sha256(str(file_path))
        manifest.append(entry)

    return manifest


def upload_manifest(client: Client, source_key: str, manifest: list[dict],
                    stats: dict):
    """
    Upload a JSON manifest for a source to Supabase Storage.
    This is our receipt -- proves what was downloaded and uploaded.
    """
    manifest_data = {
        "source": source_key,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "file_count": len(manifest),
        "total_bytes": sum(f["size"] for f in manifest),
        "upload_stats": stats,
        "files": manifest,
    }

    manifest_json = json.dumps(manifest_data, indent=2).encode("utf-8")
    remote_path = f"_manifests/{source_key}.json"

    try:
        client.storage.from_(BUCKET_NAME).upload(
            path=remote_path,
            file=manifest_json,
            file_options={"content-type": "application/json", "upsert": "true"},
        )
        console.print(f"[green]Manifest saved: {remote_path} "
                       f"({len(manifest)} files, "
                       f"{sum(f['size'] for f in manifest) / 1024 / 1024:.1f}MB)[/green]")
    except Exception as e:
        console.print(f"[red]Failed to upload manifest: {e}[/red]")


def upload_directory(client: Client, local_dir: str, remote_prefix: str,
                     skip_patterns: list[str] | None = None,
                     progress_tracker=None,
                     source_key: str | None = None) -> dict:
    """
    Upload an entire directory tree to Supabase Storage using concurrent uploads.
    Builds a manifest before uploading, then verifies after.
    Returns stats dict with counts.
    """
    stats = {"uploaded": 0, "skipped": 0, "failed": 0, "bytes": 0}
    skip_patterns = skip_patterns or []
    always_skip = {".git", "__pycache__", "node_modules", ".venv", ".env"}

    # Build manifest BEFORE uploading
    # Skip SHA-256 hashing for large datasets (>10K files) to avoid hours of disk reads
    compute_hashes = int(os.environ.get("SKIP_HASHES", "0")) == 0
    console.print("[cyan]Building file manifest...[/cyan]")
    manifest = build_local_manifest(local_dir, skip_dirs=always_skip, compute_hashes=compute_hashes)
    total_size_mb = sum(f["size"] for f in manifest) / 1024 / 1024
    console.print(f"[cyan]Found {len(manifest)} files ({total_size_mb:.1f}MB)[/cyan]")

    local_path = Path(local_dir)

    # Filter to only files that need uploading
    to_upload = []
    for entry in manifest:
        file_path = local_path / entry["path"]
        rel_path = Path(entry["path"])
        remote_path = f"{remote_prefix}/{rel_path}"

        if any(file_path.match(pat) for pat in skip_patterns):
            stats["skipped"] += 1
            continue

        if progress_tracker and progress_tracker.is_uploaded(remote_path):
            stats["skipped"] += 1
            continue

        to_upload.append((str(file_path), remote_path, entry["size"]))

    if stats["skipped"] > 0:
        console.print(f"[dim]Skipping {stats['skipped']} already-uploaded files[/dim]")

    if not to_upload:
        console.print("[green]All files already uploaded.[/green]")
        if source_key:
            upload_manifest(client, source_key, manifest, stats)
        return stats

    # Auto-reduce workers for large files to avoid OOM on small VMs
    # Set CONCURRENT_UPLOADS high (e.g. 60) on beefy VMs to override
    avg_file_size = sum(sz for _, _, sz in to_upload) / max(len(to_upload), 1)
    available_ram_gb = os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') / (1024**3)
    if available_ram_gb >= 32:
        workers = CONCURRENT_UPLOADS  # plenty of RAM, no throttling
    elif avg_file_size > 5 * 1024 * 1024:  # avg > 5MB
        workers = min(CONCURRENT_UPLOADS, 3)
    elif avg_file_size > 1 * 1024 * 1024:  # avg > 1MB
        workers = min(CONCURRENT_UPLOADS, 8)
    else:
        workers = CONCURRENT_UPLOADS

    console.print(f"[cyan]Uploading {len(to_upload)} files with {workers} parallel workers "
                  f"(avg {avg_file_size/1024:.0f}KB/file)...[/cyan]")

    # Get credentials for worker threads (each creates its own client)
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("[green]{task.fields[uploaded_mb]:.0f}MB"),
        console=console,
    ) as progress:
        task = progress.add_task("Uploading", total=len(to_upload), uploaded_mb=0)

        with ThreadPoolExecutor(max_workers=workers) as executor:
            # Submit in batches to avoid building a 500K+ futures dict upfront
            batch_size = workers * 4
            idx = 0
            futures = {}

            def refill():
                nonlocal idx
                while len(futures) < batch_size and idx < len(to_upload):
                    lp, rp, sz = to_upload[idx]
                    fut = executor.submit(upload_file_worker, url, key, lp, rp)
                    futures[fut] = (lp, rp, sz)
                    idx += 1

            refill()

            while futures:
                done = next(as_completed(futures))
                _lp, _rp, _sz = futures.pop(done)
                remote_path, success, file_size, error_msg = done.result()

                if success:
                    stats["uploaded"] += 1
                    stats["bytes"] += file_size
                    if progress_tracker:
                        progress_tracker.mark_uploaded(remote_path)
                else:
                    stats["failed"] += 1
                    if file_size > MAX_STANDARD_UPLOAD:
                        console.print(f"[red]Failed (large file {file_size/1024/1024:.1f}MB): {remote_path}: {error_msg}[/red]")
                    else:
                        console.print(f"[red]Failed: {remote_path}: {error_msg}[/red]")

                progress.update(task, advance=1, uploaded_mb=stats["bytes"] / 1024 / 1024)
                refill()

    # Upload the manifest as our verification receipt
    if source_key:
        upload_manifest(client, source_key, manifest, stats)

    return stats


def verify_source(client: Client, source_key: str) -> dict:
    """
    Verify a source's upload by comparing its manifest against
    what's actually in the bucket. Returns verification report.
    """
    manifest_path = f"_manifests/{source_key}.json"
    try:
        data = client.storage.from_(BUCKET_NAME).download(manifest_path)
        manifest = json.loads(data)
    except Exception:
        return {"status": "no_manifest", "source": source_key}

    expected_count = manifest["file_count"]
    expected_bytes = manifest["total_bytes"]
    upload_stats = manifest.get("upload_stats", {})

    return {
        "status": "verified" if upload_stats.get("failed", 0) == 0 else "has_failures",
        "source": source_key,
        "expected_files": expected_count,
        "uploaded": upload_stats.get("uploaded", 0),
        "failed": upload_stats.get("failed", 0),
        "skipped": upload_stats.get("skipped", 0),
        "expected_bytes": expected_bytes,
        "actual_bytes": upload_stats.get("bytes", 0),
        "has_sha256": all("sha256" in f for f in manifest.get("files", [])),
    }
