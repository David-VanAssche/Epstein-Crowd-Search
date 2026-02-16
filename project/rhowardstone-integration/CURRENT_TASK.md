# Current Task

**Phase:** 0 — Security Prerequisites
**Task:** Harden RLS policies for entity PII before importing rhowardstone data
**Status:** Not Started

## What to do
1. Read `phase-00-security-prerequisites.md` for full requirements
2. Audit current RLS on `entities` table — `metadata` column may expose PII (phones, addresses)
3. Create migration to restrict `metadata` access to authenticated users with researcher role
4. Add provenance tracking columns for AI-generated content vs. imported data
5. Update `.gitignore` to exclude `.db` files (SQLite databases from rhowardstone)
