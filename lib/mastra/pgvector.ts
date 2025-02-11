import { openai } from '@ai-sdk/openai';
import { PgVector } from '@mastra/pg';
import { embed } from 'ai';
import { Product } from 'lib/shopify/types';

const connectionString = process.env.POSTGRES_CONNECTION_STRING;
if (!connectionString) {
  throw new Error('POSTGRES_CONNECTION_STRING is required');
}

const pgVector = new PgVector(connectionString);

await pgVector.createIndex('products', 1536);

interface ProductMetadata {
  id: string;
  handle: string;
  title: string;
  description?: string;
  updatedAt: string;
  tags?: string[];
  availableForSale?: boolean;
  descriptionHtml?: string;
  priceRange?: any;
  featuredImage?: any;
  seo?: any;
  images?: any[];
  variants?: any[];
  createdAt: string;
  options?: any[];
}

export async function storeProductEmbedding(embeddings: number[][], products: ProductMetadata[]) {
  if (embeddings.length !== products.length) {
    throw new Error('Number of embeddings must match number of products');
  }

  const result = await pgVector.upsert(
    'products',
    embeddings,
    products.map((product) => ({
      id: product.id,
      handle: product.handle,
      title: product.title,
      description: product.description,
      updatedAt: product.updatedAt,
      tags: product.tags || [],
      availableForSale: product.availableForSale,
      descriptionHtml: product.descriptionHtml,
      priceRange: product.priceRange,
      featuredImage: product.featuredImage,
      seo: product.seo,
      images: product.images,
      variants: product.variants,
      createdAt: product.createdAt,
      options: product.options
    }))
  );

  return result;
}

export async function searchProducts(query?: string) {
  if (!query) {
    return { products: [], scores: [] };
  }

  const { embedding } = await embed({
    value: query,
    model: openai.embedding('text-embedding-3-small')
  });

  const results = await pgVector.query('products', embedding, 10);

  return {
    products: results.map((result) => result.metadata as Product),
    scores: results.map((result) => result.score as number)
  };
}
