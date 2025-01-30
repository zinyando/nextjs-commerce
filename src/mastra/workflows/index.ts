import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';
import { generateEmbedding } from '../../../lib/mastra/embeddings';
import { storeProductEmbedding } from '../../../lib/mastra/pgvector';
import { ShopifyClient } from '../../../lib/mastra/shopify';

const shopifyProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  handle: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  variants: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      price: z.string(),
    })
  ).optional(),
  tags: z.array(z.string()).optional(),
});

export const shopifyVectorWorkflow = new Workflow({
  name: 'shopify-vector-workflow',
});

const fetchProductsStep = new Step({
  id: 'fetchProductsStep',
  output: z.array(shopifyProductSchema),
  execute: async ({ context: { machineContext } }) => {
    console.log("Fetching products...");
    const shopify = new ShopifyClient(
      process.env.SHOPIFY_STORE_DOMAIN!,
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!
    );

    return await shopify.fetchProducts();
  }
});

const generateEmbeddingsStep = new Step({
  id: 'generateEmbeddingsStep',
  input: z.array(shopifyProductSchema),
  output: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      title: z.string(),
      description: z.string(),
      updated_at: z.string(),
      tags: z.array(z.string()),
      embedding: z.array(z.number()),
    })
  ),
  execute: async ({ context: { machineContext } }) => {
    const products = machineContext?.stepResults?.fetchProductsStep?.payload;
    if (!products || !Array.isArray(products)) {
      throw new Error('Products not found in step results or invalid format');
    }

    const results = [];
    for (const product of products) {
      const productText = [
        product.title,
        product.description,
        ...(product.tags || [])
      ].filter(Boolean).join(' ');
      
      const embedding = await generateEmbedding(productText);
      results.push({
        id: product.id,
        handle: product.handle,
        title: product.title,
        description: product.description,
        updated_at: product.updatedAt,
        tags: product.tags || [],
        embedding
      });
    }
    return results;
  }
});

const storeEmbeddingsStep = new Step({
  id: 'storeEmbeddingsStep',
  input: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      title: z.string(),
      description: z.string(),
      updated_at: z.string(),
      tags: z.array(z.string()),
      embedding: z.array(z.number()),
    })
  ),
  output: z.object({ success: z.boolean() }),
  execute: async ({ context: { machineContext } }) => {
    const productsWithEmbeddings = machineContext?.stepResults?.generateEmbeddingsStep?.payload;
    if (!productsWithEmbeddings || !Array.isArray(productsWithEmbeddings)) {
      throw new Error('Products not found in step results or invalid format');
    }

    const embeddings = productsWithEmbeddings.map(p => p.embedding);
    const products = productsWithEmbeddings.map(({ embedding, ...product }) => product);
    
    await storeProductEmbedding(embeddings, products);
    return { success: true };
  }
});

shopifyVectorWorkflow
  .step(fetchProductsStep)
  .then(generateEmbeddingsStep)
  .then(storeEmbeddingsStep)
  .commit();
