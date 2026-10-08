import { RETAILER_LABELS, type Offer } from "@/lib/types";

/** Link a retailer-provided rating to the product page, where shoppers can read the reviews. */
export function ProductRating({ offer, className = "" }: { offer?: Offer; className?: string }) {
  // Older saved catalog offers contain a price-tier estimate, not a customer rating.
  const rating = offer?.externalId.startsWith("catalog:") ? null : offer?.rating;
  if (!offer || offer.externalId.startsWith("search:")) return null;
  const hasRating = rating != null && Number.isFinite(rating) && rating > 0 && rating <= 5;

  const label = hasRating
    ? `${rating.toFixed(1)} out of 5 stars at ${RETAILER_LABELS[offer.retailer]}. Open product page to read reviews`
    : `Open ${RETAILER_LABELS[offer.retailer]} product page to read reviews`;
  return (
    <a
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={label}
      className={`inline-flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-text ${className}`}
    >
      {hasRating && (
        <span aria-hidden="true" className="relative inline-block whitespace-nowrap tracking-[1px] text-line">
          ★★★★★
          <span
            className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-[#d79a40]"
            style={{ width: `${rating * 20}%` }}
          >
            ★★★★★
          </span>
        </span>
      )}
      {hasRating && <span className="tabular-nums">{rating.toFixed(1)}</span>}
      <span className="underline decoration-line underline-offset-2">
        Read reviews{!hasRating && ` at ${RETAILER_LABELS[offer.retailer]}`}
      </span>
    </a>
  );
}
