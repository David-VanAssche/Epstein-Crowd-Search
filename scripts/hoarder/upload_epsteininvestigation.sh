#!/usr/bin/env bash
# Upload scraped epsteininvestigation.org data to Supabase Storage.
# Run on the VM after copying the final data:
#   scp /tmp/epstein-final/*.jsonl epstein-uploader:/mnt/temp/epstein-final/
#   ssh epstein-uploader 'cd /mnt/temp/repo && bash scripts/hoarder/upload_epsteininvestigation.sh'

set -euo pipefail

DATA_DIR="${1:-/mnt/temp/epstein-final}"
DEST_PREFIX="scraped/epsteininvestigation.org"

if [ ! -d "$DATA_DIR" ]; then
    echo "ERROR: Data directory not found: $DATA_DIR"
    echo "Usage: $0 [data_dir]"
    exit 1
fi

echo "=== Uploading epsteininvestigation.org scraped data ==="
echo "Source: $DATA_DIR"
echo "Dest:   raw-archive/$DEST_PREFIX/"
echo ""

# Use the existing uploader.py infrastructure
source /mnt/temp/venv/bin/activate 2>/dev/null || true

python3 -c "
import json, os, hashlib, time
from pathlib import Path
from supabase import create_client

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
client = create_client(url, key)
bucket = client.storage.from_('raw-archive')

data_dir = Path('$DATA_DIR')
prefix = '$DEST_PREFIX'
manifest = {'source': 'epsteininvestigation.org', 'method': 'html_scrape', 'files': {}}

for f in sorted(data_dir.glob('*.jsonl')):
    dest = f'{prefix}/{f.name}'
    content = f.read_bytes()
    sha = hashlib.sha256(content).hexdigest()
    size = len(content)

    print(f'  Uploading {f.name} ({size:,} bytes, sha256={sha[:12]}...)...', end=' ', flush=True)
    try:
        bucket.upload(dest, content, {'content-type': 'application/jsonl', 'upsert': 'true'})
        print('OK')
        manifest['files'][f.name] = {'path': dest, 'sha256': sha, 'size': size, 'records': sum(1 for _ in f.open())}
    except Exception as e:
        print(f'ERROR: {e}')

# Upload manifest
manifest_path = f'_manifests/epsteininvestigation-scraped.json'
manifest_bytes = json.dumps(manifest, indent=2).encode()
print(f'  Uploading manifest...', end=' ', flush=True)
try:
    bucket.upload(manifest_path, manifest_bytes, {'content-type': 'application/json', 'upsert': 'true'})
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')

print()
print('=== Upload complete ===')
for name, info in manifest['files'].items():
    print(f'  {name}: {info[\"records\"]} records, {info[\"size\"]:,} bytes')
"
