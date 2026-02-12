# Phase 6: Worker Pipeline

> **Sessions:** 2 | **Dependencies:** Phase 4 (AI abstractions, search lib) | **Parallel with:** Nothing (depends on Phase 4)

## Summary

Build the standalone Node.js worker process with Express API (for chat) and the 12-stage document processing pipeline. Includes chat orchestrator with agentic tool-calling loop, cascade engine, AI document summary generation, audio file processing, structured data extraction (flight logs, financials), entity merge detection, pattern detection, and all operational scripts.

## Checklist

### Worker Project Setup

- [ ] `worker/package.json` — Standalone Node.js project
  - Dependencies: express, cors, bullmq (or polling-based), ioredis, dotenv, zod
  - Supabase client, AI provider libraries
  - TypeScript, tsx for development
  - Scripts: `start`, `dev`, `build`

- [ ] `worker/tsconfig.json` — TypeScript configuration
  - Target ES2022, strict mode
  - Path aliases matching main project

- [ ] `worker/.env.example` — Worker-specific env vars
  - All AI provider credentials
  - Supabase service role key
  - Redis URL
  - Worker concurrency, port

### Worker Entry Point

- [ ] `worker/src/index.ts` — Main entry point
  - Express server setup (CORS, JSON parsing)
  - Chat API route (`POST /chat`)
  - Health check endpoint (`GET /health`)
  - Job processing loop (BullMQ or polling)
  - Graceful shutdown handling

### Pipeline Infrastructure

- [ ] `worker/src/pipeline/orchestrator.ts` — Pipeline orchestration
  - Takes a document ID, runs through all stages sequentially
  - Updates `documents.processing_status` at each stage
  - Error handling and retry logic per stage
  - Progress reporting

- [ ] `worker/src/pipeline/job-queue.ts` — Job queue configuration
  - BullMQ setup with Redis (or polling-based fallback)
  - Job types: process_document, process_image, process_video, process_hint
  - Priority-based processing
  - Rate limiting per provider

- [ ] `worker/src/pipeline/stages.ts` — Pipeline stage definitions
  - Stage enum: OCR, CLASSIFY, CHUNK, CONTEXTUAL_HEADERS, EMBED, ENTITY_EXTRACT, RELATIONSHIP_MAP, REDACTION_DETECT, TIMELINE_EXTRACT, STORAGE
  - Stage dependencies and ordering

### Pipeline Services (10 stages)

- [ ] `worker/src/services/document-ai-ocr.ts` — Stage 1: OCR
  - Uses `OCRProvider` interface from AI abstractions
  - Outputs: markdown text with headings, per-page text, confidence
  - Updates `documents.ocr_text`

- [ ] `worker/src/services/classifier.ts` — Stage 2: Document classification
  - Uses `ClassifierProvider` interface
  - Classifies into 16 document types
  - Updates `documents.classification` and `classification_confidence`

- [ ] `worker/src/services/smart-chunker.ts` — Stage 3: Structure-aware chunking
  - Splits OCR text into 800-1500 character chunks
  - Respects heading/section boundaries
  - Preserves hierarchy path (e.g., ["Deposition", "Day 2", "Cross Examination"])
  - Creates `chunks` records

- [ ] `worker/src/services/contextual-header-gen.ts` — Stage 4: Contextual headers
  - Uses chat provider (Gemini Flash) to generate 50-100 token context per chunk
  - Format: situates the chunk within the whole document
  - Updates `chunks.contextual_header`

- [ ] `worker/src/services/embedding-service.ts` — Stage 5: Text embeddings
  - Uses `EmbeddingProvider` interface
  - Batch embed all chunks (768d text-embedding-004)
  - Uses embedding cache to avoid re-embedding
  - Updates `chunks.content_embedding`

- [ ] `worker/src/services/visual-embedding-service.ts` — Image embeddings
  - Uses `VisualEmbeddingProvider` interface
  - Embed images: visual (1408d) + description (1408d)
  - Updates `images.visual_embedding` and `images.description_embedding`

- [ ] `worker/src/services/entity-extractor.ts` — Stage 6: Entity extraction
  - Uses chat provider (Gemini Flash) to extract entities from chunk text
  - Entity types: person, organization, location, aircraft, vessel, property, account
  - Deduplication against existing entities (name embedding similarity)
  - Creates/updates `entities` and `entity_mentions` records

- [ ] `worker/src/services/relationship-mapper.ts` — Stage 7: Relationship mapping
  - Uses chat provider to identify entity-to-entity relationships
  - Relationship types: traveled_with, employed_by, associate_of, family_member, etc.
  - Creates `entity_relationships` records with evidence chunks

- [ ] `worker/src/services/redaction-detector.ts` — Stage 8: Redaction detection
  - Uses chat provider to detect and catalog redacted regions
  - Extracts: type, char length estimate, surrounding text, position
  - Generates context embedding for similarity matching
  - Creates `redactions` records
  - Updates `documents.is_redacted` and `documents.redaction_count`

- [ ] `worker/src/services/document-converter.ts` — File format conversion
  - Handle various input formats (PDF, DOC, images, etc.)
  - Convert to processable format for OCR

- [ ] `worker/src/services/video-transcriber.ts` — Video transcription
  - Uses `TranscriptionProvider` interface
  - Transcribe video files (Whisper)
  - Creates `videos` and `video_chunks` records

### Timeline Extraction

- [ ] Worker handles timeline event creation during entity/relationship extraction
  - Extracts dated events from chunks
  - Creates `timeline_events` records with entity links

### AI Document Summaries

- [ ] `worker/src/services/document-summarizer.ts` — Stage 10.5: Executive summaries
  - Uses chat provider (Gemini Flash) to generate 3-5 sentence summary per document
  - Summary covers: what the document is, key people mentioned, time period, significance
  - Identifies potential criminal activity indicators (evidence of trafficking, obstruction, conspiracy, etc.)
  - Updates `documents.metadata` with summary JSON
  - Runs after entity extraction for maximum context

### Audio File Processing

- [ ] `worker/src/services/audio-processor.ts` — Audio ingestion pipeline
  - Detect audio files in corpus (mp3, wav, m4a, ogg)
  - Transcribe via TranscriptionProvider (Whisper)
  - Create `audio_files` and `audio_chunks` records
  - Speaker diarization (identify different speakers in depositions/hearings)
  - Embed audio chunks (768d text embedding of transcript)
  - Extract entities from audio transcripts

### Structured Data Extraction

- [ ] `worker/src/services/structured-extractor.ts` — Extract structured records from semi-structured docs
  - Flight manifest parser: passenger names, dates, aircraft, origin/destination
  - Financial record parser: amounts, accounts, dates, parties
  - Phone record parser: numbers, dates, duration, parties
  - Address book parser: names, addresses, phone numbers, relationships
  - Creates `structured_data_extractions` records with typed JSON
  - Uses chat provider to parse unstructured text into structured fields

### Entity Merge Detection

- [ ] `worker/src/services/entity-merge-detector.ts` — Find duplicate entities
  - Compare entity name embeddings to find near-duplicates
  - Check aliases overlap
  - Score merge candidates by similarity
  - Create merge suggestions for community voting (not auto-merge)

### Pattern Detection

- [ ] `worker/src/services/pattern-detector.ts` — Find repeated phrases and anomalies
  - Detect repeated boilerplate language across documents
  - Identify form letters used multiple times
  - Flag documents with anomalous metadata (date mismatches, unusual classifications)
  - Detect redaction patterns (systematic redactions suggesting coordinated concealment)
  - Flag potential evidence of criminal activity patterns

### Criminal Activity Indicator Scoring

- [ ] `worker/src/services/criminal-indicator-scorer.ts` — Flag evidence of crimes
  - Uses chat provider to analyze document content for indicators of:
    - Trafficking (travel patterns, minor mentions, exploitation language)
    - Obstruction (document destruction references, witness tampering)
    - Conspiracy (coordination language, coded communication)
    - Financial crimes (money laundering patterns, hidden assets)
  - Assigns indicator scores to documents and entities
  - Creates `criminal_indicators` entries in document metadata
  - **Critical ethical note:** Flags patterns for human review — never makes accusations

### Embedding Cache

- [ ] `worker/src/services/embedding-cache.ts` — Two-tier cache
  - L1: In-memory LRU cache (~10K entries)
  - L2: Supabase lookup (check if chunk already has embedding)
  - Wraps `EmbeddingProvider` transparently
  - Cache key: SHA-256 hash of input text

### Cascade Engine

- [ ] `worker/src/services/cascade-engine.ts` — Redaction cascade propagation
  - When a redaction is solved: find similar unsolved redactions
  - Uses `find_similar_redactions()` Supabase RPC
  - Matching criteria: context similarity > 0.80, char length ±3, same redaction type
  - Auto-creates proposals for high-confidence cascades
  - Updates `redactions.cascade_source_id`, `cascade_depth`, `cascade_count`
  - Calculates `potential_cascade_count` for unsolved redactions

### Cohere Reranker

- [ ] `worker/src/services/cohere-reranker.ts` — Reranking service
  - Uses `RerankProvider` interface
  - Applied after initial retrieval in search and chat

### Chat Orchestrator

- [ ] `worker/src/chatbot/chat-orchestrator.ts` — Agentic tool-calling loop
  - Receives user message + conversation history
  - System prompt: "You are a research assistant..."
  - Tool-calling loop: LLM decides which tools to call, executes them, feeds results back
  - Max 5 tool-calling iterations per turn
  - Always includes citations in final response
  - Streaming output (token by token)

- [ ] `worker/src/chatbot/rag-retrieval.ts` — RAG retrieval with citations
  - Search for relevant chunks
  - Rerank results
  - Format as context for LLM
  - Generate citation references

- [ ] `worker/src/chatbot/intent-classifier.ts` — Query intent detection
  - Classify: factual_question, entity_lookup, timeline_query, comparison, general_chat
  - Route to appropriate tool combination

- [ ] `worker/src/chatbot/conversation-memory.ts` — Conversation history management
  - Load/save from `chat_conversations` table
  - Truncate history to fit context window
  - Summarize long conversations

### Chat Tools (8 tools)

- [ ] `worker/src/chatbot/tools/search-documents.ts` — Semantic document search
- [ ] `worker/src/chatbot/tools/search-images.ts` — Image search
- [ ] `worker/src/chatbot/tools/lookup-entity.ts` — Entity lookup + all mentions
- [ ] `worker/src/chatbot/tools/map-connections.ts` — Entity relationship graph traversal
- [ ] `worker/src/chatbot/tools/build-timeline.ts` — Timeline reconstruction
- [ ] `worker/src/chatbot/tools/cross-reference.ts` — Cross-dataset comparison
- [ ] `worker/src/chatbot/tools/search-by-date.ts` — Date-range search
- [ ] `worker/src/chatbot/tools/find-similar.ts` — Similar document finder

### Intelligence Hint Processor

- [ ] `worker/src/services/hint-processor.ts` — Process submitted intelligence hints
  - When hint submitted: create/update entity, generate embeddings
  - Search entire corpus for mentions of hint entity/aliases
  - Score unsolved redactions against hint (char length match, context similarity, date overlap)
  - Auto-create proposals for high-confidence matches
  - Update hint status and `redactions_matched` count
  - Notify hint submitter with results

### Chat API Route

- [ ] `worker/src/api/chat.ts` — Express route handler for `/chat`
  - Accepts: messages[], sessionId, tier
  - Rate limiting
  - Calls chat orchestrator
  - Streams SSE response
  - Prosecutor mode: can ask "What evidence exists against [person]?" and get a structured dossier

### Scripts

- [ ] `scripts/download-datasets.sh` — Download all 12 DOJ datasets
  - Downloads from justice.gov/epstein
  - Handles resume on interrupted downloads (wget --continue)
  - Extracts ZIPs to `data/raw/dataset-{N}/`
  - Optional single dataset: `./scripts/download-datasets.sh 4`

- [ ] `scripts/download-dataset.sh` — Download a specific dataset by number
  - Single dataset download helper

- [ ] `scripts/seed-sample-data.ts` — Process sample docs (~$200 worth)
  - Curated sample: flight logs, deposition excerpts, notable photos
  - Processes through full pipeline
  - Creates realistic data in all tables

- [ ] `scripts/ingest-directory.ts` — Ingest a local directory of files
  - Point at a directory, process all files
  - Creates documents, runs pipeline stages

- [ ] `scripts/estimate-costs.ts` — Estimate processing cost for a directory
  - Count pages, estimate API costs per stage
  - Output breakdown: OCR, embeddings, entity extraction, etc.

## Files to Create

```
worker/
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts
    ├── pipeline/
    │   ├── orchestrator.ts
    │   ├── job-queue.ts
    │   └── stages.ts
    ├── services/
    │   ├── document-ai-ocr.ts
    │   ├── document-converter.ts
    │   ├── smart-chunker.ts
    │   ├── contextual-header-gen.ts
    │   ├── embedding-service.ts
    │   ├── visual-embedding-service.ts
    │   ├── embedding-cache.ts
    │   ├── classifier.ts
    │   ├── entity-extractor.ts
    │   ├── relationship-mapper.ts
    │   ├── redaction-detector.ts
    │   ├── cohere-reranker.ts
    │   ├── video-transcriber.ts
    │   ├── cascade-engine.ts
    │   ├── document-summarizer.ts
    │   ├── audio-processor.ts
    │   ├── structured-extractor.ts
    │   ├── entity-merge-detector.ts
    │   ├── pattern-detector.ts
    │   ├── criminal-indicator-scorer.ts
    │   └── hint-processor.ts
    ├── chatbot/
    │   ├── chat-orchestrator.ts
    │   ├── rag-retrieval.ts
    │   ├── intent-classifier.ts
    │   ├── conversation-memory.ts
    │   └── tools/
    │       ├── search-documents.ts
    │       ├── search-images.ts
    │       ├── lookup-entity.ts
    │       ├── map-connections.ts
    │       ├── build-timeline.ts
    │       ├── cross-reference.ts
    │       ├── search-by-date.ts
    │       └── find-similar.ts
    └── api/
        └── chat.ts
scripts/
├── download-datasets.sh
├── download-dataset.sh
├── seed-sample-data.ts
├── ingest-directory.ts
└── estimate-costs.ts
```

## Acceptance Criteria

1. `cd worker && pnpm install && pnpm dev` starts the worker (Express server listening)
2. `GET /health` returns 200
3. Pipeline orchestrator runs through all stages with stub implementations (no real API calls)
4. Document processing updates status through: pending → ocr → chunking → embedding → entity_extraction → complete
5. Chat API (`POST /chat`) returns streaming SSE response
6. Chat orchestrator calls tools and includes citations
7. Cascade engine finds similar redactions given a solved one
8. Embedding cache returns cached results without calling provider
9. `scripts/download-datasets.sh` is executable and has correct URLs
10. `scripts/estimate-costs.ts` outputs cost breakdown for a sample directory
11. All services use AI provider interfaces (not direct imports)
12. Error handling: failed stages retry up to 3 times, then mark as failed

## Notes

- Worker is a standalone project — its own `package.json`, `tsconfig.json`, `node_modules`
- Worker connects to the same Supabase project using service role key
- Worker uses the same AI provider interfaces defined in the main project's `lib/ai/`
  - Either copy interfaces or use a shared package reference
  - Simplest approach: import from main project via relative path or symlink
- Redis is optional — can use polling-based job queue as fallback
- All pipeline stages should be idempotent (safe to re-run)
