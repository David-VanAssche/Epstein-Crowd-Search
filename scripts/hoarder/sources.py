"""
All 24 data sources for the Epstein Archive.
Each source defines how to download it and where to store it in Supabase.
"""

SOURCES = {
    # =========================================================================
    # TIER 1: Highest Value (processed community data)
    # =========================================================================
    "s0fskr1p": {
        "name": "s0fskr1p/epsteinfiles",
        "type": "github",
        "url": "https://github.com/s0fskr1p/epsteinfiles",
        "description": "OCR text for ALL 12 DOJ datasets (~5GB). Reveals text hidden under overlay redactions.",
        "bucket_path": "github/s0fskr1p",
        "tier": 1,
        "skip_patterns": [],  # Keep everything -- OCR text is the gold
    },
    "svetfm-fbi": {
        "name": "svetfm/epstein-fbi-files",
        "type": "huggingface",
        "url": "svetfm/epstein-fbi-files",
        "description": "236K chunks + 768d embeddings (nomic-embed-text). We keep chunks, skip embedding columns on re-process.",
        "bucket_path": "huggingface/svetfm-fbi",
        "tier": 1,
        "skip_patterns": [],
    },
    "svetfm-nov11": {
        "name": "svetfm/epstein-files-nov11-25-house-post-ocr-embeddings",
        "type": "huggingface",
        "url": "svetfm/epstein-files-nov11-25-house-post-ocr-embeddings",
        "description": "69,290 chunks + 768d embeddings (House Oversight).",
        "bucket_path": "huggingface/svetfm-nov11",
        "tier": 1,
        "skip_patterns": [],
    },
    "lmsband": {
        "name": "LMSBAND/epstein-files-db",
        "type": "github",
        "url": "https://github.com/LMSBAND/epstein-files-db",
        "description": "SQLite DB: 1,901 docs, NER entities, relationship graph (835MB).",
        "bucket_path": "github/lmsband",
        "tier": 1,
        "skip_patterns": [],
    },
    "epstein-docs": {
        "name": "epstein-docs/epstein-docs.github.io",
        "type": "github",
        "url": "https://github.com/epstein-docs/epstein-docs.github.io",
        "description": "8,175 docs as JSON: OCR, 12K people, 5K orgs, 3K locations, summaries.",
        "bucket_path": "github/epstein-docs",
        "tier": 1,
        "skip_patterns": [],
    },
    "erikveland": {
        "name": "ErikVeland/epstein-archive",
        "type": "github",
        "url": "https://github.com/ErikVeland/epstein-archive",
        "description": "86K entities, 51K documents, full processing pipeline.",
        "bucket_path": "github/erikveland",
        "tier": 1,
        "skip_patterns": [],
    },
    "benbaessler": {
        "name": "benbaessler/epfiles",
        "type": "github",
        "url": "https://github.com/benbaessler/epfiles",
        "description": "Pre-processed chunks (~190MB) with ChromaDB.",
        "bucket_path": "github/benbaessler",
        "tier": 1,
        "skip_patterns": [],
    },

    # =========================================================================
    # TIER 2: Structured Data
    # =========================================================================
    "blackbook": {
        "name": "epsteinsblackbook.com",
        "type": "website",
        "url": "https://epsteinsblackbook.com",
        "description": "1,971 names with contacts + flight manifests (CSV).",
        "bucket_path": "websites/blackbook",
        "tier": 2,
        "skip_patterns": [],
    },
    "epstein-exposed": {
        "name": "Epstein Exposed",
        "type": "website",
        "url": "https://epsteinexposed.com",
        "description": "1,400 persons, 1,700 flights, 2,700 emails, 55 GPS locations.",
        "bucket_path": "websites/epstein-exposed",
        "tier": 2,
        "skip_patterns": [],
    },
    "tensonaut": {
        "name": "tensonaut/EPSTEIN_FILES_20K",
        "type": "huggingface",
        "url": "tensonaut/EPSTEIN_FILES_20K",
        "description": "20K House Oversight pages, Tesseract OCR (~106MB CSV). Requires HF auth token.",
        "bucket_path": "huggingface/tensonaut",
        "tier": 2,
        "needs_auth": True,
        "skip_patterns": [],
    },
    "muneeb-emails": {
        "name": "notesbymuneeb/epstein-emails",
        "type": "huggingface",
        "url": "notesbymuneeb/epstein-emails",
        "description": "5,082 parsed email threads.",
        "bucket_path": "huggingface/muneeb-emails",
        "tier": 2,
        "skip_patterns": [],
    },
    "markramm": {
        "name": "markramm/EpsteinFiles",
        "type": "github",
        "url": "https://github.com/markramm/EpsteinFiles",
        "description": "2,895 House Oversight docs as .txt files.",
        "bucket_path": "github/markramm",
        "tier": 2,
        "skip_patterns": [],
    },
    "kaggle-jazivxt": {
        "name": "Kaggle: jazivxt/the-epstein-files",
        "type": "kaggle",
        "url": "jazivxt/the-epstein-files",
        "description": "House Oversight dataset on Kaggle.",
        "bucket_path": "kaggle/jazivxt",
        "tier": 2,
        "skip_patterns": [],
    },
    "kaggle-linogova": {
        "name": "Kaggle: linogova/epstein-ranker-dataset",
        "type": "kaggle",
        "url": "linogova/epstein-ranker-dataset-u-s-house-oversight",
        "description": "House Oversight ranker dataset on Kaggle.",
        "bucket_path": "kaggle/linogova",
        "tier": 2,
        "skip_patterns": [],
    },
    "archive-flights": {
        "name": "Archive.org Flight Logs",
        "type": "direct_download",
        "url": "https://archive.org/stream/EpsteinFlightLogsLolitaExpress/JE-Logs-1-20_djvu.txt",
        "description": "Full OCR text of Lolita Express flight logs.",
        "bucket_path": "websites/archive-org-flights",
        "tier": 2,
        "skip_patterns": [],
    },
    "maxandrews": {
        "name": "maxandrews/Epstein-doc-explorer",
        "type": "github",
        "url": "https://github.com/maxandrews/Epstein-doc-explorer",
        "description": "SQLite DB with Claude-extracted email entities.",
        "bucket_path": "github/maxandrews",
        "tier": 2,
        "skip_patterns": [],
    },

    # =========================================================================
    # TIER 3: Raw PDFs (authoritative originals)
    # =========================================================================
    "doj-official": {
        "name": "DOJ Official (justice.gov/epstein)",
        "type": "doj",
        "url": "https://www.justice.gov/archives/opa/epstein",
        "description": "12 datasets, 3.5M pages, ~206GB total. Bot-protected, needs browser or streaming.",
        "bucket_path": "doj",
        "tier": 3,
        "skip_patterns": [],
    },
    "yung-megafone": {
        "name": "yung-megafone/Epstein-Files",
        "type": "github",
        "url": "https://github.com/yung-megafone/Epstein-Files",
        "description": "Index + torrent magnets + checksums for all 12 DOJ datasets.",
        "bucket_path": "github/yung-megafone",
        "tier": 3,
        "skip_patterns": [],
    },

    # =========================================================================
    # TIER 4: Reference / Cross-Validation
    # =========================================================================
    "elderemo-index": {
        "name": "theelderemo/FULL_EPSTEIN_INDEX",
        "type": "huggingface",
        "url": "theelderemo/FULL_EPSTEIN_INDEX",
        "description": "Unified metadata index across all releases.",
        "bucket_path": "huggingface/elderemo-index",
        "tier": 4,
        "skip_patterns": [],
    },
    "zenodo": {
        "name": "Zenodo record 18512562",
        "type": "zenodo",
        "url": "https://zenodo.org/records/18512562",
        "description": "PDFs (309MB), Images (3.36GB), text, resources. CC-BY-4.0.",
        "bucket_path": "zenodo",
        "tier": 4,
        "skip_patterns": [],
    },
}

# EF20K/Datasets -- DEAD (GitHub org deleted, 404)
# Tsardoz/epstein-files-public -- ALIVE but empty (just README)
# House Oversight Committee -- no direct download links available
# DocumentCloud -- platform search needed, no direct bulk download
# Archive.org mirrors -- covered by yung-megafone torrents
# Epstein Exposed -- needs scraping investigation (structured DB, not direct download)
