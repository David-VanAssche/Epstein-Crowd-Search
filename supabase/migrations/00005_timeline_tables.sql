-- 00005_timeline_tables.sql

CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date TIMESTAMPTZ,
  date_precision TEXT DEFAULT 'exact',
  date_display TEXT,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,
  location TEXT,
  source_chunk_ids UUID[],
  source_document_ids UUID[],
  entity_ids UUID[],
  content_embedding VECTOR(1024),
  is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Structured flight data from Archive.org flight logs, epsteinsblackbook.com,
-- and Epstein Exposed 1,700 flights. Generic timeline_events lacks flight-specific fields.
CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_date DATE,
  departure TEXT,
  arrival TEXT,
  aircraft TEXT,
  tail_number TEXT,
  pilot TEXT,
  passenger_names TEXT[],
  passenger_entity_ids UUID[],
  source TEXT,               -- 'archive_org' | 'blackbook' | 'epstein_exposed' | 'pipeline'
  raw_text TEXT,
  document_id UUID REFERENCES documents(id),
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON flights FOR SELECT USING (true);

CREATE INDEX idx_flights_date ON flights (flight_date);
CREATE INDEX idx_flights_passengers ON flights USING gin (passenger_names);
