import { embed } from "@mastra/rag";
import { PgVector } from '@mastra/vector-pg';
import { Product } from 'lib/shopify/types';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

const connectionString = process.env.POSTGRES_CONNECTION_STRING;
if (!connectionString) {
  throw new Error('POSTGRES_CONNECTION_STRING is required');
}

const pgVector = new PgVector(connectionString);

await pgVector.createIndex("products", 1536);

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
    "products",
    embeddings,
    products.map(product => ({
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

export async function searchProducts(query?: string): Promise<(Product | undefined)[]> {
  if (!query) {
    // Return all products using Supabase
    const { data: products, error } = await supabase
      .from('products')
      .select('*');

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }

    return products.map(product => product.metadata as Product | undefined);
  }

  const { embedding } = await embed(query, { provider: "OPEN_AI", model: "text-embedding-3-small", maxRetries: 3 });
  const results = await pgVector.query("products", embedding, 20);

  return results
    .filter(result => result.score > 0.5)
    .map(result => result.metadata as Product | undefined);
}
