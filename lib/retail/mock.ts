import type { Offer, RetailerId } from "../types";

const SEARCH_URLS: Record<RetailerId, (q: string) => string> = {
  amazon: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  walmart: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,
  target: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,
};

const BRANDS = ["Little Lark", "Cozy Sprout", "Bramble & Bee", "Nestwell", "Puddle Duck"];

// Checked in order, so accessory words ("sheets", "mirror") win over the big item they mention.
const PRICE_HINTS: Array<[RegExp, number]> = [
  [/sheet|diaper|wipe|onesie|bodysuit|sock|burp|bib|pacifier|clipper|cream|wash|brush|towel|mirror|book/i, 18],
  [/swaddle|sleep sack|bottle|bath|diaper bag|thermometer|aspirator|sleeper/i, 35],
  [/mattress|bassinet|monitor|high chair|pump|carrier|play ?yard|humidifier|bouncer/i, 110],
  [/stroller|car seat|crib|glider|travel system/i, 220],
];

function hash(value: string) {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

export function mockSearch(retailer: RetailerId, query: string, maxPrice?: number): Offer[] {
  const base = PRICE_HINTS.find(([pattern]) => pattern.test(query))?.[1] ?? 28;
  return [0, 1].map((variant) => {
    const seed = hash(`${retailer}:${query}:${variant}`);
    const brand = BRANDS[seed % BRANDS.length];
    let price = Math.round(base * (0.7 + (seed % 60) / 100)) - 0.01;
    if (maxPrice && price > maxPrice) price = Math.max(4.99, Math.floor(maxPrice) - 0.01);
    return {
      retailer,
      externalId: `mock-${seed.toString(36)}`,
      title: `${brand} ${query.replace(/\b\w/g, (c) => c.toUpperCase())}`,
      price,
      imageUrl: null,
      url: SEARCH_URLS[retailer](query),
      rating: 4 + (seed % 10) / 10,
      inStock: true,
    };
  });
}
