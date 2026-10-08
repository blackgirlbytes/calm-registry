import type { Offer } from "@/lib/types";

const STAGES = ["bg-stage-lavender", "bg-stage-blush", "bg-stage-butter"];

/** The same item always gets the same tint, so a list reads as a calm mix rather than a pattern. */
function stageFor(label: string) {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return STAGES[Math.abs(hash) % STAGES.length];
}

/** A product photo set on a soft tinted stage. Without a photo, a quiet outlined stage names the item instead. */
export function ProductPhoto({ offer, label, className = "" }: { offer?: Offer; label: string; className?: string }) {
  if (!offer?.imageUrl) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-[18px] border border-dashed border-line ${className}`}>
        <span className="px-2 text-center font-serif text-[13px] leading-snug text-muted">{label}</span>
      </div>
    );
  }
  return (
    <div className={`stage flex shrink-0 items-center justify-center ${stageFor(label)} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={offer.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-[10%]" />
    </div>
  );
}
