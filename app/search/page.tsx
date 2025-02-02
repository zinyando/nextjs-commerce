import Grid from 'components/grid';
import ProductGridItems from 'components/layout/product-grid-items';
import { defaultSort, sorting } from 'lib/constants';
import { searchProducts } from 'lib/mastra/pgvector';
import { getProducts } from 'lib/shopify';

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
  
  const directMatches = products;
  const productsWithScores = (searchResults?.products ?? [])
    .map((product, index) => ({
      product,
      score: searchResults?.scores?.[index] ?? 1
    }))
    .filter(({ product }) => !directMatches.some(directMatch => directMatch.id === product.id))
    .sort((a, b) => b.score - a.score);

  const highConfidenceMatches = productsWithScores
    .filter(({ score }) => score > 0.4)
    .map(({ product }) => product);

  const highConfidenceOrTop3 = highConfidenceMatches.length > 0 
    ? highConfidenceMatches 
    : productsWithScores.slice(0, 3).map(({ product }) => product);

  const lowConfidenceMatches = productsWithScores
    .filter(({ score }) => score <= 0.4)
    .map(({ product }) => product)
    .filter(product => !highConfidenceOrTop3.some(highMatch => highMatch.id === product.id));

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
                {directMatches.length === 0 && highConfidenceOrTop3.length === 0 && lowConfidenceMatches.length === 0 ? (
                  <>
                    No results found for <span className="font-medium">&quot;{searchValue}&quot;</span>
                  </>
                ) : directMatches.length === 0 ? (
                  <>
                    No exact matches found for <span className="font-medium">&quot;{searchValue}&quot;</span>
                  </>
                ) : (
                  <>
                    Found results for <span className="font-medium">&quot;{searchValue}&quot;</span>
                  </>
                )}
              </p>
            </div>
            {directMatches.length === 0 && highConfidenceOrTop3.length === 0 && lowConfidenceMatches.length === 0 ? (
              <p className="text-neutral-500 dark:text-neutral-400 ml-7">
                Try adjusting your search terms or browse our categories.
              </p>
            ) : (
              <div className="text-sm text-neutral-500 dark:text-neutral-400 ml-7">
                {directMatches.length > 0 && (
                  <p>{directMatches.length} exact {directMatches.length === 1 ? 'match' : 'matches'}</p>
                )}
                {highConfidenceOrTop3.length > 0 && (
                  <p>{highConfidenceOrTop3.length} similar {highConfidenceOrTop3.length === 1 ? 'product' : 'products'}</p>
                )}
                {lowConfidenceMatches.length > 0 && (
                  <p>{lowConfidenceMatches.length} related {lowConfidenceMatches.length === 1 ? 'suggestion' : 'suggestions'}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
      
      {/* Direct Matches */}
      {directMatches.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Exact Matches</h2>
          <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <ProductGridItems products={directMatches} />
          </Grid>
        </div>
      )}

      {/* High Confidence Semantic Matches */}
      {highConfidenceOrTop3.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Similar Products</h2>
          <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <ProductGridItems products={highConfidenceOrTop3} />
          </Grid>
        </div>
      )}

      {/* Low Confidence Semantic Matches */}
      {lowConfidenceMatches.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg text-neutral-600 dark:text-neutral-400">You might also be interested in:</h2>
          <div className="space-y-3">
            {lowConfidenceMatches.map((product) => (
              <a
                key={product.handle}
                href={`/product/${product.handle}`}
                className="block text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
              >
                {product.title}
                <span className="text-sm text-neutral-500 dark:text-neutral-500 ml-2">
                  {product.priceRange.maxVariantPrice.amount} {product.priceRange.maxVariantPrice.currencyCode}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
