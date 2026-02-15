#!/usr/bin/env bash
# Backfill file_size_bytes for large datasets (DS9, DS10, DS11) by calling
# the backfill_file_sizes() RPC function in batches of 10K.
#
# Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
#
# Usage:
#   ./scripts/backfill_file_sizes.sh                    # All remaining
#   ./scripts/backfill_file_sizes.sh doj/dataset-9/     # Just DS9
#   ./scripts/backfill_file_sizes.sh "" 5000             # All, 5K batch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env
set -a
source "$PROJECT_DIR/.env"
set +a

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
KEY="${SUPABASE_SERVICE_ROLE_KEY}"
BATCH_SIZE="${2:-10000}"
PREFIX="${1:-}"
TOTAL=0

echo "=== Backfill file_size_bytes ==="
echo "URL: ${SUPABASE_URL}"
echo "Prefix: ${PREFIX:-'(all)'}"
echo "Batch size: ${BATCH_SIZE}"
echo ""

backfill_batch() {
  local prefix="$1"
  local batch_size="$2"

  result=$(curl -s "${SUPABASE_URL}/rest/v1/rpc/backfill_file_sizes" \
    -H "apikey: ${KEY}" \
    -H "Authorization: Bearer ${KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"p_dataset_prefix\": \"${prefix}\", \"p_batch_size\": ${batch_size}}")

  # Strip quotes if present
  echo "${result//\"/}"
}

if [ -n "$PREFIX" ]; then
  # Single prefix mode
  echo "Processing prefix: ${PREFIX}"
  while true; do
    count=$(backfill_batch "$PREFIX" "$BATCH_SIZE")
    TOTAL=$((TOTAL + count))
    echo "  Batch updated: ${count} (total: ${TOTAL})"
    if [ "$count" -eq 0 ] 2>/dev/null || [ -z "$count" ]; then
      break
    fi
    # Small delay to avoid overwhelming the DB
    sleep 0.5
  done
else
  # Process all large datasets in sequence
  for ds in 9 10 11; do
    ds_prefix="doj/dataset-${ds}/"
    ds_total=0
    echo "Processing dataset ${ds}..."
    while true; do
      count=$(backfill_batch "$ds_prefix" "$BATCH_SIZE")
      if [ "$count" -eq 0 ] 2>/dev/null || [ -z "$count" ]; then
        break
      fi
      ds_total=$((ds_total + count))
      TOTAL=$((TOTAL + count))
      echo "  DS${ds} batch: ${count} (ds_total: ${ds_total}, grand_total: ${TOTAL})"
      sleep 0.5
    done
    echo "  DS${ds} complete: ${ds_total} rows updated"
    echo ""
  done
fi

echo ""
echo "=== Done! Total updated: ${TOTAL} ==="
