import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

export async function generateEmbedding(chunk: string): Promise<number[]> {
  const { embedding } = await embed({
    value: chunk,
    model: openai.embedding('text-embedding-3-small')
  });

  return embedding;
}
