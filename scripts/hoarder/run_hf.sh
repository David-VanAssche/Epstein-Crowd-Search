#!/bin/bash
# Download and upload HuggingFace datasets.
# Usage: ./run_hf.sh {svetfm-nov11|tensonaut}

set -a && source /mnt/temp/repo/.env && set +a
source /mnt/temp/venv/bin/activate
export CONCURRENT_UPLOADS=8
export SKIP_HASHES=1
export MAX_RETRIES=4

cd /mnt/temp/repo/scripts/hoarder

case "$1" in

svetfm-nov11)
    echo "=== Downloading svetfm-nov11 from HuggingFace ==="
    echo "Start: $(date)"
    python3 <<'PYEOF'
import os, sys
sys.path.insert(0, '.')
from huggingface_hub import snapshot_download
from supabase import create_client
from uploader import upload_directory

dest = '/mnt/temp/huggingface_svetfm-nov11'
print('Downloading svetfm/epstein-files-nov11-25-house-post-ocr-embeddings...')
snapshot_download(
    repo_id='svetfm/epstein-files-nov11-25-house-post-ocr-embeddings',
    repo_type='dataset',
    local_dir=dest,
    token=os.environ.get('HF_TOKEN'),
)
print(f'Downloaded to {dest}')

print('Uploading to Supabase...')
client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
stats = upload_directory(client, dest, 'huggingface/svetfm-nov11', source_key='svetfm-nov11')
print(f'DONE: {stats}')
PYEOF
    echo "End: $(date)"
    echo "FINISHED"
    ;;

tensonaut)
    echo "=== Downloading tensonaut from HuggingFace (requires auth) ==="
    echo "Start: $(date)"
    python3 <<'PYEOF'
import os, sys
sys.path.insert(0, '.')
from huggingface_hub import snapshot_download
from supabase import create_client
from uploader import upload_directory

token = os.environ.get('HF_TOKEN')
if not token:
    print('ERROR: HF_TOKEN not set')
    sys.exit(1)

dest = '/mnt/temp/huggingface_tensonaut'
print('Downloading tensonaut/EPSTEIN_FILES_20K...')
snapshot_download(
    repo_id='tensonaut/EPSTEIN_FILES_20K',
    repo_type='dataset',
    local_dir=dest,
    token=token,
)
print(f'Downloaded to {dest}')

print('Uploading to Supabase...')
client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
stats = upload_directory(client, dest, 'huggingface/tensonaut', source_key='tensonaut')
print(f'DONE: {stats}')
PYEOF
    echo "End: $(date)"
    echo "FINISHED"
    ;;

*)
    echo "Usage: $0 {svetfm-nov11|tensonaut}"
    ;;
esac
