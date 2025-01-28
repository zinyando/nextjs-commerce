import { createClient } from '@supabase/supabase-js';
import { ShopifyProduct } from './shopify';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function storeProductEmbedding(
  product: ShopifyProduct,
  embedding: number[],
): Promise<void> {
  await supabase.from('products').upsert({
    product_id: product.id,
    embedding,
    title: product.title,
    description: product.description,
    updated_at: product.updatedAt,
  });
}
