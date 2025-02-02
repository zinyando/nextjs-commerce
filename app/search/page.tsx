import Grid from 'components/grid';
import ProductGridItems from 'components/layout/product-grid-items';
import { defaultSort, sorting } from 'lib/constants';
import { searchProducts } from 'lib/mastra/pgvector';
import { getProducts } from 'lib/shopify';
import { Product } from 'lib/shopify/types';

export const metadata = {
  title: 'Search',
  description: 'Search for products in the store.'
};

export default async function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const { sort, q: searchValue } = searchParams as { [key: string]: string };
  const { sortKey, reverse } = sorting.find((item) => item.slug === sort) || defaultSort;
  const products = await getProducts({ sortKey, reverse, query: searchValue });

  const searchResults = await searchProducts(searchValue || undefined);
  const ragProducts = searchResults.filter((product): product is Product => product !== undefined);
  const resultsText = products.length > 1 ? 'results' : 'result';

  return (
    <>
      {searchValue ? (
        <div className="mb-8">
          <div className="rounded-lg bg-white/50 backdrop-blur-sm p-6 shadow-[0_2px_4px_rgba(0,0,0,0.02)] dark:bg-neutral-950/30 dark:shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-neutral-400 dark:text-neutral-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-lg text-neutral-600 dark:text-neutral-300">
                {products.length === 0 && ragProducts.length === 0 ? (
                  <>
                    No results found for <span className="font-medium">&quot;{searchValue}&quot;</span>
                  </>
                ) : (
                  <>
                    Found results for <span className="font-medium">&quot;{searchValue}&quot;</span>
                  </>
                )}
              </p>
            </div>
            {products.length === 0 && ragProducts.length === 0 && (
              <p className="text-neutral-500 dark:text-neutral-400 ml-7">
                Try adjusting your search terms or browse our categories.
              </p>
            )}
            {(products.length > 0 || ragProducts.length > 0) && (
              <div className="text-sm text-neutral-500 dark:text-neutral-400 ml-7">
                <p>{products.length} direct {products.length === 1 ? 'match' : 'matches'}</p>
                <p>{ragProducts.length} semantic {ragProducts.length === 1 ? 'match' : 'matches'}</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {(products.length > 0 || ragProducts.length > 0) ? (
        <div>
          {products.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-4">Direct Matches</h2>
              <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                <ProductGridItems products={products} />
              </Grid>
            </>
          )}
          {ragProducts.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-4">Semantic Matches</h2>
              <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <ProductGridItems products={ragProducts} />
              </Grid>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
