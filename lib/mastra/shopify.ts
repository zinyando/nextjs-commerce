// lib/shopify.ts
import { GraphQLClient } from 'graphql-request';

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  createdAt: string;
  updatedAt: string;
  variants?: Array<{
    id: string;
    title: string;
    price: string;
  }>;
}

interface ShopifyProductEdge {
  node: ShopifyProduct;
}

interface ShopifyProductsResponse {
  products: {
    edges: ShopifyProductEdge[];
  };
}

export class ShopifyClient {
  private client: GraphQLClient;

  constructor(shopDomain: string, accessToken: string) {
    this.client = new GraphQLClient(
      `https://${shopDomain}/api/2024-01/graphql.json`,
      {
        headers: {
          'X-Shopify-Storefront-Access-Token': accessToken,
        },
      }
    );
  }

  async fetchProducts(first: number = 100): Promise<ShopifyProduct[]> {
    const query = `
      query GetProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              description
              updatedAt
            }
          }
        }
      }
    `;

    const response = await this.client.request<ShopifyProductsResponse>(query, {
      first,
    });

    return response.products.edges.map((edge) => edge.node);
  }
}