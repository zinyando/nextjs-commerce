import { MDocument } from "@mastra/rag";
import { ShopifyProduct } from "./shopify";

interface ChunkingOptions {
  strategy?: "recursive";
  size?: number;
  overlap?: number;
}

export async function chunkProducts(
  products: ShopifyProduct[],
  options: ChunkingOptions = {
    strategy: "recursive",
    size: 512,
    overlap: 50,
  }
) {
  const doc = MDocument.fromJSON(JSON.stringify(products));
  return await doc.chunk(options);
}
