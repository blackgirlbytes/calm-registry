import "server-only";
import { findOffers, mapLimit } from "./retail/aggregator";
import type { GeneratedItem, ParentProfile } from "./types";
import type { NewItem } from "./registry-store";

const LEAN_MAX_PRICE = 150;

export function withOffers(items: GeneratedItem[], profile: ParentProfile): Promise<NewItem[]> {
  const maxPrice = profile.budget === "lean" ? LEAN_MAX_PRICE : undefined;
  return mapLimit(items, 6, async (item) => ({
    ...item,
    offers: await findOffers(item.searchQuery, profile.preferredRetailers, { maxPrice }),
  }));
}
