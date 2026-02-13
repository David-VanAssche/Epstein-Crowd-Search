// lib/pipeline/services/structured-extractor.ts
// Extract structured records from semi-structured documents.
// Handles: flight manifests, financial records, phone records, address books.

import { SupabaseClient } from '@supabase/supabase-js'

type ExtractionType = 'flight_manifest' | 'financial_record' | 'phone_record' | 'address_book'

interface FlightRecord {
  date: string | null
  aircraft: string | null
  origin: string | null
  destination: string | null
  passengers: string[]
  pilot: string | null
}

interface FinancialRecord {
  date: string | null
  amount: number | null
  currency: string
  fromAccount: string | null
  toAccount: string | null
  parties: string[]
  description: string | null
}

interface PhoneRecord {
  date: string | null
  fromNumber: string | null
  toNumber: string | null
  duration: string | null
  parties: string[]
}

interface AddressBookEntry {
  name: string
  addresses: string[]
  phoneNumbers: string[]
  relationships: string[]
}

type StructuredRecord = FlightRecord | FinancialRecord | PhoneRecord | AddressBookEntry

async function extractStructuredData(
  ocrText: string,
  documentType: string,
  apiKey: string
): Promise<{ type: ExtractionType; records: StructuredRecord[] }> {
  const typeMap: Record<string, ExtractionType> = {
    flight_log: 'flight_manifest',
    financial_record: 'financial_record',
    phone_record: 'phone_record',
    address_book: 'address_book',
  }

  const extractionType = typeMap[documentType]
  if (!extractionType) {
    return { type: 'flight_manifest', records: [] }
  }

  const textSample =
    ocrText.length > 15000
      ? ocrText.slice(0, 10000) + '\n...\n' + ocrText.slice(-5000)
      : ocrText

  const schemaByType: Record<ExtractionType, string> = {
    flight_manifest: `[{"date":"2003-07-15","aircraft":"N908JE","origin":"Teterboro","destination":"Palm Beach","passengers":["Name1","Name2"],"pilot":"Larry Visoski"}]`,
    financial_record: `[{"date":"2003-07-15","amount":50000,"currency":"USD","fromAccount":"...","toAccount":"...","parties":["Name"],"description":"Wire transfer"}]`,
    phone_record: `[{"date":"2003-07-15","fromNumber":"555-0100","toNumber":"555-0200","duration":"5:32","parties":["Name1","Name2"]}]`,
    address_book: `[{"name":"John Doe","addresses":["123 Main St"],"phoneNumbers":["555-0100"],"relationships":["associate"]}]`,
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract structured ${extractionType.replace('_', ' ')} records from this document.

Expected format (array of records):
${schemaByType[extractionType]}

Document text:
---
${textSample}
---

Return JSON: { "records": [...] }
Extract ALL records you can find. Use null for missing fields.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) return { type: extractionType, records: [] }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"records":[]}'

  try {
    return { type: extractionType, records: JSON.parse(text).records || [] }
  } catch {
    return { type: extractionType, records: [] }
  }
}

// --- Handler ---

export async function handleStructuredExtraction(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[StructuredExtract] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text, classification')
    .eq('id', documentId)
    .single()

  if (error || !doc || !(doc as any).ocr_text) return

  const structuredTypes = ['flight_log', 'financial_record', 'phone_record', 'address_book']
  if (!structuredTypes.includes((doc as any).classification || '')) return

  const { type, records } = await extractStructuredData(
    (doc as any).ocr_text,
    (doc as any).classification || '',
    apiKey
  )

  if (records.length === 0) return

  // Store in document metadata
  const { data: existing } = await supabase
    .from('documents')
    .select('metadata')
    .eq('id', documentId)
    .single()

  await supabase
    .from('documents')
    .update({
      metadata: {
        ...((existing as any)?.metadata as Record<string, unknown> || {}),
        structured_data_type: type,
        structured_records: records,
        structured_extraction_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  console.log(
    `[StructuredExtract] Document ${documentId}: extracted ${records.length} ${type} records`
  )
}
