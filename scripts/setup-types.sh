#!/usr/bin/env bash
# scripts/setup-types.sh
# Regenerate Supabase TypeScript types from your live schema.
# Usage: ./scripts/setup-types.sh

set -euo pipefail

# Check if supabase CLI is available
if ! command -v npx &> /dev/null; then
  echo "Error: npx not found. Make sure Node.js is installed."
  exit 1
fi

# Check for linked project
if [ ! -f "supabase/config.toml" ]; then
  echo "Error: supabase/config.toml not found. Run from project root."
  exit 1
fi

echo "Generating Supabase TypeScript types..."

# Extract project ID from config (or use CLI link)
PROJECT_REF=$(grep -o 'id = "[^"]*"' supabase/config.toml | head -1 | cut -d'"' -f2)

if [ -z "$PROJECT_REF" ]; then
  echo "Error: No project ID found in supabase/config.toml."
  echo "Run: npx supabase link --project-ref <your-project-ref>"
  exit 1
fi

npx supabase gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema public \
  > types/supabase.ts

echo "Types written to types/supabase.ts"
echo ""
echo "Note: After regenerating, you may want to restart your TypeScript server:"
echo "  In VS Code: Cmd+Shift+P > 'TypeScript: Restart TS Server'"
