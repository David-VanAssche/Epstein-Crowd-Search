-- 00048: Flight enrichment columns
--
-- Adds structured fields to the flights table for:
--   - passenger_count (derived from passenger_names array length)
--   - aircraft_type (parsed from aircraft field, e.g. "Gulfstream G550")
--   - departure_iata / arrival_iata (normalized IATA airport codes)

ALTER TABLE flights ADD COLUMN IF NOT EXISTS passenger_count INTEGER DEFAULT 0;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS aircraft_type TEXT;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS departure_iata TEXT;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS arrival_iata TEXT;

CREATE INDEX idx_flights_departure_iata ON flights (departure_iata) WHERE departure_iata IS NOT NULL;
CREATE INDEX idx_flights_arrival_iata ON flights (arrival_iata) WHERE arrival_iata IS NOT NULL;
CREATE INDEX idx_flights_tail_number ON flights (tail_number) WHERE tail_number IS NOT NULL;
CREATE INDEX idx_flights_document ON flights (document_id) WHERE document_id IS NOT NULL;
