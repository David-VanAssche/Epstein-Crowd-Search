#!/usr/bin/env python3
"""
Raw Data Hoarder for the Epstein Archive.

Downloads community-sourced data from all available sources and uploads
directly to Supabase Storage. No processing, no database inserts --
just get the bytes safe in the cloud.

Usage:
    python hoarder.py --all                    # Download everything
    python hoarder.py --source s0fskr1p        # Download one source
    python hoarder.py --tier 1                 # Download all Tier 1 sources
    python hoarder.py --status                 # Show progress
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import click
import httpx
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from sources import SOURCES
from uploader import get_client, ensure_bucket, upload_file, upload_directory, verify_source
from progress import ProgressTracker

console = Console()
load_dotenv()

# Where to temporarily store downloads before uploading.
# On the cloud VM this should be the mounted SSD: /mnt/temp
TEMP_DIR = os.environ.get("HOARDER_TEMP_DIR", "/mnt/temp")


def download_github(source: dict, temp_dir: str) -> str:
    """Clone a GitHub repo to temp directory. Returns path to cloned repo."""
    dest = os.path.join(temp_dir, source["bucket_path"].replace("/", "_"))
    if os.path.exists(dest):
        console.print(f"[yellow]Already cloned: {dest}[/yellow]")
        return dest

    console.print(f"[cyan]Cloning {source['url']}...[/cyan]")
    result = subprocess.run(
        ["git", "clone", "--depth=1", source["url"], dest],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        # Try full clone if shallow fails (some repos with LFS/releases)
        console.print("[yellow]Shallow clone failed, trying full clone...[/yellow]")
        subprocess.run(
            ["git", "clone", source["url"], dest],
            capture_output=True, text=True, check=True,
        )

    # For repos with releases (like LMSBAND), download release assets too
    if "lmsband" in source.get("bucket_path", "").lower():
        download_github_releases(source["url"], dest)

    return dest


def download_github_releases(repo_url: str, dest: str):
    """Download all release assets from a GitHub repo."""
    # Extract owner/repo from URL
    parts = repo_url.rstrip("/").split("/")
    owner_repo = f"{parts[-2]}/{parts[-1]}"

    console.print(f"[cyan]Checking releases for {owner_repo}...[/cyan]")
    try:
        result = subprocess.run(
            ["gh", "release", "list", "--repo", owner_repo, "--limit", "10"],
            capture_output=True, text=True,
        )
        if result.returncode != 0 or not result.stdout.strip():
            console.print("[dim]No releases found.[/dim]")
            return

        releases_dir = os.path.join(dest, "_releases")
        os.makedirs(releases_dir, exist_ok=True)

        # Download all assets from latest release
        subprocess.run(
            ["gh", "release", "download", "--repo", owner_repo,
             "--dir", releases_dir, "--pattern", "*"],
            capture_output=True, text=True,
        )
        console.print(f"[green]Downloaded release assets to {releases_dir}[/green]")
    except FileNotFoundError:
        console.print("[yellow]gh CLI not available, skipping releases.[/yellow]")


def download_huggingface(source: dict, temp_dir: str) -> str:
    """Download a HuggingFace dataset to temp directory."""
    dest = os.path.join(temp_dir, source["bucket_path"].replace("/", "_"))
    if os.path.exists(dest) and any(Path(dest).iterdir()):
        console.print(f"[yellow]Already downloaded: {dest}[/yellow]")
        return dest

    console.print(f"[cyan]Downloading HuggingFace dataset {source['url']}...[/cyan]")

    cmd = [
        "huggingface-cli", "download",
        source["url"],
        "--repo-type", "dataset",
        "--local-dir", dest,
    ]

    # If source needs auth, HF_TOKEN env var must be set
    if source.get("needs_auth"):
        token = os.environ.get("HF_TOKEN")
        if not token:
            console.print(f"[red]Skipping {source['name']}: HF_TOKEN not set (gated dataset)[/red]")
            raise RuntimeError(f"HF_TOKEN required for {source['name']}")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"HuggingFace download failed: {result.stderr}")

    return dest


def download_direct(source: dict, temp_dir: str) -> str:
    """Download a single file via HTTP."""
    dest_dir = os.path.join(temp_dir, source["bucket_path"].replace("/", "_"))
    os.makedirs(dest_dir, exist_ok=True)

    url = source["url"]
    filename = url.split("/")[-1] or "download.txt"
    dest_file = os.path.join(dest_dir, filename)

    if os.path.exists(dest_file):
        console.print(f"[yellow]Already downloaded: {dest_file}[/yellow]")
        return dest_dir

    console.print(f"[cyan]Downloading {url}...[/cyan]")
    with httpx.stream("GET", url, follow_redirects=True, timeout=120) as resp:
        resp.raise_for_status()
        with open(dest_file, "wb") as f:
            for chunk in resp.iter_bytes(chunk_size=8192):
                f.write(chunk)

    return dest_dir


def download_zenodo(source: dict, temp_dir: str) -> str:
    """Download all files from a Zenodo record."""
    dest = os.path.join(temp_dir, "zenodo")
    os.makedirs(dest, exist_ok=True)

    record_id = source["url"].split("/")[-1]
    api_url = f"https://zenodo.org/api/records/{record_id}"

    console.print(f"[cyan]Fetching Zenodo record {record_id}...[/cyan]")
    resp = httpx.get(api_url, timeout=30)
    resp.raise_for_status()
    record = resp.json()

    for file_info in record.get("files", []):
        filename = file_info["key"]
        download_url = file_info["links"]["self"]
        dest_file = os.path.join(dest, filename)

        if os.path.exists(dest_file):
            console.print(f"[yellow]Already downloaded: {filename}[/yellow]")
            continue

        size_mb = file_info.get("size", 0) / 1024 / 1024
        console.print(f"[cyan]Downloading {filename} ({size_mb:.1f}MB)...[/cyan]")

        with httpx.stream("GET", download_url, follow_redirects=True, timeout=600) as r:
            r.raise_for_status()
            with open(dest_file, "wb") as f:
                for chunk in r.iter_bytes(chunk_size=65536):
                    f.write(chunk)

    return dest


def download_kaggle(source: dict, temp_dir: str) -> str:
    """Download a Kaggle dataset (requires kaggle CLI + API token)."""
    dest = os.path.join(temp_dir, source["bucket_path"].replace("/", "_"))
    os.makedirs(dest, exist_ok=True)

    console.print(f"[cyan]Downloading Kaggle dataset {source['url']}...[/cyan]")
    try:
        result = subprocess.run(
            ["kaggle", "datasets", "download", "-d", source["url"], "-p", dest, "--unzip"],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Kaggle download failed: {result.stderr}")
    except FileNotFoundError:
        console.print("[red]kaggle CLI not installed. Install with: pip install kaggle[/red]")
        raise

    return dest


DOWNLOADERS = {
    "github": download_github,
    "huggingface": download_huggingface,
    "direct_download": download_direct,
    "zenodo": download_zenodo,
    "kaggle": download_kaggle,
}


def hoard_source(source_key: str, source: dict, client, tracker: ProgressTracker):
    """Download a single source and upload to Supabase Storage."""
    if tracker.is_source_complete(source_key):
        console.print(f"[dim]Skipping {source['name']} (already complete)[/dim]")
        return

    source_type = source["type"]
    downloader = DOWNLOADERS.get(source_type)

    if not downloader:
        console.print(f"[yellow]Skipping {source['name']}: no downloader for type '{source_type}'[/yellow]")
        console.print(f"[yellow]  (website scraping and DOJ/torrent downloads handled separately)[/yellow]")
        return

    tracker.start_source(source_key)
    console.print(f"\n[bold green]{'=' * 60}[/bold green]")
    console.print(f"[bold green]Hoarding: {source['name']}[/bold green]")
    console.print(f"[bold green]{'=' * 60}[/bold green]")
    console.print(f"[dim]{source['description']}[/dim]\n")

    try:
        # Download to temp
        local_path = downloader(source, TEMP_DIR)

        # Upload to Supabase
        console.print(f"[cyan]Uploading to bucket: raw-archive/{source['bucket_path']}...[/cyan]")
        stats = upload_directory(
            client, local_path, source["bucket_path"],
            skip_patterns=source.get("skip_patterns", []),
            progress_tracker=tracker,
            source_key=source_key,
        )

        tracker.complete_source(source_key, stats)
        console.print(f"[green]Done: {stats['uploaded']} files uploaded, "
                       f"{stats['skipped']} skipped, {stats['failed']} failed "
                       f"({stats['bytes'] / 1024 / 1024:.1f}MB)[/green]")

        # Clean up temp download to free disk space
        if os.path.exists(local_path):
            shutil.rmtree(local_path, ignore_errors=True)
            console.print(f"[dim]Cleaned up temp: {local_path}[/dim]")

    except Exception as e:
        tracker.fail_source(source_key, str(e))
        console.print(f"[red]Failed: {source['name']}: {e}[/red]")


@click.group()
def cli():
    """Raw Data Hoarder for the Epstein Archive."""
    pass


@cli.command()
@click.option("--source", "-s", help="Source key to download (e.g., 's0fskr1p')")
@click.option("--tier", "-t", type=int, help="Download all sources in a tier (1-4)")
@click.option("--all", "all_sources", is_flag=True, help="Download everything")
def download(source, tier, all_sources):
    """Download sources and upload to Supabase Storage."""
    client = get_client()
    ensure_bucket(client)
    tracker = ProgressTracker(TEMP_DIR)

    os.makedirs(TEMP_DIR, exist_ok=True)

    if source:
        if source not in SOURCES:
            console.print(f"[red]Unknown source: {source}[/red]")
            console.print(f"Available: {', '.join(sorted(SOURCES.keys()))}")
            return
        hoard_source(source, SOURCES[source], client, tracker)

    elif tier:
        tier_sources = {k: v for k, v in SOURCES.items() if v["tier"] == tier}
        console.print(f"[bold]Downloading {len(tier_sources)} Tier {tier} sources...[/bold]")
        for key, src in tier_sources.items():
            hoard_source(key, src, client, tracker)

    elif all_sources:
        console.print(f"[bold]Downloading all {len(SOURCES)} sources...[/bold]")
        # Process in tier order (highest value first)
        sorted_sources = sorted(SOURCES.items(), key=lambda x: x[1]["tier"])
        for key, src in sorted_sources:
            hoard_source(key, src, client, tracker)
    else:
        console.print("[yellow]Specify --source, --tier, or --all[/yellow]")


@cli.command()
def status():
    """Show download progress."""
    tracker = ProgressTracker(TEMP_DIR if os.path.exists(TEMP_DIR) else ".")
    summary = tracker.get_summary()

    table = Table(title="Hoarder Progress")
    table.add_column("Source", style="cyan")
    table.add_column("Status", style="bold")
    table.add_column("Uploaded", justify="right")

    # Show all sources, marking ones not yet started
    for key, src in sorted(SOURCES.items(), key=lambda x: x[1]["tier"]):
        info = summary.get(key, {})
        status_val = info.get("status", "pending")
        uploaded = info.get("uploaded", 0)

        color = {"complete": "green", "in_progress": "yellow",
                 "failed": "red", "pending": "dim"}.get(status_val, "white")

        table.add_row(
            f"[{color}]{src['name']}[/{color}]",
            f"[{color}]{status_val}[/{color}]",
            str(uploaded) if uploaded else "-",
        )

    console.print(table)


@cli.command()
@click.option("--source", "-s", help="Verify a specific source")
@click.option("--all", "all_sources", is_flag=True, help="Verify all sources")
def verify(source, all_sources):
    """Verify uploads by comparing manifests against what was uploaded."""
    client = get_client()

    table = Table(title="Upload Verification")
    table.add_column("Source", style="cyan")
    table.add_column("Status", style="bold")
    table.add_column("Expected Files", justify="right")
    table.add_column("Uploaded", justify="right")
    table.add_column("Failed", justify="right")
    table.add_column("Size", justify="right")
    table.add_column("SHA-256", justify="center")

    sources_to_check = {}
    if source:
        if source in SOURCES:
            sources_to_check = {source: SOURCES[source]}
    elif all_sources:
        sources_to_check = SOURCES

    if not sources_to_check:
        console.print("[yellow]Specify --source or --all[/yellow]")
        return

    for key in sources_to_check:
        report = verify_source(client, key)
        status = report.get("status", "unknown")
        color = {"verified": "green", "has_failures": "red",
                 "no_manifest": "yellow"}.get(status, "white")

        table.add_row(
            SOURCES[key]["name"],
            f"[{color}]{status}[/{color}]",
            str(report.get("expected_files", "-")),
            str(report.get("uploaded", "-")),
            str(report.get("failed", "-")),
            f"{report.get('expected_bytes', 0) / 1024 / 1024:.1f}MB"
            if report.get("expected_bytes") else "-",
            "yes" if report.get("has_sha256") else "no",
        )

    console.print(table)


@cli.command()
def list_sources():
    """List all available sources."""
    table = Table(title="Available Data Sources")
    table.add_column("Key", style="cyan")
    table.add_column("Name")
    table.add_column("Type")
    table.add_column("Tier", justify="center")
    table.add_column("Description", max_width=50)

    for key, src in sorted(SOURCES.items(), key=lambda x: (x[1]["tier"], x[0])):
        table.add_row(key, src["name"], src["type"], str(src["tier"]), src["description"])

    console.print(table)


if __name__ == "__main__":
    cli()
