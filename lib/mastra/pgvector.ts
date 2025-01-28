import { PgVector } from '@mastra/vector-pg';

const connectionString = process.env.POSTGRES_CONNECTION_STRING;
if (!connectionString) {
  throw new Error('POSTGRES_CONNECTION_STRING environment variable is not set');
}

const pgVector = new PgVector(connectionString);

await pgVector.createIndex("embeddings", 1536);

interface ProductMetadata {
  id: string;
  title: string;
  description?: string;
}

export async function storeProductEmbedding(embeddings: number[][], products: ProductMetadata[]) {
  if (embeddings.length !== products.length) {
    throw new Error('Number of embeddings must match number of products');
  }

  return pgVector.upsert(
    "embeddings",
    embeddings,
    products.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description
    }))
  );
}
