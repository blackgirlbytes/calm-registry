"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ItemCard } from "@/components/ItemCard";
import { ProductPhoto } from "@/components/ProductPhoto";
import { StartOverLink } from "@/components/RegistryActions";
import { Status } from "@/components/Status";
import { useRegistry } from "@/components/useRegistry";
import { useVoiceAgent, useVoiceEnabled } from "@/components/voice/useVoiceAgent";
import { TalkButton, VoiceInvite, VoiceRoom } from "@/components/voice/VoiceControls";
import { itemForVoice } from "@/lib/review-speech";
import { CATEGORIES, PICK_REASON, type Category, type Registry, type RegistryItem } from "@/lib/types";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <Review id={id} />
    </AuthGate>
  );
}

type Group = { category: Category; items: unknown[]; pending: Array<{ id: string }> };

const firstPending = (registry: Registry, category: Category, except?: string) =>
  registry.items.find((i) => i.category === category && i.status === "pending" && i.id !== except) ?? null;

/** The next section with something left, going forward from `after` and wrapping around. */
function nextCategory(registry: Registry, after: Category | null, except?: string) {
  const start = after ? CATEGORIES.indexOf(after) + 1 : 0;
  const order = [...CATEGORIES.slice(start), ...CATEGORIES.slice(0, start)];
  return order.find((c) => firstPending(registry, c, except)) ?? null;
}

function Review({ id }: { id: string }) {
  const { registry, error, setStatus, setPrimary, pickItem } = useRegistry(id);
  const [category, setCategory] = useState<Category | null>(null);
  const [heard, setHeard] = useState<{ role: "user" | "assistant"; content: string } | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [finding, setFinding] = useState(false);

  // Voice functions run between renders, so they read the latest registry and section from here.
  const live = useRef({ registry, category });
  useEffect(() => {
    live.current = { registry, category };
  });
  const endAfterReply = useRef(false);

  const groups = useMemo(() => {
    if (!registry) return [];
    return CATEGORIES.map((c) => {
      const items = registry.items.filter((i) => i.category === c);
      return { category: c, items, pending: items.filter((i) => i.status === "pending") };
    }).filter((g) => g.items.length > 0);
  }, [registry]);

  const voiceEnabled = useVoiceEnabled();
  const voice = useVoiceAgent({
    onText(role, content) {
      setHeard({ role, content });
      if (role === "assistant" && endAfterReply.current) {
        endAfterReply.current = false;
        voice.stopAfterSpeaking();
      }
    },
    onError: setVoiceError,
    async onFunction(name, args) {
      const { registry: r, category: c } = live.current;
      if (!r) return "The registry isn't loaded yet.";
      const item = c ? firstPending(r, c) : null;
      const sections = () => groups.filter((g) => g.pending.length).map((g) => g.category);

      if (name === "open_category") {
        const wanted = CATEGORIES.find((x) => x.toLowerCase() === String(args.category ?? "").toLowerCase());
        const first = wanted ? firstPending(r, wanted) : null;
        if (!wanted || !first) return JSON.stringify({ result: "That section has nothing left to review.", sectionsLeft: sections() });
        setCategory(wanted);
        return JSON.stringify({ result: `Opened ${wanted}.`, onScreen: itemForVoice(first), next: "Describe the item and ask keep or skip." });
      }
      if (!item) {
        return JSON.stringify({ result: "No item is showing right now.", sectionsLeft: sections(), next: "Ask which section to go through, then call open_category." });
      }
      if (name === "describe_item") return JSON.stringify({ onScreen: itemForVoice(item) });

      if (name === "keep_item" || name === "skip_item") {
        void setStatus(item.id, name === "keep_item" ? "keep" : "skip");
        const did = `${name === "keep_item" ? "Kept" : "Skipped"} ${item.name.toLowerCase()}.`;
        const same = firstPending(r, item.category, item.id);
        if (same) return JSON.stringify({ result: did, onScreen: itemForVoice(same), next: "Describe the item and ask keep or skip." });
        const moveTo = nextCategory(r, item.category, item.id);
        if (!moveTo) {
          endAfterReply.current = true;
          return JSON.stringify({ result: `${did} Everything is reviewed.`, next: "Tell them they're all done and can share it from the registry page. Say a short goodbye." });
        }
        setCategory(moveTo);
        return JSON.stringify({
          result: `${did} That finishes ${item.category}.`,
          nowIn: moveTo,
          onScreen: itemForVoice(firstPending(r, moveTo, item.id)!),
          next: `Say ${item.category} is done and you're on to ${moveTo}, then describe the item and ask keep or skip.`,
        });
      }
      if (name === "choose_option") {
        const offer = item.offers[Number(args.option)];
        if (!offer || Number(args.option) < 1) return JSON.stringify({ result: "There's no option with that number.", onScreen: itemForVoice(item) });
        void setPrimary(item.id, offer.id);
        const offers = [offer, ...item.offers.filter((o) => o.id !== offer.id)];
        return JSON.stringify({ result: "Switched.", onScreen: itemForVoice({ ...item, offers }), next: "Say what it is now and ask keep or skip." });
      }
      if (name === "use_their_pick") {
        const product = String(args.product ?? "").trim();
        if (!product) return "No product was given. Ask what they have in mind.";
        setFinding(true);
        try {
          const updated = await pickItem(item.id, product);
          if (!updated) return "That item is gone. Call describe_item.";
          return JSON.stringify({ result: "Swapped in their pick.", onScreen: itemForVoice(updated), next: "Tell them what you found and ask keep or skip." });
        } finally {
          setFinding(false);
        }
      }
      return `Unknown function ${name}.`;
    },
  });

  function talk(intent: "review" | "pick") {
    if (!registry) return;
    const section = category && firstPending(registry, category) ? category : nextCategory(registry, category);
    if (!section) return;
    setCategory(section);
    setVoiceError("");
    setHeard(null);
    endAfterReply.current = false;
    void voice.start({ mode: "review", registryId: registry.id, itemId: firstPending(registry, section)?.id, intent });
  }

  if (error && !registry) return <Status tone="error">{error}</Status>;
  if (!registry) return <Status>Opening your registry…</Status>;

  const total = registry.items.length;
  const reviewed = registry.items.filter((i) => i.status !== "pending").length;
  const progress = total ? reviewed / total : 0;
  const active = category ? groups.find((g) => g.category === category) : null;
  const current = active?.pending[0];

  const header = (
    <header className="sticky top-0 z-10 -mx-4 space-y-3 bg-bg px-4 pt-5 pb-4 sm:-mx-6 sm:px-6">
      <div className="flex items-center justify-between text-[13px]">
        {active ? (
          <button onClick={() => setCategory(null)} className="link">
            All categories
          </button>
        ) : (
          <Link href={`/registry/${id}`} className="link">
            Registry overview
          </Link>
        )}
        <span className="text-muted tabular-nums">
          {reviewed} of {total} reviewed
        </span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={reviewed}
        aria-valuemax={total}
        aria-label="Review progress"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
      </div>
    </header>
  );

  if (active) {
    return (
      <main className="space-y-5">
        {header}
        {current && (
          <div className="flex items-baseline justify-between">
            <h1 className="font-serif text-[21px] font-semibold">{active.category}</h1>
            <span className="text-[13px] text-muted tabular-nums">
              {active.items.length - active.pending.length + 1} of {active.items.length}
            </span>
          </div>
        )}

        {current ? (
          // Not keyed by item, so the voice panel stays put while items change under it.
          <ItemCard item={current} onChooseOffer={(offerId) => void setPrimary(current.id, offerId)}>
            <div className="sticky bottom-0 -mx-4 space-y-3 bg-bg px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 md:static md:mx-0 md:px-0 md:pt-4 md:pb-0">
              {finding ? (
                <p className="text-[14px] text-muted">Finding your pick…</p>
              ) : (
                current.reason === PICK_REASON && <PickNote item={current} />
              )}
              {voiceError && (
                <p role="alert" className="text-[13px] text-danger">
                  {voiceError}
                </p>
              )}
              {voice.active ? (
                <VoiceRoom
                  status={voice.status}
                  muted={voice.muted}
                  onMute={voice.setMuted}
                  onStop={voice.stop}
                  stopLabel="Tap instead"
                  level={voice.level}
                  heard={heard}
                  hint="Say keep or skip, or name the one you'd rather have."
                />
              ) : (
                <CardActions
                  key={current.id}
                  itemName={current.name}
                  voice={voiceEnabled}
                  onTalk={() => talk("review")}
                  onSayPick={() => talk("pick")}
                  onDecide={(status) => void setStatus(current.id, status)}
                  onPick={async (product) => {
                    setFinding(true);
                    try {
                      await pickItem(current.id, product);
                    } finally {
                      setFinding(false);
                    }
                  }}
                />
              )}
            </div>
          </ItemCard>
        ) : (
          <div className="space-y-8 pt-6 lg:pt-10">
            <div className="space-y-2">
              <h1 className="font-serif text-[26px] font-semibold lg:text-[41px]">{active.category} is reviewed.</h1>
              <p className="text-muted lg:text-[17px]">
                You kept {active.items.filter((i) => i.status === "keep").length} of {active.items.length} items.
              </p>
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-5">
              {active.items
                .filter((i) => i.status === "keep")
                .map((item) => (
                  <li key={item.id} className="space-y-2">
                    <ProductPhoto offer={item.offers[0]} label={item.name} className="aspect-square w-full" />
                    <p className="truncate text-[13px]">{item.name}</p>
                  </li>
                ))}
            </ul>
            <div className="space-y-3 sm:max-w-md">
              {voiceEnabled && progress < 1 && (
                <VoiceInvite title="Keep going by voice" detail="I'll pick up with the next section." onStart={() => talk("review")} />
              )}
              {voiceError && (
                <p role="alert" className="text-[13px] text-danger">
                  {voiceError}
                </p>
              )}
              <NextStep groups={groups} onPick={setCategory} id={id} quiet={voiceEnabled} />
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="space-y-8">
      {header}
      <div className="space-y-3">
        <h1 className="font-serif text-[33px] leading-tight font-semibold lg:text-[48px]">{registry.title}</h1>
        <p className="max-w-[60ch] text-muted lg:text-[17px]">
          Your full draft is ready. Go through it one category at a time, in any order. Stop whenever you like, your
          progress is saved.
        </p>
      </div>

      {voiceEnabled && progress < 1 && (
        <div className="sm:max-w-xl">
          <VoiceInvite
            title="Talk it through"
            detail="I'll read each item. Say keep or skip, or name the one you'd rather have."
            onStart={() => talk("review")}
          />
        </div>
      )}
      {voiceError && (
        <p role="alert" className="text-[13px] text-danger">
          {voiceError}
        </p>
      )}

      <ul className="border-t border-line">
        {groups.map((g) => {
          const done = g.pending.length === 0;
          const minutes = Math.max(1, Math.round(g.pending.length / 3));
          return (
            <li key={g.category} className="border-b border-line">
              <button
                onClick={() => setCategory(g.category)}
                className="group flex w-full items-center justify-between gap-6 py-4 text-left lg:py-5"
              >
                <span className="font-serif text-[21px] transition-colors group-hover:text-accent lg:w-48 lg:shrink-0 lg:text-[26px]">
                  {g.category}
                </span>
                <span className="hidden flex-1 gap-3 lg:flex" aria-hidden>
                  {g.items.slice(0, 7).map((item) => (
                    <ProductPhoto
                      key={item.id}
                      offer={item.offers[0]}
                      label=""
                      className={`h-16 w-16 rounded-[10px] ${item.status === "skip" ? "opacity-30" : ""}`}
                    />
                  ))}
                </span>
                <span className="shrink-0 text-[13px] text-muted tabular-nums lg:text-[14px]">
                  {done ? "Reviewed" : `${g.pending.length} to review, about ${minutes} min`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {progress === 1 && (
        <Link href={`/registry/${id}`} className="btn-primary w-full sm:w-auto sm:px-8">
          See and share your registry
        </Link>
      )}

      <div className="sm:max-w-md">
        <StartOverLink registry={registry} label="Not what you wanted? Start over with new answers" />
      </div>
    </main>
  );
}

function PickNote({ item }: { item: RegistryItem }) {
  const searchOnly = item.offers[0]?.externalId.startsWith("search:");
  return (
    <p className="text-[14px] text-note">
      {searchOnly
        ? "Family will get a store search for your pick, so they can find that exact one. Keep it?"
        : "Here's your pick. Keep it?"}
    </p>
  );
}

/**
 * Keep, skip, or swap in the one they already have in mind. Talking comes first when voice is available;
 * tapping and typing stay one step away.
 */
function CardActions({
  itemName,
  voice,
  onTalk,
  onSayPick,
  onDecide,
  onPick,
}: {
  itemName: string;
  voice: boolean;
  onTalk: () => void;
  onSayPick: () => void;
  onDecide: (status: "keep" | "skip") => void;
  onPick: (product: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open && voice) {
    return (
      <div className="space-y-3">
        <VoiceInvite title="Keep, skip, or name your own" detail="Just say it. I'll read each one as we go." onStart={onTalk} />
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-quiet px-2 py-2.5 text-[14px] whitespace-nowrap" onClick={() => onDecide("skip")}>
            Skip
          </button>
          <button className="btn-quiet px-2 py-2.5 text-[14px] whitespace-nowrap" onClick={() => onDecide("keep")}>
            Keep
          </button>
          <button className="btn-quiet px-2 py-2.5 text-[14px] whitespace-nowrap" onClick={() => setOpen(true)}>
            Type my own
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-quiet" onClick={() => onDecide("skip")}>
            Skip
          </button>
          <button className="btn-primary" onClick={() => onDecide("keep")}>
            Keep
          </button>
        </div>
        <button className="link text-[14px]" onClick={() => setOpen(true)}>
          I have one in mind
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onPick(text.trim());
      setOpen(false);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="pick-input" className="block text-[14px] text-muted">
        What would you like instead of the {itemName.toLowerCase()}?
      </label>
      <div className="flex gap-2">
        <input
          id="pick-input"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Product name"
          className="field min-w-0 flex-1"
        />
        {voice && <TalkButton label="Say it out loud" onClick={onSayPick} disabled={busy} />}
        <button className="btn-primary shrink-0 px-5" disabled={busy || !text.trim()}>
          {busy ? "Finding…" : "Find"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <button type="button" className="link text-[13px]" onClick={() => setOpen(false)} disabled={busy}>
        Never mind
      </button>
    </form>
  );
}

function NextStep({ groups, onPick, id, quiet }: { groups: Group[]; onPick: (c: Category | null) => void; id: string; quiet?: boolean }) {
  const next = groups.find((g) => g.pending.length > 0);
  if (!next) {
    return (
      <Link href={`/registry/${id}`} className="btn-primary w-full">
        See and share your registry
      </Link>
    );
  }
  return (
    <button className={`${quiet ? "btn-quiet" : "btn-primary"} w-full`} onClick={() => onPick(next.category)}>
      {quiet ? `Or tap through ${next.category}` : `Review ${next.category}`}
    </button>
  );
}
