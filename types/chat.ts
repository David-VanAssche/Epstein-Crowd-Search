// types/chat.ts

export type ChatRole = 'user' | 'assistant' | 'system'

export type ModelTier = 'free' | 'researcher' | 'pro'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  citations?: Citation[]
  tool_calls?: ToolCall[]
  created_at: string
}

export interface Citation {
  document_id: string
  document_filename: string
  page_number: number | null
  chunk_id: string
  snippet: string
  dataset_name: string | null
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface ChatConversation {
  id: string
  user_id: string | null
  session_id: string
  title: string | null
  messages: ChatMessage[]
  model_tier: ModelTier
  message_count: number
  created_at: string
  updated_at: string
}

export interface ChatStreamEvent {
  type: 'text_delta' | 'citation' | 'tool_call' | 'done' | 'error'
  content?: string
  citation?: Citation
  tool_call?: ToolCall
  error?: string
}

export interface ChatRequest {
  message: string
  conversation_id?: string
  session_id: string
  model_tier?: ModelTier
}
