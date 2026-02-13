// lib/chat/intent-classifier.ts
// TODO: Classify user chat intents to route to appropriate tools.

export type ChatIntent =
  | 'search'
  | 'entity_lookup'
  | 'timeline'
  | 'connection_map'
  | 'general_question'
  | 'clarification'

export async function classifyIntent(_message: string): Promise<ChatIntent> {
  // TODO: Implement intent classification
  // Use a lightweight model or keyword matching to classify intent
  return 'general_question'
}
