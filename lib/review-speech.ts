/** How the voice review talks about items. Shared by the server (greeting) and the review page (function results). */
import { PICK_REASON, RETAILER_LABELS, type RegistryItem } from "./types";

type ItemOffer = RegistryItem["offers"][number];

/** Store titles run long ("Brand Name Thing, Color, 2-Pack - Model"), so only the part before the first separator is spoken. */
export function shortTitle(title: string) {
  const head = title.split(/\s[-–—|]\s|,|\(/)[0].trim();
  const words = head.split(/\s+/);
  return words.length > 8 ? words.slice(0, 8).join(" ") : head;
}

function spokenOffer(offer: ItemOffer) {
  const store = RETAILER_LABELS[offer.retailer];
  if (offer.externalId.startsWith("search:")) return `a link that searches ${store} for it`;
  return offer.price === null ? `${shortTitle(offer.title)} at ${store}` : `${shortTitle(offer.title)}, about ${Math.round(offer.price)} dollars at ${store}`;
}

function spokenName(item: RegistryItem) {
  return item.qty > 1 ? `${item.name}, ${item.qty} of them` : item.name;
}

/** One line for the agent to say, like "Bassinet: Dream On Me Karley Portable Bassinet, about 65 dollars at Amazon". */
export function spokenItem(item: RegistryItem) {
  const [primary] = item.offers;
  return `${spokenName(item)}: ${primary ? spokenOffer(primary) : "no product picked yet"}`;
}

/** The item on screen, for a function result. Options are numbered the way the screen lists them. */
export function itemForVoice(item: RegistryItem) {
  return {
    say: spokenItem(item),
    theirPick: item.reason === PICK_REASON,
    otherOptions: item.offers.slice(1).map((offer, i) => ({ option: i + 1, product: spokenOffer(offer) })),
  };
}
