import { embed } from "@mastra/rag";

export async function generateEmbedding(chunks: string): Promise<number[]> {
  const embeddings = await embed(chunks, {
    provider: "OPEN_AI",
    model: "text-embedding-3-small",
    maxRetries: 3
  });
    
  if ('embeddings' in embeddings) {
    const embedding = embeddings.embeddings[0];
    if (!embedding) {
      throw new Error('Failed to generate embedding: No embedding vector returned');
    }
    return embedding;
  } else {
    const embedding = embeddings.embedding;
    if (!embedding) {
      throw new Error('Failed to generate embedding: No embedding vector returned');
    }
    return embedding;
  }
}
