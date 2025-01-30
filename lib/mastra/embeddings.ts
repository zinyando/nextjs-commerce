import { embed } from "@mastra/rag";

export async function generateEmbedding(chunks: string): Promise<number[]> {
  const { embedding } = await embed(chunks, {
    provider: "OPEN_AI",
    model: "text-embedding-3-small",
    maxRetries: 3
  });
    
  return embedding;
}
