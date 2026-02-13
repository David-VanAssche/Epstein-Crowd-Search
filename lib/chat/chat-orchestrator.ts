// lib/chat/chat-orchestrator.ts
// Agentic tool-calling loop for the research assistant chatbot.
// Receives user message + history, calls tools iteratively, returns response with citations.

import { SupabaseClient } from '@supabase/supabase-js'
import { searchDocumentsTool } from './tools/search-documents'
import { lookupEntityTool } from './tools/lookup-entity'
import { mapConnectionsTool } from './tools/map-connections'
import { buildTimelineTool } from './tools/build-timeline'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
}

export interface ChatTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (params: Record<string, unknown>, supabase: SupabaseClient) => Promise<string>
}

export interface ChatResponse {
  content: string
  citations: Array<{ documentId: string; chunkId: string; text: string }>
  toolsUsed: string[]
}

const SYSTEM_PROMPT = `You are a research assistant for the Epstein Files Archive — a database of 3.5 million pages of documents released by the U.S. Department of Justice. Your role is to help researchers, journalists, and the public navigate this evidence.

Guidelines:
- Always cite your sources with document IDs and page numbers
- Be factual — state what the documents show, not conclusions
- Flag potential connections but note they need verification
- For sensitive content, maintain professional research tone
- If asked about criminal activity, present evidence patterns without making accusations
- Distinguish between verified facts and speculation

You have access to tools for searching documents, looking up entities, mapping connections, and building timelines. Use them to answer questions thoroughly.`

export class ChatOrchestrator {
  private tools: Map<string, ChatTool> = new Map()
  private supabase: SupabaseClient
  private apiKey: string
  private maxIterations: number

  constructor(supabase: SupabaseClient, apiKey: string, maxIterations = 5) {
    this.supabase = supabase
    this.apiKey = apiKey
    this.maxIterations = maxIterations

    // Register tools
    this.registerTool(searchDocumentsTool)
    this.registerTool(lookupEntityTool)
    this.registerTool(mapConnectionsTool)
    this.registerTool(buildTimelineTool)
  }

  registerTool(tool: ChatTool): void {
    this.tools.set(tool.name, tool)
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const toolsUsed: string[] = []
    const allCitations: ChatResponse['citations'] = []

    // Build conversation with system prompt
    const conversation: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ]

    // Tool-calling loop
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      const response = await this.callLLM(conversation)

      // Check if the response includes tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          const tool = this.tools.get(toolCall.name)
          if (!tool) {
            conversation.push({
              role: 'tool',
              content: `Error: Unknown tool "${toolCall.name}"`,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
            })
            continue
          }

          try {
            const result = await tool.execute(toolCall.arguments, this.supabase)
            conversation.push({
              role: 'tool',
              content: result,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
            })
            toolsUsed.push(toolCall.name)
          } catch (err) {
            conversation.push({
              role: 'tool',
              content: `Error executing ${toolCall.name}: ${err instanceof Error ? err.message : String(err)}`,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
            })
          }
        }

        // Continue loop — LLM will process tool results
        continue
      }

      // No tool calls — return final response
      return {
        content: response.content,
        citations: allCitations,
        toolsUsed: [...new Set(toolsUsed)],
      }
    }

    // Max iterations reached
    return {
      content: 'I reached the maximum number of tool calls. Here is what I found so far based on the research conducted.',
      citations: allCitations,
      toolsUsed: [...new Set(toolsUsed)],
    }
  }

  private async callLLM(
    messages: ChatMessage[]
  ): Promise<{
    content: string
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  }> {
    // Build tool definitions for the API
    const toolDefs = Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))

    const geminiMessages = messages.map((m) => ({
      role: m.role === 'system' ? 'user' : m.role === 'tool' ? 'user' : m.role,
      parts: [{ text: m.role === 'system' ? `[SYSTEM] ${m.content}` : m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.CHAT_MODEL || 'gemini-2.0-flash'}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          tools: [{ functionDeclarations: toolDefs }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Chat LLM API failed: ${response.status}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    const parts = candidate?.content?.parts || []

    // Check for function calls
    const functionCalls = parts.filter((p: any) => p.functionCall)
    if (functionCalls.length > 0) {
      return {
        content: '',
        toolCalls: functionCalls.map((p: any, i: number) => ({
          id: `call_${i}`,
          name: p.functionCall.name,
          arguments: p.functionCall.args || {},
        })),
      }
    }

    // Text response
    const textContent = parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('')

    return { content: textContent }
  }
}
