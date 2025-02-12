import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Step, Workflow } from '@mastra/core/workflows';
import { generateText } from 'ai';
import { z } from 'zod';
import { generateEmbedding } from '../../../lib/mastra/embeddings';
import { storeProductEmbedding } from '../../../lib/mastra/pgvector';
import { ShopifyClient } from '../../../lib/mastra/shopify';

const mastra = new Mastra();

const llm = openai('gpt-4o-mini');

const shopifyProductSchema = z.object({
  id: z.string(),
  handle: z.string(),
  availableForSale: z.boolean(),
  title: z.string(),
  description: z.string(),
  descriptionHtml: z.string(),
  options: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(z.string())
      })
    )
    .optional(),
  priceRange: z.object({
    maxVariantPrice: z.object({
      amount: z.string(),
      currencyCode: z.string()
    }),
    minVariantPrice: z.object({
      amount: z.string(),
      currencyCode: z.string()
    })
  }),
  featuredImage: z
    .object({
      url: z.string(),
      altText: z.string().nullable(),
      width: z.number(),
      height: z.number()
    })
    .optional(),
  seo: z
    .object({
      title: z.string(),
      description: z.string()
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
  images: z
    .array(
      z.object({
        url: z.string(),
        altText: z.string().nullable(),
        width: z.number(),
        height: z.number()
      })
    )
    .optional(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        availableForSale: z.boolean(),
        price: z.object({
          amount: z.string(),
          currencyCode: z.string()
        }),
        selectedOptions: z.array(
          z.object({
            name: z.string(),
            value: z.string()
          })
        )
      })
    )
    .optional()
});

const productWithEmbeddingSchema = shopifyProductSchema.extend({
  embedding: z.array(z.number())
});

export const shopifyRagWorkflow = new Workflow({
  name: 'shopify-rag-workflow',
  triggerSchema: z.object({
    inputValue: shopifyProductSchema
  })
});

const fetchProductsStep = new Step({
  id: 'fetchProductsStep',
  input: z.object({
    inputValue: shopifyProductSchema.optional()
  }),
  output: z.array(shopifyProductSchema),
  execute: async ({ context }) => {
    if (context?.triggerData && Object.keys(context.triggerData).length > 0) {
      return context.triggerData;
    }

    const shopify = new ShopifyClient(
      process.env.SHOPIFY_STORE_DOMAIN!,
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!
    );

    try {
      return await shopify.fetchProducts();
    } catch (error) {
      console.error('Error in fetchProductsStep:', error);
      throw error;
    }
  }
});

async function getImageDescription(imageUrl: string): Promise<string> {
  try {
    let prompt = `Describe what you see in order of prominence:
    "[Main colors] [item type] with [visual patterns/details], featuring [prominent visual elements], shown [position/context]"

    Example: "Pristine white running shoes with crimson zigzag stripes, featuring glossy silver eyelets and translucent air bubble sole, displayed floating on black surface."

    ## Color Profile
    Primary: [Dominant color] - describe finish (matte/glossy/metallic)
    Secondary: [Supporting colors] - describe patterns/placement
    Accents: [Small color details] - describe where they appear
    Contrast: [Note any striking color combinations]

    ## Visual Details
    Shape: [Overall silhouette and form]
    Patterns: [Any repeating elements]
    Textures: [Surface appearances]
    Highlights: [Shiny/reflective areas]
    Shadows: [Dark/depth areas]

    ## Core Attributes
    - Type: [Product category]
    - Colors: [Main + accent colors]
    - Materials: [Key visible materials]
    - Style: [Design type]
    - View: [Camera angle/perspective]
    - Textures: [material appearances]
    - Patterns: [design elements]
    - Visual effects: [how light interacts]

    ## Search Terms
    Include three types of terms:
    1. Product variations (sneakers, trainers, athletic shoes)
    2. Use cases (running, training, sports)
    3. Key features (breathable, cushioned, lightweight)

    ## Distinctive Elements
    List up to 3 unique or notable features that distinguish this item.`;

    const { text } = await generateText({
      model: openai('gpt-4o'),
      messages: [
        {
          role: 'system',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: imageUrl }
          ]
        }
      ]
    });

    return text || '';
  } catch (error) {
    console.error('Error getting image description:', error);
    return '';
  }
}

const generateEmbeddingsStep = new Step({
  id: 'generateEmbeddingsStep',
  input: z.array(shopifyProductSchema),
  output: z.array(productWithEmbeddingSchema),
  execute: async ({ context }) => {
    const fetchProductsResult = context?.steps?.fetchProductsStep;
    if (!fetchProductsResult || fetchProductsResult.status !== 'success') {
      throw new Error('Previous step failed or not completed');
    }

    const products = fetchProductsResult.output;
    if (!products || !Array.isArray(products)) {
      throw new Error('Products not found in step results or invalid format');
    }

    const results = [];
    for (const product of products) {
      let imageDescription = '';
      if (product.featuredImage?.url) {
        imageDescription = await getImageDescription(product.featuredImage.url);
      }

      const productText = [
        product.title,
        product.description,
        imageDescription,
        ...(product.tags || [])
      ]
        .filter(Boolean)
        .join(' ');

      const embedding = await generateEmbedding(productText);
      results.push({
        ...product,
        embedding
      });
    }
    return results;
  }
});

const storeEmbeddingsStep = new Step({
  id: 'storeEmbeddingsStep',
  input: z.array(productWithEmbeddingSchema),
  output: z.object({ success: z.boolean() }),
  execute: async ({ context }) => {
    const generateEmbeddingsResult = context?.steps?.generateEmbeddingsStep;
    if (!generateEmbeddingsResult || generateEmbeddingsResult.status !== 'success') {
      throw new Error('Previous step failed or not completed');
    }

    const productsWithEmbeddings = generateEmbeddingsResult.output;
    if (!productsWithEmbeddings || !Array.isArray(productsWithEmbeddings)) {
      throw new Error('Products not found in step results or invalid format');
    }

    const embeddings = productsWithEmbeddings.map((p) => p.embedding);
    const products = productsWithEmbeddings.map(({ embedding, ...product }) => product);

    await storeProductEmbedding(embeddings, products);
    return { success: true };
  }
});

shopifyRagWorkflow
  .step(fetchProductsStep)
  .then(generateEmbeddingsStep)
  .then(storeEmbeddingsStep)
  .commit();
