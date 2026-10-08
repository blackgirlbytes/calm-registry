import Link from "next/link";
import { ProductPhoto } from "@/components/ProductPhoto";
import { ResumeList } from "@/components/ResumeList";
import { formatPrice } from "@/lib/format";
import { catalogExample } from "@/lib/retail/catalog";
import { RETAILER_LABELS } from "@/lib/types";

const EXAMPLES = [
  { kind: "zip swaddle newborn", name: "Zip swaddle", reason: "Zips beat velcro and folding at 3am." },
  { kind: "bassinet", name: "Bassinet", reason: "Keeps baby within arm's reach for the first months." },
  { kind: "baby nasal aspirator", name: "Nasal aspirator", reason: "A stuffy newborn can't feed well. This clears it fast." },
];

export default function Home() {
  const examples = EXAMPLES.flatMap((example) => {
    const offer = catalogExample(example.kind);
    return offer ? [{ ...example, offer }] : [];
  });

  return (
    <main className="pt-6 lg:pt-10">
      <p className="font-serif text-[17px] font-semibold">Calm Registry</p>

      <div className="mt-8">
        <ResumeList />
      </div>

      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-16 lg:mt-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-20">
        <section className="space-y-6">
          <h1 className="max-w-[16ch] font-serif text-[41px] leading-[1.1] font-semibold sm:text-[52px] lg:text-[56px] lg:leading-[1.05] xl:text-[64px] 2xl:text-[76px]">
            A baby registry you can finish tonight
          </h1>
          <p className="max-w-[46ch] text-[17px] text-muted lg:text-[19px]">
            Talk or type through a few questions. You get a complete registry of real products from Amazon, Target, and Walmart, with
            a note on why each one is there. Then review it one category at a time.
          </p>
          <Link href="/start" className="btn-primary w-full text-[17px] sm:w-auto sm:px-8">
            Start my registry
          </Link>
        </section>

        {examples.length > 0 && (
          <section aria-labelledby="examples" className="space-y-5 lg:rounded-2xl lg:bg-surface lg:p-8">
            <h2 id="examples" className="font-serif text-[21px] font-semibold">
              Every item comes with a reason
            </h2>
            <ul className="space-y-6 md:grid md:grid-cols-3 md:gap-6 md:space-y-0 lg:block lg:space-y-6">
              {examples.map(({ name, reason, offer }) => (
                <li key={name} className="flex gap-4 md:flex-col lg:flex-row">
                  <ProductPhoto offer={offer} label={name} className="h-24 w-24 md:aspect-square md:h-auto md:w-full lg:h-24 lg:w-24" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">{name}</p>
                    <p className="font-serif text-[15px] leading-snug text-note italic">{reason}</p>
                    <p className="truncate text-[13px] text-muted">{offer.title}</p>
                    <p className="text-[13px] text-muted tabular-nums">
                      {formatPrice(offer.price)} at {RETAILER_LABELS[offer.retailer]}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section aria-labelledby="how" className="mt-20 space-y-5 lg:mt-28">
        <h2 id="how" className="font-serif text-[21px] font-semibold">
          How it works
        </h2>
        <ol className="grid gap-4 lg:grid-cols-3 lg:gap-10">
          {[
            "Talk or type for a few minutes about your space, budget, and plans.",
            "Review your draft one category at a time. Keep or skip each item.",
            "Share one link. Family buys from whichever store they like and marks it as gifted.",
          ].map((step, i) => (
            <li key={step} className="flex gap-4 lg:border-t lg:border-line lg:pt-5">
              <span className="w-4 shrink-0 font-serif text-[17px] text-accent">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

    </main>
  );
}
