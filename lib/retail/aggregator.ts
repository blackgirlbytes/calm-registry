import "server-only";
import type { Offer, RetailerId } from "../types";
import { amazonProvider } from "./amazon";
import { catalogSearch } from "./catalog";
import { searchLinkOffer } from "./mock";
import type { RetailerProvider, SearchFilters } from "./provider";
import { targetProvider } from "./target";
import { walmartProvider } from "./walmart";

const PROVIDERS: RetailerProvider[] = [amazonProvider, walmartProvider, targetProvider];
const TIMEOUT_MS = 6000;
const MAX_OFFERS = 4;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function normalize(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 6).join(" ");
}

async function searchProvider(
  provider: RetailerProvider,
  query: string,
  filters: SearchFilters,
  catalog: Offer[] | null,
) {
  if (!provider.isConfigured()) {
    return catalog ? catalog.filter((o) => o.retailer === provider.id) : [searchLinkOffer(provider.id, query)];
  }
  try {
    return await withTimeout(provider.search(query, filters), TIMEOUT_MS);
  } catch (error) {
    console.warn(`[retail] ${provider.id} search failed for "${query}"`, error);
    return [];
  }
}

function score(offer: Offer, preferred: RetailerId[]) {
  const preference = preferred.includes(offer.retailer) ? 2 : 0;
  const rating = offer.rating ?? 4;
  const stock = offer.inStock ? 0 : -5;
  return preference + rating + stock;
}

/** Search every retailer, then interleave so each store's best match surfaces. */
export async function findOffers(query: string, preferred: RetailerId[], filters: SearchFilters = {}) {
  const catalog = catalogSearch(query, filters.maxPrice);
  const results = await Promise.all(PROVIDERS.map((p) => searchProvider(p, query, filters, catalog)));
  const seen = new Set<string>();
  const perRetailer = results.map((offers) =>
    offers
      .filter((o) => {
        const key = `${o.retailer}:${normalize(o.title)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => score(b, preferred) - score(a, preferred)),
  );

  const firsts = perRetailer.flatMap((offers) => offers.slice(0, 1));
  const rest = perRetailer.flatMap((offers) => offers.slice(1));
  firsts.sort((a, b) => score(b, preferred) - score(a, preferred));
  rest.sort((a, b) => score(b, preferred) - score(a, preferred));
  return [...firsts, ...rest].slice(0, MAX_OFFERS);
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await fn(items[index]);
      }
    }),
  );
  return out;
}

export function liveRetailers() {
  return PROVIDERS.filter((p) => p.isConfigured()).map((p) => p.id);
}
