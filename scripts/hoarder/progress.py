"""
Progress tracking for resumable uploads.
Saves state to a JSON file so interrupted runs can pick up where they left off.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

PROGRESS_FILE = "hoarder-progress.json"


class ProgressTracker:
    def __init__(self, progress_dir: str = "."):
        self.path = Path(progress_dir) / PROGRESS_FILE
        self.data = self._load()

    def _load(self) -> dict:
        if self.path.exists():
            with open(self.path) as f:
                return json.load(f)
        return {"sources": {}, "uploaded_files": set()}

    def _save(self):
        # Convert set to list for JSON serialization
        save_data = {
            "sources": self.data["sources"],
            "uploaded_files": list(self.data.get("_uploaded_files_list", [])),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
        with open(self.path, "w") as f:
            json.dump(save_data, f, indent=2)

    def start_source(self, source_key: str):
        self.data["sources"][source_key] = {
            "status": "in_progress",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "uploaded": 0,
            "failed": 0,
        }
        self._save()

    def complete_source(self, source_key: str, stats: dict):
        self.data["sources"][source_key] = {
            "status": "complete",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            **stats,
        }
        self._save()

    def fail_source(self, source_key: str, error: str):
        if source_key in self.data["sources"]:
            self.data["sources"][source_key]["status"] = "failed"
            self.data["sources"][source_key]["error"] = error
        self._save()

    def is_source_complete(self, source_key: str) -> bool:
        return self.data["sources"].get(source_key, {}).get("status") == "complete"

    def is_uploaded(self, remote_path: str) -> bool:
        return remote_path in self.data.get("_uploaded_set", set())

    def mark_uploaded(self, remote_path: str):
        if "_uploaded_set" not in self.data:
            self.data["_uploaded_set"] = set(self.data.get("uploaded_files", []))
            self.data["_uploaded_files_list"] = list(self.data["_uploaded_set"])
        self.data["_uploaded_set"].add(remote_path)
        self.data["_uploaded_files_list"] = list(self.data["_uploaded_set"])
        # Save periodically (every 100 files)
        if len(self.data["_uploaded_set"]) % 100 == 0:
            self._save()

    def get_summary(self) -> dict:
        return {
            key: {
                "status": info.get("status", "unknown"),
                "uploaded": info.get("uploaded", 0),
            }
            for key, info in self.data["sources"].items()
        }
