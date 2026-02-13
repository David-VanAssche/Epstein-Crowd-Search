// lib/chat/tools/search-images.ts
// TODO: Search images using visual embeddings in the same 1024d space as text.

import type { ChatTool } from '../chat-orchestrator'

export const searchImagesTool: ChatTool = {
  name: 'search_images',
  description: 'Search images in the archive using text queries (same embedding space as documents).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for images' },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
    required: ['query'],
  },
  execute: async () => {
    // TODO: Implement image search using Nova visual embeddings
    return 'Image search is not yet implemented.'
  },
}
