"use client";

import { CATEGORY_ICONS, formatPrice, PRIORITY_LABELS } from "@/lib/client";
import { RETAILER_LABELS, type RegistryItem } from "@/lib/types";

const PRIORITY_STYLES = {
  "must-have": "bg-sage/15 text-sage-dark",
  "nice-to-have": "bg-blush text-ink",
  later: "bg-ink/5 text-muted",
} as const;

export function ItemCard({
  item,
  onChooseOffer,
  children,
}: {
  item: RegistryItem;
  onChooseOffer?: (offerId: string) => void;
  children?: React.ReactNode;
}) {
  const [primary, ...alternatives] = item.offers;
  return (
    <article className="card space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cream text-4xl">
          {primary?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primary.imageUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            CATEGORY_ICONS[item.category]
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[item.priority]}`}>
            {PRIORITY_LABELS[item.priority]}
          </span>
          <h3 className="text-lg font-semibold leading-snug">
            {item.name}
            {item.qty > 1 && <span className="font-normal text-muted"> × {item.qty}</span>}
          </h3>
          <p className="text-sm text-muted">{item.reason}</p>
        </div>
      </div>

      {primary && (
        <a
          href={primary.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3 text-sm"
        >
          <span className="min-w-0 truncate">{primary.title}</span>
          <span className="shrink-0 font-semibold">
            {formatPrice(primary.price)} · {RETAILER_LABELS[primary.retailer]}
          </span>
        </a>
      )}

      {onChooseOffer && alternatives.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alternatives.map((offer) => (
            <button key={offer.id} className="chip text-xs" onClick={() => onChooseOffer(offer.id)}>
              Also at {RETAILER_LABELS[offer.retailer]} {offer.price !== null && `for ${formatPrice(offer.price)}`}
            </button>
          ))}
        </div>
      )}

      {children}
    </article>
  );
}
