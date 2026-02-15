#!/usr/bin/env python3
"""
Download all publicly available Epstein document collections that are NOT
in our original 24 sources. Everything here is public government records,
court filings, FOIA responses, or publicly hosted documents.

Sources:
  1. Giuffre v. Maxwell unsealed (Jan 2024) - Archive.org
  2. DocumentCloud Epstein Documents Project (6 docs, 6,613 pages)
  3. DOJ OIG Report (Epstein death investigation, June 2023)
  4. DOJ OPR Report (Acosta NPA investigation)
  5. Palm Beach PD investigation records
  6. Maxwell criminal case documents (indictment, sentencing memo, deposition)
  7. 2008 Non-Prosecution Agreement
  8. DOJ court record exhibits (USVI v JPMorgan, FL v Epstein)
  9. phelix001/epstein-network GitHub repo
  10. Additional DocumentCloud individual documents
"""

import os
import sys
import json
import subprocess
import time

sys.path.insert(0, os.path.dirname(__file__))

import httpx
from supabase import create_client
from uploader import upload_directory

BASE_DIR = "/mnt/temp/public-gaps"
os.makedirs(BASE_DIR, exist_ok=True)

# Track what we download
download_log = []


def log(msg):
    print(msg, flush=True)
    download_log.append(msg)


def download_file(url, dest_path, label=""):
    """Download a file with retry. Returns True on success."""
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
        log(f"  SKIP (exists): {os.path.basename(dest_path)}")
        return True

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; EpsteinArchiveBot/1.0; public records research)"
    }

    for attempt in range(3):
        try:
            log(f"  GET {label or os.path.basename(dest_path)}...")
            with httpx.stream("GET", url, headers=headers, timeout=120, follow_redirects=True) as resp:
                resp.raise_for_status()
                with open(dest_path, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=65536):
                        f.write(chunk)

            size_mb = os.path.getsize(dest_path) / 1024 / 1024
            log(f"  OK: {os.path.basename(dest_path)} ({size_mb:.1f}MB)")
            return True
        except Exception as e:
            log(f"  Error (attempt {attempt+1}): {e}")
            if os.path.exists(dest_path):
                os.remove(dest_path)
            if attempt < 2:
                time.sleep(5 * (attempt + 1))

    log(f"  FAILED: {url}")
    return False


def clone_repo(url, dest_dir, label=""):
    """Clone a git repo. Returns True on success."""
    if os.path.exists(dest_dir) and os.listdir(dest_dir):
        log(f"  SKIP (exists): {label or dest_dir}")
        return True

    try:
        log(f"  Cloning {label or url}...")
        subprocess.run(
            ["git", "clone", "--depth=1", url, dest_dir],
            check=True, capture_output=True, text=True, timeout=300
        )
        log(f"  OK: cloned to {dest_dir}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False


# =========================================================================
# 1. GIUFFRE v. MAXWELL UNSEALED (Jan 2024)
#    Case 15-cv-07433-LAP, SDNY - civil depositions & exhibits
# =========================================================================
log("\n=== 1. Giuffre v. Maxwell Unsealed Documents (Jan 2024) ===")
gvm_dir = f"{BASE_DIR}/giuffre-v-maxwell"
os.makedirs(gvm_dir, exist_ok=True)

# Main 943-page document from Archive.org
download_file(
    "https://archive.org/download/final-epstein-documents/Final_Epstein_documents.pdf",
    f"{gvm_dir}/Final_Epstein_documents_943pages.pdf",
    "Giuffre v Maxwell - 943 page unsealed doc"
)

# Full zip with all files
download_file(
    "https://archive.org/download/final-epstein-documents/EpsteinDocs.zip",
    f"{gvm_dir}/EpsteinDocs_full.zip",
    "Giuffre v Maxwell - full zip archive"
)

# OCR text version
download_file(
    "https://archive.org/download/final-epstein-documents/Final_Epstein_documents_djvu.txt",
    f"{gvm_dir}/Final_Epstein_documents_ocr.txt",
    "Giuffre v Maxwell - OCR text"
)


# =========================================================================
# 2. DOCUMENTCLOUD EPSTEIN DOCUMENTS PROJECT (6 major docs, 6,613 pages)
# =========================================================================
log("\n=== 2. DocumentCloud Epstein Documents Project ===")
dc_dir = f"{BASE_DIR}/documentcloud"
os.makedirs(dc_dir, exist_ok=True)

dc_docs = [
    ("24402693", "epstein-drop-one", "Epstein Drop One (943 pages)"),
    ("24402694", "epstein-drop-two", "Epstein Drop Two (328 pages)"),
    ("24402695", "epstein-drop-three", "Epstein Drop Three (1391 pages)"),
    ("24402696", "epstein-drop-four", "Epstein Drop Four (343 pages)"),
    ("24402697", "epstein-drop-five", "Epstein Drop Five (223 pages)"),
    ("25206550", "epstein-mcc-new-york-documents", "Epstein MCC NY Documents (3385 pages)"),
]

for doc_id, slug, label in dc_docs:
    download_file(
        f"https://s3.documentcloud.org/documents/{doc_id}/{slug}.pdf",
        f"{dc_dir}/{slug}.pdf",
        label
    )

# Additional standalone DocumentCloud docs
dc_extras = [
    ("6184602", "jeffrey-epstein-non-prosecution-agreement", "2008 Non-Prosecution Agreement"),
    ("25547032", "doj-jeffrey-epstein-files-released-2025-02-27", "DOJ Files Released 2025-02-27"),
    ("6250471", "epstein-docs", "Epstein Docs (2,024 pages)"),
    ("24253239", "1324-epstein-documents-943-pages", "1.3.24 Epstein Documents"),
    ("24356232", "combinepdf-2", "1.9.24 Epstein Documents"),
    ("21095885", "nathanmaxwellaccess3icpreq102921", "Maxwell Access Motion (Inner City Press)"),
]

for doc_id, slug, label in dc_extras:
    download_file(
        f"https://s3.documentcloud.org/documents/{doc_id}/{slug}.pdf",
        f"{dc_dir}/{slug}.pdf",
        label
    )


# =========================================================================
# 3. DOJ OFFICE OF INSPECTOR GENERAL REPORT (Epstein death, June 2023)
#    "Investigation and Review of the Federal Bureau of Prisons'
#     Custody, Care, and Supervision of Jeffrey Epstein at MCC New York"
# =========================================================================
log("\n=== 3. DOJ OIG Report - Epstein Death Investigation ===")
oig_dir = f"{BASE_DIR}/doj-oig-report"
os.makedirs(oig_dir, exist_ok=True)

download_file(
    "https://oig.justice.gov/sites/default/files/reports/23-085.pdf",
    f"{oig_dir}/oig-report-23-085-epstein-mcc-death.pdf",
    "DOJ OIG Report 23-085"
)


# =========================================================================
# 4. DOJ OFFICE OF PROFESSIONAL RESPONSIBILITY REPORT
#    Investigation of Acosta's handling of the NPA
# =========================================================================
log("\n=== 4. DOJ OPR Report - Acosta NPA Investigation ===")
opr_dir = f"{BASE_DIR}/doj-opr-report"
os.makedirs(opr_dir, exist_ok=True)

download_file(
    "https://www.justice.gov/opr/page/file/1336471/download",
    f"{opr_dir}/opr-report-acosta-npa-investigation.pdf",
    "DOJ OPR Report - Acosta/NPA"
)


# =========================================================================
# 5. PALM BEACH PD INVESTIGATION RECORDS
#    Original 2005-2006 investigation, probable cause affidavit
# =========================================================================
log("\n=== 5. Palm Beach PD Investigation Records ===")
pbpd_dir = f"{BASE_DIR}/palm-beach-pd"
os.makedirs(pbpd_dir, exist_ok=True)

download_file(
    "https://abcnews.go.com/images/WNT/Palm_Beach_Records_Epstein.pdf",
    f"{pbpd_dir}/palm-beach-pd-records.pdf",
    "Palm Beach PD Records (ABC News)"
)


# =========================================================================
# 6. MAXWELL CRIMINAL CASE DOCUMENTS (20 Cr. 330, SDNY)
# =========================================================================
log("\n=== 6. Maxwell Criminal Case Documents ===")
maxwell_dir = f"{BASE_DIR}/maxwell-criminal"
os.makedirs(maxwell_dir, exist_ok=True)

maxwell_docs = [
    (
        "https://www.justice.gov/d9/press-releases/attachments/2020/07/02/u.s._v._ghislaine_maxwell_indictment.pdf",
        "maxwell-indictment-2020.pdf",
        "Maxwell Indictment (July 2020)"
    ),
    (
        "https://www.courthousenews.com/wp-content/uploads/2022/06/maxwell-government-sentencing-memo.pdf",
        "maxwell-government-sentencing-memo.pdf",
        "Maxwell Government Sentencing Memo"
    ),
    (
        "https://www.courthousenews.com/wp-content/uploads/2020/10/Maxwell-deposition-2016.pdf",
        "maxwell-deposition-2016.pdf",
        "Maxwell 2016 Deposition"
    ),
]

for url, filename, label in maxwell_docs:
    download_file(url, f"{maxwell_dir}/{filename}", label)


# =========================================================================
# 7. DOJ COURT RECORDS - USVI v. JPMORGAN CHASE
#    Case 1:22-cv-10904, SDNY - Financial SARs, bank emails
#    These are individually numbered exhibits on justice.gov
# =========================================================================
log("\n=== 7. DOJ Court Records - USVI v. JPMorgan Chase ===")
jpmorgan_dir = f"{BASE_DIR}/usvi-v-jpmorgan"
os.makedirs(jpmorgan_dir, exist_ok=True)

# The DOJ hosts individual exhibits. Try common exhibit numbers.
# URL pattern from research:
# https://www.justice.gov/multimedia/Court Records/Government of the United States Virgin Islands v. JPMorgan Chase Bank, N.A., No. 122-cv-10904 (S.D.N.Y. 2022)/311-67.pdf
jpmorgan_base = (
    "https://www.justice.gov/multimedia/Court%20Records/"
    "Government%20of%20the%20United%20States%20Virgin%20Islands%20v.%20"
    "JPMorgan%20Chase%20Bank,%20N.A.,%20No.%20122-cv-10904%20(S.D.N.Y.%202022)"
)

# Try exhibit numbers - the docket has hundreds of entries
# Common exhibit prefixes from this case: 311-{n} (supporting exhibits)
jpmorgan_downloaded = 0
jpmorgan_failed = 0

for exhibit_num in range(1, 200):
    url = f"{jpmorgan_base}/311-{exhibit_num}.pdf"
    dest = f"{jpmorgan_dir}/exhibit-311-{exhibit_num:03d}.pdf"

    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        jpmorgan_downloaded += 1
        continue

    try:
        resp = httpx.head(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; EpsteinArchiveBot/1.0; public records research)"
        }, timeout=15, follow_redirects=True)
        if resp.status_code == 200:
            if download_file(url, dest, f"USVI v JPMorgan Exhibit 311-{exhibit_num}"):
                jpmorgan_downloaded += 1
            else:
                jpmorgan_failed += 1
        else:
            jpmorgan_failed += 1
            if jpmorgan_failed > 20:
                log(f"  Stopping after {jpmorgan_failed} consecutive misses at exhibit 311-{exhibit_num}")
                break
    except Exception:
        jpmorgan_failed += 1
        if jpmorgan_failed > 20:
            break

    time.sleep(0.5)  # Be respectful

log(f"  JPMorgan exhibits: {jpmorgan_downloaded} downloaded, {jpmorgan_failed} not found/failed")


# =========================================================================
# 8. DOJ COURT RECORDS - STATE OF FLORIDA v. EPSTEIN
#    Case 50-2006-CF-009454, 15th Circuit
# =========================================================================
log("\n=== 8. DOJ Court Records - State of Florida v. Epstein ===")
florida_dir = f"{BASE_DIR}/florida-v-epstein"
os.makedirs(florida_dir, exist_ok=True)

florida_base = (
    "https://www.justice.gov/multimedia/Court%20Records/"
    "State%20of%20Florida%20v.%20Epstein,%20No.%2050-2006-CF-009454-AXXX-MB"
    "%20(Fla.%2015th%20Cir.%20Ct.%202006)"
)

# Try common filing numbers
florida_downloaded = 0
florida_failed = 0

for filing_num in range(1, 100):
    url = f"{florida_base}/{filing_num}.pdf"
    dest = f"{florida_dir}/filing-{filing_num:03d}.pdf"

    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        florida_downloaded += 1
        continue

    try:
        resp = httpx.head(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; EpsteinArchiveBot/1.0; public records research)"
        }, timeout=15, follow_redirects=True)
        if resp.status_code == 200:
            if download_file(url, dest, f"FL v Epstein Filing {filing_num}"):
                florida_downloaded += 1
            else:
                florida_failed += 1
        else:
            florida_failed += 1
            if florida_failed > 15:
                log(f"  Stopping after {florida_failed} consecutive misses at filing {filing_num}")
                break
    except Exception:
        florida_failed += 1
        if florida_failed > 15:
            break

    time.sleep(0.5)

log(f"  Florida filings: {florida_downloaded} downloaded, {florida_failed} not found/failed")


# =========================================================================
# 9. GITHUB: phelix001/epstein-network
#    19K FOIA docs with hidden/redacted content extraction
# =========================================================================
log("\n=== 9. GitHub: phelix001/epstein-network ===")
phelix_dir = f"{BASE_DIR}/phelix-epstein-network"
clone_repo("https://github.com/phelix001/epstein-network.git", phelix_dir, "phelix001/epstein-network")


# =========================================================================
# 10. DOJ DISCLOSURES - Direct memos & correspondence
#     These are on justice.gov/epstein/doj-disclosures
# =========================================================================
log("\n=== 10. DOJ Disclosure Memos ===")
doj_disc_dir = f"{BASE_DIR}/doj-disclosures"
os.makedirs(doj_disc_dir, exist_ok=True)

# Known direct PDF links from the DOJ disclosures page
doj_disclosure_docs = [
    (
        "https://www.justice.gov/multimedia/DOJ%20Disclosures/Memos.%20&%20Correspondence/"
        "2020.11%20DOJ%20Office%20of%20Professional%20Responsibility%20Report.pdf",
        "2020-11-opr-report.pdf",
        "OPR Report (via DOJ Disclosures)"
    ),
]

for url, filename, label in doj_disclosure_docs:
    download_file(url, f"{doj_disc_dir}/{filename}", label)


# =========================================================================
# UPLOAD EVERYTHING TO SUPABASE
# =========================================================================
log("\n=== Uploading all downloads to Supabase ===")

client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Upload each collection as its own source
upload_sources = [
    ("giuffre-v-maxwell", f"{BASE_DIR}/giuffre-v-maxwell", "court-records/giuffre-v-maxwell"),
    ("documentcloud", f"{BASE_DIR}/documentcloud", "documentcloud"),
    ("doj-oig-report", f"{BASE_DIR}/doj-oig-report", "reports/doj-oig"),
    ("doj-opr-report", f"{BASE_DIR}/doj-opr-report", "reports/doj-opr"),
    ("palm-beach-pd", f"{BASE_DIR}/palm-beach-pd", "police-records/palm-beach"),
    ("maxwell-criminal", f"{BASE_DIR}/maxwell-criminal", "court-records/maxwell-criminal"),
    ("usvi-v-jpmorgan", f"{BASE_DIR}/usvi-v-jpmorgan", "court-records/usvi-v-jpmorgan"),
    ("florida-v-epstein", f"{BASE_DIR}/florida-v-epstein", "court-records/florida-v-epstein"),
    ("phelix-epstein-network", f"{BASE_DIR}/phelix-epstein-network", "github/phelix-epstein-network"),
    ("doj-disclosures", f"{BASE_DIR}/doj-disclosures", "reports/doj-disclosures"),
]

total_stats = {"uploaded": 0, "skipped": 0, "failed": 0, "bytes": 0}

for source_key, local_dir, remote_prefix in upload_sources:
    if not os.path.exists(local_dir) or not os.listdir(local_dir):
        log(f"  SKIP {source_key}: empty or missing")
        continue

    log(f"\n  Uploading {source_key}...")
    stats = upload_directory(client, local_dir, remote_prefix, source_key=source_key)
    for k in total_stats:
        total_stats[k] += stats.get(k, 0)
    log(f"  {source_key}: {stats}")

log(f"\n=== GRAND TOTAL ===")
log(f"Uploaded: {total_stats['uploaded']}, Skipped: {total_stats['skipped']}, "
    f"Failed: {total_stats['failed']}, Bytes: {total_stats['bytes'] / 1024 / 1024:.1f}MB")

# Save download log
with open(f"{BASE_DIR}/_download_log.txt", "w") as f:
    f.write("\n".join(download_log))

log("\nDONE")
