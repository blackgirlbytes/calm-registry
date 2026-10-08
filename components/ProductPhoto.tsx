import type { Offer } from "@/lib/types";

/** A product photo on a lit white tile. Without a photo, a quiet outlined tile names the item instead. */
export function ProductPhoto({ offer, label, className = "" }: { offer?: Offer; label: string; className?: string }) {
  if (!offer?.imageUrl) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-[14px] border border-dashed border-line ${className}`}>
        <span className="px-2 text-center font-serif text-[13px] leading-snug text-muted">{label}</span>
      </div>
    );
  }
  return (
    <div className={`tile flex shrink-0 items-center justify-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={offer.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-[8%]" />
    </div>
  );
}
