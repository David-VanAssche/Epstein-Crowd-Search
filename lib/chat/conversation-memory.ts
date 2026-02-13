// lib/chat/conversation-memory.ts
// TODO: Manage conversation context window for multi-turn chat.

import { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage } from './chat-orchestrator'

export async function loadConversationHistory(
  _conversationId: string,
  _supabase: SupabaseClient,
  _maxMessages?: number
): Promise<ChatMessage[]> {
  // TODO: Load conversation history from database
  // 1. Fetch messages from chat_conversations table
  // 2. Trim to fit context window
  // 3. Summarize older messages if needed
  return []
}

export async function saveConversationMessage(
  _conversationId: string,
  _message: ChatMessage,
  _supabase: SupabaseClient
): Promise<void> {
  // TODO: Append message to conversation in database
}
