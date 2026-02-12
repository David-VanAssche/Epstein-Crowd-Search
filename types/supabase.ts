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

// Placeholder Database type — replace with generated types after running migrations
export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, unknown>
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
  }
}
