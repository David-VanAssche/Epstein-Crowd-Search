#!/bin/bash
# Run individual hoarding tasks. Usage: ./run_task.sh <task_name>
# Designed to be run in parallel tmux sessions on the cloud VM.

set -a && source /mnt/temp/repo/.env && set +a
source /mnt/temp/venv/bin/activate
export CONCURRENT_UPLOADS=60

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
print('DONE:', stats)
"
}

case "$1" in

blackbook)
    echo "=== Downloading blackbook CSVs ==="
    mkdir -p /mnt/temp/blackbook
    cd /mnt/temp/blackbook
    curl -sL 'https://epsteinsblackbook.com' -o index.html
    # Try to find downloadable files
    curl -sL 'https://epsteinsblackbook.com/api/contacts' -o contacts.json 2>/dev/null
    curl -sL 'https://epsteinsblackbook.com/api/flights' -o flights.json 2>/dev/null
    # Also try the structured data page
    curl -sL 'https://epsteinsblackbook.com/structured-data' -o structured-data.html 2>/dev/null
    # Scrape what we can from the pages
    for fmt in csv json; do
        curl -sL "https://epsteinsblackbook.com/api/black-book?format=${fmt}" -o "black-book.${fmt}" 2>/dev/null
    done
    ls -la /mnt/temp/blackbook/
    upload_dir /mnt/temp/blackbook websites/blackbook blackbook
    rm -rf /mnt/temp/blackbook
    ;;

rhowardstone)
    echo "=== Cloning rhowardstone/Epstein-research-data ==="
    git clone --depth 1 https://github.com/rhowardstone/Epstein-research-data /mnt/temp/rhowardstone 2>&1
    echo "Files: $(find /mnt/temp/rhowardstone -type f | wc -l)"
    echo "Size: $(du -sh /mnt/temp/rhowardstone | cut -f1)"
    upload_dir /mnt/temp/rhowardstone github/rhowardstone rhowardstone
    rm -rf /mnt/temp/rhowardstone
    ;;

archiveorg)
    echo "=== Downloading DOJ Datasets 1-8, 11, 12 from Archive.org ==="
    mkdir -p /mnt/temp/doj-archiveorg
    cd /mnt/temp/doj-archiveorg

    for ds in 5 6 7 12 4 3 2 1 11 8; do
        zipname="Data Set ${ds}.zip"
        encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${zipname}'))")
        url="https://archive.org/download/Epstein-Data-Sets-So-Far/${encoded}"
        echo "--- Downloading Dataset ${ds} ---"
        wget -c "${url}" -O "DataSet-${ds}.zip" 2>&1 | tail -3

        if [ -f "DataSet-${ds}.zip" ] && [ -s "DataSet-${ds}.zip" ]; then
            echo "Extracting Dataset ${ds}..."
            mkdir -p "dataset-${ds}"
            unzip -o "DataSet-${ds}.zip" -d "dataset-${ds}/" 2>&1 | tail -3
            rm "DataSet-${ds}.zip"

            echo "Uploading Dataset ${ds}..."
            upload_dir "/mnt/temp/doj-archiveorg/dataset-${ds}" "doj/dataset-${ds}" "doj-dataset-${ds}"
            rm -rf "/mnt/temp/doj-archiveorg/dataset-${ds}"
        else
            echo "FAILED to download Dataset ${ds}"
        fi
    done
    ;;

ds9)
    echo "=== Downloading Dataset 9 via torrent (~143GB) ==="
    mkdir -p /mnt/temp/doj-ds9
    aria2c --dir=/mnt/temp/doj-ds9 \
        --seed-time=0 \
        --max-connection-per-server=16 \
        --split=16 \
        --max-concurrent-downloads=8 \
        --file-allocation=falloc \
        --continue=true \
        --summary-interval=60 \
        "/mnt/temp/torrents/DataSet_9.tar.xz.torrent" 2>&1

    echo "=== Extracting Dataset 9 (tar.xz) ==="
    cd /mnt/temp/doj-ds9
    for f in *.tar.xz; do
        [ -f "$f" ] && tar xf "$f" && rm "$f"
    done

    echo "=== Uploading Dataset 9 ==="
    upload_dir /mnt/temp/doj-ds9 doj/dataset-9 doj-dataset-9
    rm -rf /mnt/temp/doj-ds9
    ;;

ds10)
    echo "=== Downloading Dataset 10 via torrent (~78GB) ==="
    mkdir -p /mnt/temp/doj-ds10
    aria2c --dir=/mnt/temp/doj-ds10 \
        --seed-time=0 \
        --max-connection-per-server=16 \
        --split=16 \
        --max-concurrent-downloads=8 \
        --file-allocation=falloc \
        --continue=true \
        --summary-interval=60 \
        "/mnt/temp/torrents/DataSet 10.zip.torrent" 2>&1

    echo "=== Extracting Dataset 10 ==="
    cd /mnt/temp/doj-ds10
    for f in *.zip; do
        [ -f "$f" ] && unzip -o "$f" && rm "$f"
    done

    echo "=== Uploading Dataset 10 ==="
    upload_dir /mnt/temp/doj-ds10 doj/dataset-10 doj-dataset-10
    rm -rf /mnt/temp/doj-ds10
    ;;

ds11)
    echo "=== Downloading Dataset 11 via torrent (~25GB) ==="
    mkdir -p /mnt/temp/doj-ds11
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
    cd /mnt/temp/doj-ds11
    for f in *.zip; do
        [ -f "$f" ] && unzip -o "$f" && rm "$f"
    done

    echo "=== Uploading Dataset 11 ==="
    upload_dir /mnt/temp/doj-ds11 doj/dataset-11 doj-dataset-11
    rm -rf /mnt/temp/doj-ds11
    ;;

*)
    echo "Usage: $0 {blackbook|rhowardstone|archiveorg|ds9|ds10|ds11}"
    ;;
esac
