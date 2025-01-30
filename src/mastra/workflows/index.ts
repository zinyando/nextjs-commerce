import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';
import { generateEmbedding } from '../../../lib/mastra/embeddings';
import { storeProductEmbedding } from '../../../lib/mastra/pgvector';
import { ShopifyClient } from '../../../lib/mastra/shopify';

const shopifyProductSchema = z.object({
  id: z.string(),
  handle: z.string(),
  availableForSale: z.boolean(),
  title: z.string(),
  description: z.string(),
  descriptionHtml: z.string(),
  options: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string())
    })
  ).optional(),
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
  featuredImage: z.object({
    url: z.string(),
    altText: z.string().nullable(),
    width: z.number(),
    height: z.number()
  }).optional(),
  seo: z.object({
    title: z.string(),
    description: z.string()
  }).optional(),
  tags: z.array(z.string()).optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
  images: z.array(
    z.object({
      url: z.string(),
      altText: z.string().nullable(),
      width: z.number(),
      height: z.number()
    })
  ).optional(),
  variants: z.array(
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
  ).optional()
});

export const shopifyVectorWorkflow = new Workflow({
  name: 'shopify-vector-workflow',
});

const fetchProductsStep = new Step({
  id: 'fetchProductsStep',
  output: z.array(shopifyProductSchema),
  execute: async ({ context: { machineContext } }) => {
    const shopify = new ShopifyClient(
      process.env.SHOPIFY_STORE_DOMAIN!,
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!
    );

    try {
      return await shopify.fetchProducts();
    } catch (error) {
      console.error("Error in fetchProductsStep:", error);
      throw error;
    }
  }
});

const generateEmbeddingsStep = new Step({
  id: 'generateEmbeddingsStep',
  input: z.array(shopifyProductSchema),
  output: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      availableForSale: z.boolean(),
      title: z.string(),
      description: z.string(),
      descriptionHtml: z.string(),
      options: z.array(
        z.object({
          name: z.string(),
          values: z.array(z.string())
        })
      ).optional(),
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
      featuredImage: z.object({
        url: z.string(),
        altText: z.string().nullable(),
        width: z.number(),
        height: z.number()
      }).optional(),
      seo: z.object({
        title: z.string(),
        description: z.string()
      }).optional(),
      tags: z.array(z.string()).optional(),
      updatedAt: z.string(),
      createdAt: z.string(),
      images: z.array(
        z.object({
          url: z.string(),
          altText: z.string().nullable(),
          width: z.number(),
          height: z.number()
        })
      ).optional(),
      variants: z.array(
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
      ).optional(),
      embedding: z.array(z.number())
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
        ...product,
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
      availableForSale: z.boolean(),
      title: z.string(),
      description: z.string(),
      descriptionHtml: z.string(),
      options: z.array(
        z.object({
          name: z.string(),
          values: z.array(z.string())
        })
      ).optional(),
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
      featuredImage: z.object({
        url: z.string(),
        altText: z.string().nullable(),
        width: z.number(),
        height: z.number()
      }).optional(),
      seo: z.object({
        title: z.string(),
        description: z.string()
      }).optional(),
      tags: z.array(z.string()).optional(),
      updatedAt: z.string(),
      createdAt: z.string(),
      images: z.array(
        z.object({
          url: z.string(),
          altText: z.string().nullable(),
          width: z.number(),
          height: z.number()
        })
      ).optional(),
      variants: z.array(
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
      ).optional(),
      embedding: z.array(z.number())
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

  const { runId, start } = shopifyVectorWorkflow.createRun();

  const result = await start();
  console.log("Workflow result:", result.results);
