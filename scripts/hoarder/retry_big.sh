#!/bin/bash
# Retry uploads for DS9, DS10, DS11 with low concurrency and retry logic.
# Usage: ./retry_big.sh {ds10|ds11|ds9}

set -a && source /mnt/temp/repo/.env && set +a
source /mnt/temp/venv/bin/activate

# Low concurrency to avoid overwhelming Supabase
export CONCURRENT_UPLOADS=8
export SKIP_HASHES=1
export MAX_RETRIES=4

upload_dir() {
    local local_dir="$1"
    local remote_prefix="$2"
    local source_key="$3"
    cd /mnt/temp/repo/scripts/hoarder
    python3 -c "
import os, sys
sys.path.insert(0, '.')
from supabase import create_client
from uploader import upload_directory
client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
stats = upload_directory(client, '$local_dir', '$remote_prefix', source_key='$source_key')
print(f'DONE: {stats}')
"
}

case "$1" in

ds10)
    echo "=== Uploading Dataset 10 (83GB, ~504K files) with ${CONCURRENT_UPLOADS} workers ==="
    echo "Start: $(date)"
    upload_dir /mnt/temp/doj-ds10 doj/dataset-10 doj-dataset-10
    echo "End: $(date)"
    echo "FINISHED"
    ;;

ds11)
    echo "=== Re-downloading Dataset 11 via torrent (~25GB) ==="
    mkdir -p /mnt/temp/doj-ds11
    cd /mnt/temp/doj-ds11

    aria2c --dir=/mnt/temp/doj-ds11 \
        --seed-time=0 \
        --max-connection-per-server=16 \
        --split=16 \
        --max-concurrent-downloads=8 \
        --file-allocation=falloc \
        --continue=true \
        --summary-interval=60 \
        "/mnt/temp/torrents/DataSet 11.zip.torrent" 2>&1

    echo "=== Extracting Dataset 11 ==="
    for f in *.zip; do
        if [ -f "$f" ]; then
            echo "Unzipping $f..."
            unzip -o "$f" -d extracted/ 2>&1 | tail -5
            rm "$f"
        fi
    done
    echo "Extraction complete. Files: $(find extracted/ -type f | wc -l)"

    echo "=== Uploading Dataset 11 with ${CONCURRENT_UPLOADS} workers ==="
    echo "Start: $(date)"
    upload_dir /mnt/temp/doj-ds11/extracted doj/dataset-11 doj-dataset-11
    echo "End: $(date)"
    echo "FINISHED"
    ;;

ds9)
    echo "=== Re-downloading Dataset 9 via torrent ==="
    mkdir -p /mnt/temp/doj-ds9
    if [ ! -f "/mnt/temp/torrents/DataSet_9.tar.xz.torrent" ]; then
        echo "ERROR: Torrent file not found at /mnt/temp/torrents/DataSet_9.tar.xz.torrent"
        echo "Need to re-acquire the torrent file first."
        exit 1
    fi

    aria2c --dir=/mnt/temp/doj-ds9 \
        --seed-time=0 \
        --max-connection-per-server=16 \
        --split=16 \
        --max-concurrent-downloads=8 \
        --file-allocation=falloc \
        --continue=true \
        --summary-interval=60 \
        "/mnt/temp/torrents/DataSet_9.tar.xz.torrent" 2>&1

    echo "=== Extracting Dataset 9 ==="
    cd /mnt/temp/doj-ds9
    for f in *.tar.xz; do
        [ -f "$f" ] && tar xf "$f" && rm "$f"
    done

    echo "=== Uploading Dataset 9 with ${CONCURRENT_UPLOADS} workers ==="
    echo "Start: $(date)"
    upload_dir /mnt/temp/doj-ds9 doj/dataset-9 doj-dataset-9
    echo "End: $(date)"
    echo "FINISHED"
    ;;

*)
    echo "Usage: $0 {ds10|ds11|ds9}"
    ;;
esac
