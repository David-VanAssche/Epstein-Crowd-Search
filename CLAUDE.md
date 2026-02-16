# EpsteinCrowdResearch - Claude Code Instructions

## Project Overview
Open-source Epstein document research archive. Next.js app with Supabase backend (Postgres + Storage).

## Conventions
- **Package manager**: pnpm (never npm/yarn)
- **Framework**: Next.js 15 App Router with React Server Components
- **Database**: Supabase (Postgres + pgvector)
- **Storage**: Supabase Storage bucket `raw-archive`

## Supabase Storage

### REST API uploads (single file)
Use curl with **both** `apikey` and `Authorization` headers:
```bash
curl -X POST "${SUPABASE_URL}/storage/v1/object/raw-archive/${DEST_PATH}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: ${MIME}" \
  -H "x-upsert: true" \
  --data-binary "@${FILE}"
```
The Python `supabase` client handles both headers internally, but raw curl/fetch requires both.

### S3 protocol (bulk uploads)
Supabase Storage has an S3-compatible API. Use `aws s3 sync` for bulk uploads.

- **Endpoint**: `https://evcxibwuuhvvkrplazyk.storage.supabase.co/storage/v1/s3`
- **Region**: `us-east-1`
- **Credentials**: S3 access keys from Supabase dashboard (Storage > S3 Access Keys), stored in `.env` as `SUPABASE_S3_ACCESS_KEY_ID` and `SUPABASE_S3_SECRET_ACCESS_KEY`
- **Max upload size**: 2 GB per object (configured in Supabase dashboard)

```bash
# Example: sync a directory to Supabase Storage
export AWS_ACCESS_KEY_ID=$SUPABASE_S3_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$SUPABASE_S3_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION=us-east-1

aws s3 sync ./local-dir/ s3://raw-archive/dest-path/ \
  --endpoint-url https://evcxibwuuhvvkrplazyk.storage.supabase.co/storage/v1/s3
```

**Concurrency tuning**: `aws configure set default.s3.max_concurrent_requests 200` works well with Supabase (as long as spending caps are disabled for large uploads).

### Storage path convention
```
raw-archive/
  {type}/{source}/         # e.g. doj/dataset-1/, github/erikveland/
  _manifests/{source}.json # SHA-256 verification manifests
```

### Filename restrictions
Supabase Storage rejects filenames with special characters (®, 🎉, %, [, ë, ó, etc.). Sanitize with:
```python
import re
clean = re.sub(r"[^\w\-./@ ]", "_", path)
```

## Cloud VM
- GCP project: `epsteinproject` (NOT hometrak-mvp)
- VM: `epstein-uploader`, zone `us-central1-a`, e2-standard-16, 150 GB SSD
- Temp disk: `/mnt/temp`, repo at `/mnt/temp/repo`, venv at `/mnt/temp/venv`
- tmux sessions for long-running uploads

## Demo Account
For local development and testing:
- **Email**: `demo@epstein-archive.dev`
- **Password**: `demo123456`
- Sign in at `/login`

## Environment Variables
All keys in `.env` (gitignored). Includes:
- AI provider keys (Fireworks, Gemini, OpenAI, XAI, Mistral, Anthropic, Cohere)
- AWS Bedrock credentials (for Amazon Nova embeddings)
- Supabase (URL, anon key, service role key, S3 access keys)
