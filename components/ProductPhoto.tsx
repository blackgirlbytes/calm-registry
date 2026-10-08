import type { Offer } from "@/lib/types";

const STAGES = ["bg-stage-lavender", "bg-stage-blush", "bg-stage-butter"];

/** The same item always gets the same tint, so a list reads as a calm mix rather than a pattern. */
function stageFor(label: string) {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return STAGES[Math.abs(hash) % STAGES.length];
}

/**
 * A product photo set on a soft tinted stage. Without a photo, a quiet outlined stage names the item instead.
 * `trueColor` shows the photo on white, untinted, for when someone is judging the product's actual color.
 */
export function ProductPhoto({
  offer,
  label,
  className = "",
  trueColor = false,
}: {
  offer?: Offer;
  label: string;
  className?: string;
  trueColor?: boolean;
}) {
  if (!offer?.imageUrl) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-[18px] border border-dashed border-line ${className}`}>
        <span className="line-clamp-3 px-2 text-center font-serif text-[12px] leading-snug hyphens-auto text-muted">{label}</span>
      </div>
    );
  }
  if (trueColor) {
    return (
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-line bg-white ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={offer.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-[8%]" />
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
