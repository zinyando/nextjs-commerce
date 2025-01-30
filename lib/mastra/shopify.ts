// lib/shopify.ts
import { GraphQLClient } from 'graphql-request';

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  createdAt: string;
  updatedAt: string;
  availableForSale?: boolean;
  options?: Array<{
    name: string;
    values: string[];
  }>;
  priceRange?: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  featuredImage?: {
    url: string;
    altText: string;
    width: number;
    height: number;
  };
  seo?: {
    title: string;
    description: string;
  };
  tags?: string[];
  images?: Array<{
    url: string;
    altText: string;
    width: number;
    height: number;
  }>;
  variants?: Array<{
    id: string;
    title: string;
    availableForSale: boolean;
    price: {
      amount: string;
      currencyCode: string;
    };
    selectedOptions: Array<{
      name: string;
      value: string;
    }>;
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
              handle
              availableForSale
              title
              description
              descriptionHtml
              options {
                name
                values
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              featuredImage {
                url
                altText
                width
                height
              }
              seo {
                title
                description
              }
              tags
              updatedAt
              createdAt
              images(first: 10) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    price {
                      amount
                      currencyCode
                    }
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.client.request<{
        products: {
          edges: Array<{
            node: any;
          }>;
        };
      }>(query, { first });

      return response.products.edges.map(({ node }) => ({
        id: node.id,
        handle: node.handle,
        availableForSale: node.availableForSale,
        title: node.title,
        description: node.description,
        descriptionHtml: node.descriptionHtml,
        options: node.options,
        createdAt: node.createdAt,
        priceRange: {
          maxVariantPrice: node.priceRange.maxVariantPrice,
          minVariantPrice: node.priceRange.minVariantPrice
        },
        featuredImage: node.featuredImage,
        seo: node.seo,
        tags: node.tags,
        updatedAt: node.updatedAt,
        images: node.images.edges.map((edge: any) => edge.node),
        variants: node.variants.edges.map((edge: any) => edge.node)
      }));
    } catch (error) {
      console.error('Error fetching Shopify products:', error);
      throw error;
    }
  }
}