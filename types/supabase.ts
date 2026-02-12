// types/supabase.ts
// This file is a placeholder. Regenerate from your live schema with:
//   npx supabase gen types typescript --project-id <ref> > types/supabase.ts
// Or run: ./scripts/setup-types.sh

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Placeholder Database type — replace with generated types after running migrations.
// Uses `any` for Row/Insert/Update to avoid Supabase client generic resolution
// producing `never` types. Once real types are generated, this is replaced entirely.
export interface Database {
  public: {
    Tables: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
    }
    Views: {
      [key: string]: {
        Row: any
        Relationships: any[]
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
