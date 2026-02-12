"""
Upload files to Supabase Storage with verification manifests.
Handles single files and directory trees.
"""

import hashlib
import json
import os
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

from supabase import create_client, Client
from rich.console import Console

console = Console()

BUCKET_NAME = "raw-archive"

# Max file size for standard upload (50MB). Larger files use chunked approach.
MAX_STANDARD_UPLOAD = 50 * 1024 * 1024


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


def upload_file(client: Client, local_path: str, remote_path: str) -> bool:
    """
    Upload a single file to Supabase Storage.
    Returns True if successful, False if failed.
    """
    file_size = os.path.getsize(local_path)
    mime_type = mimetypes.guess_type(local_path)[0] or "application/octet-stream"

    if file_size > MAX_STANDARD_UPLOAD:
        console.print(f"[yellow]Large file ({file_size / 1024 / 1024:.1f}MB): {remote_path}[/yellow]")

    try:
        with open(local_path, "rb") as f:
            client.storage.from_(BUCKET_NAME).upload(
                path=remote_path,
                file=f.read(),
                file_options={"content-type": mime_type, "upsert": "true"},
            )
        return True
    except Exception as e:
        error_msg = str(e)
        # Skip "already exists" errors (idempotent)
        if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
            return True
        console.print(f"[red]Failed to upload {remote_path}: {e}[/red]")
        return False


def build_local_manifest(local_dir: str, skip_dirs: set | None = None) -> list[dict]:
    """
    Build a manifest of all files in a local directory.
    Returns list of {path, size, sha256} dicts.
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
        manifest.append({
            "path": str(rel_path),
            "size": file_path.stat().st_size,
            "sha256": file_sha256(str(file_path)),
        })

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
    Upload an entire directory tree to Supabase Storage.
    Builds a manifest before uploading, then verifies after.
    Returns stats dict with counts.
    """
    stats = {"uploaded": 0, "skipped": 0, "failed": 0, "bytes": 0}
    skip_patterns = skip_patterns or []

    # Default patterns to always skip
    always_skip = {".git", "__pycache__", "node_modules", ".venv", ".env"}

    # Build manifest BEFORE uploading (our source-of-truth for what we downloaded)
    console.print("[cyan]Building file manifest...[/cyan]")
    manifest = build_local_manifest(local_dir, skip_dirs=always_skip)
    console.print(f"[cyan]Found {len(manifest)} files "
                  f"({sum(f['size'] for f in manifest) / 1024 / 1024:.1f}MB)[/cyan]")

    local_path = Path(local_dir)

    for entry in manifest:
        file_path = local_path / entry["path"]
        rel_path = Path(entry["path"])

        # Skip user-defined patterns
        if any(file_path.match(pat) for pat in skip_patterns):
            stats["skipped"] += 1
            continue

        remote_path = f"{remote_prefix}/{rel_path}"

        # Check progress tracker for resumability
        if progress_tracker and progress_tracker.is_uploaded(remote_path):
            stats["skipped"] += 1
            continue

        success = upload_file(client, str(file_path), remote_path)
        if success:
            stats["uploaded"] += 1
            stats["bytes"] += entry["size"]
            if progress_tracker:
                progress_tracker.mark_uploaded(remote_path)
        else:
            stats["failed"] += 1

    # Upload the manifest as our verification receipt
    if source_key:
        upload_manifest(client, source_key, manifest, stats)

    return stats


def verify_source(client: Client, source_key: str) -> dict:
    """
    Verify a source's upload by comparing its manifest against
    what's actually in the bucket. Returns verification report.
    """
    # Download the manifest
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
