#!/bin/bash
# scripts/download-datasets.sh
# Download all 12 DOJ Epstein datasets from justice.gov
# Usage: ./scripts/download-datasets.sh [dataset_number]

set -e

BASE_URL="https://www.justice.gov/d9/2025-01"
OUTPUT_DIR="data/raw"

# Dataset URLs (12 DOJ releases)
declare -A DATASETS
DATASETS[1]="epstein-dataset-1.zip"
DATASETS[2]="epstein-dataset-2.zip"
DATASETS[3]="epstein-dataset-3.zip"
DATASETS[4]="epstein-dataset-4.zip"
DATASETS[5]="epstein-dataset-5.zip"
DATASETS[6]="epstein-dataset-6.zip"
DATASETS[7]="epstein-dataset-7.zip"
DATASETS[8]="epstein-dataset-8.zip"
DATASETS[9]="epstein-dataset-9.zip"
DATASETS[10]="epstein-dataset-10.zip"
DATASETS[11]="epstein-dataset-11.zip"
DATASETS[12]="epstein-dataset-12.zip"

download_dataset() {
  local num=$1
  local filename=${DATASETS[$num]}
  local url="${BASE_URL}/${filename}"
  local outdir="${OUTPUT_DIR}/dataset-${num}"

  echo "=== Downloading Dataset ${num} ==="
  mkdir -p "$outdir"

  # Download with resume support
  wget --continue -O "${outdir}/${filename}" "$url" || {
    echo "ERROR: Failed to download dataset ${num}"
    return 1
  }

  # Extract
  echo "Extracting ${filename}..."
  unzip -o "${outdir}/${filename}" -d "$outdir"

  echo "Dataset ${num} complete: ${outdir}"
}

# Single dataset mode
if [ -n "$1" ]; then
  download_dataset "$1"
  exit 0
fi

# Download all datasets
mkdir -p "$OUTPUT_DIR"
for i in $(seq 1 12); do
  download_dataset "$i"
done

echo "=== All datasets downloaded ==="
du -sh "$OUTPUT_DIR"
