import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';
import { chunkProducts } from '../../../lib/mastra/chunking';
import { generateEmbedding } from '../../../lib/mastra/embeddings';
import { storeProductEmbedding } from '../../../lib/mastra/supabase';
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

const chunkProductsStep = new Step({
  id: 'chunkProductsStep',
  input: z.array(shopifyProductSchema),
  output: z.object({ chunks: z.array(z.string()) }),
  execute: async ({ context: { machineContext } }) => {
    const products = machineContext?.stepResults?.fetchProductsStep?.payload;
    if (!products || !Array.isArray(products)) {
      throw new Error('Products not found in input or invalid format');
    }

    const chunks = await chunkProducts(products);
    return { chunks };
  }
});

const generateEmbeddingsStep = new Step({
  id: 'generateEmbeddingsStep',
  input: z.object({ chunks: z.array(z.string()) }),
  output: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      embedding: z.array(z.number()),
    })
  ),
  execute: async ({ context: { machineContext } }) => {
    const chunks = machineContext?.stepResults?.chunkProductsStep?.payload?.chunks;
    if (!chunks || !Array.isArray(chunks)) {
      throw new Error('Chunks not found in step results or invalid format');
    }

    const results = [];
    for (const chunk of chunks) {
      const combinedText = `${chunk.title} ${chunk.description}`;
      const embedding = await generateEmbedding(combinedText);
      results.push({
        ...chunk,
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
      title: z.string(),
      description: z.string(),
      embedding: z.array(z.number()),
    })
  ),
  output: z.object({ success: z.boolean() }),
  execute: async ({ context: { machineContext } }) => {
    const productsWithEmbeddings = machineContext?.stepResults?.generateEmbeddingsStep?.payload;
    if (!productsWithEmbeddings || !Array.isArray(productsWithEmbeddings)) {
      throw new Error('Products not found in step results or invalid format');
    }

    // Store each product with its embedding
    await Promise.all(productsWithEmbeddings.map(async (product) => {
      await storeProductEmbedding(
        {
          id: product.id,
          title: product.title,
          description: product.description,
          handle: product.handle,
          createdAt: product.createdAt,
          updatedAt: new Date().toISOString(),
        },
        product.embedding
      );
    }));

    return { success: true };
  }
});

shopifyVectorWorkflow
  .step(fetchProductsStep)
  .then(chunkProductsStep)
  .then(generateEmbeddingsStep)
  .then(storeEmbeddingsStep)
  .commit();

  const { runId, start } = shopifyVectorWorkflow.createRun();

  const result = await start();
  console.log("Workflow result:", result.results);
