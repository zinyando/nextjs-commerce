import { embed } from "@mastra/rag";
import { PgVector } from '@mastra/vector-pg';

const connectionString = process.env.POSTGRES_CONNECTION_STRING;
if (!connectionString) {
  throw new Error('POSTGRES_CONNECTION_STRING environment variable is not set');
}

const pgVector = new PgVector(connectionString);

await pgVector.createIndex("products", 1536);

interface ProductMetadata {
  id: string;
  handle: string;
  title: string;
  description?: string;
  updated_at: string;
  tags?: string[];
}

export async function storeProductEmbedding(embeddings: number[][], products: ProductMetadata[]) {  
  if (embeddings.length !== products.length) {
    throw new Error('Number of embeddings must match number of products');
  }

  const result = await pgVector.upsert(
    "products",
    embeddings,
    products.map(product => ({
      id: product.id,
      handle: product.handle,
      title: product.title,
      description: product.description,
      updated_at: product.updated_at,
      tags: product.tags || []
    }))
  );

  return result;
}

export async function searchProducts(query: string) {
  const { embedding } = await embed(
    query,
    {
      provider: "OPEN_AI",
      model: "text-embedding-3-small",
      maxRetries: 3,
    }
  );

  const results = await pgVector.query("products", embedding, 10);
  
  return results.map(result => result.metadata);
}
