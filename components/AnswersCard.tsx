"use client";

import { useState, type ReactNode } from "react";
import { BUDGET_LABELS, describeAnswers, FEEDING_LABELS, HOME_LABELS } from "@/lib/answers";
import { RETAILER_LABELS, RETAILERS, type ParentProfile } from "@/lib/types";

type Field = keyof ReturnType<typeof describeAnswers>;

const LABELS: Record<Field, string> = {
  dueDate: "Due date",
  names: "Names",
  home: "Home",
  hasCar: "Driving",
  feeding: "Feeding",
  budget: "Budget",
  alreadyHave: "Already have",
  values: "What matters to you",
  preferredRetailers: "Stores",
  notes: "Anything else",
};

const HAVE_IDEAS = ["Crib", "Bassinet", "Stroller", "Car seat", "High chair", "Baby carrier", "Bouncer"];
const VALUE_IDEAS = ["Eco-friendly", "Minimal", "Gender-neutral", "Organic", "Secondhand welcome"];

/** Every answer in plain words; tap one to change it. Used before building and on the registry page. */
export function AnswersCard({
  profile,
  onChange,
  showNames = true,
  title,
  intro,
  children,
}: {
  profile: ParentProfile;
  onChange: (next: ParentProfile) => void;
  showNames?: boolean;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState<Field | null>(null);
  const plain = describeAnswers(profile);
  const set = (patch: Partial<ParentProfile>) => onChange({ ...profile, ...patch });
  const fields = (Object.keys(LABELS) as Field[]).filter((f) => showNames || f !== "names");

  function editor(field: Field) {
    switch (field) {
      case "dueDate":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Due date"
              value={profile.dueDate ?? ""}
              onChange={(e) => set({ dueDate: e.target.value || null })}
              className="field w-auto"
            />
            <Option selected={!profile.dueDate} onClick={() => set({ dueDate: null })}>
              Not sure yet
            </Option>
          </div>
        );
      case "names":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              aria-label="Your names"
              value={profile.parentNames}
              onChange={(e) => set({ parentNames: e.target.value })}
              placeholder="Your names, like Maya and Jordan"
              maxLength={80}
              className="field"
            />
            <input
              aria-label="Baby's name"
              value={profile.babyName}
              onChange={(e) => set({ babyName: e.target.value })}
              placeholder="Baby's name, if picked"
              maxLength={40}
              className="field"
            />
          </div>
        );
      case "home":
        return <Choices value={profile.home} labels={HOME_LABELS} onPick={(home) => set({ home })} />;
      case "hasCar":
        return (
          <Choices
            value={String(profile.hasCar)}
            labels={{ true: "Yes, we drive", false: "No car", null: "Not sure" }}
            onPick={(v) => set({ hasCar: v === "null" ? null : v === "true" })}
          />
        );
      case "feeding":
        return <Choices value={profile.feeding} labels={FEEDING_LABELS} onPick={(feeding) => set({ feeding })} />;
      case "budget":
        return <Choices value={profile.budget} labels={BUDGET_LABELS} onPick={(budget) => set({ budget })} />;
      case "alreadyHave":
        return <Tags values={profile.alreadyHave} ideas={HAVE_IDEAS} onChange={(alreadyHave) => set({ alreadyHave })} placeholder="Add something you have" />;
      case "values":
        return <Tags values={profile.values} ideas={VALUE_IDEAS} onChange={(values) => set({ values })} placeholder="Add what matters to you" />;
      case "preferredRetailers":
        return (
          <div className="flex flex-wrap gap-2">
            {RETAILERS.map((r) => {
              const on = profile.preferredRetailers.includes(r);
              return (
                <Option
                  key={r}
                  selected={on}
                  onClick={() =>
                    set({ preferredRetailers: on ? profile.preferredRetailers.filter((x) => x !== r) : [...profile.preferredRetailers, r] })
                  }
                >
                  {RETAILER_LABELS[r]}
                </Option>
              );
            })}
            <p className="basis-full text-[13px] text-muted">Pick none to include all three.</p>
          </div>
        );
      case "notes":
        return (
          <textarea
            aria-label="Anything else"
            value={profile.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={3}
            maxLength={500}
            placeholder="Twins, allergies, a small car, anything that helps"
            className="field resize-none"
          />
        );
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-surface p-5" aria-label={title}>
      <div className="space-y-1">
        <h2 className="font-serif text-[21px] font-semibold">{title}</h2>
        {intro && <p className="text-[14px] text-muted">{intro}</p>}
      </div>
      <ul className="border-t border-line">
        {fields.map((field) => (
          <li key={field} className="border-b border-line">
            <button
              type="button"
              className="group flex w-full items-baseline justify-between gap-4 py-3 text-left"
              aria-expanded={open === field}
              onClick={() => setOpen(open === field ? null : field)}
            >
              <span className="min-w-0">
                <span className="block text-[13px] text-muted">{LABELS[field]}</span>
                <span className="block">{plain[field]}</span>
              </span>
              <span className="shrink-0 text-[13px] text-muted group-hover:text-text">{open === field ? "Done" : "Change"}</span>
            </button>
            {open === field && <div className="pb-4">{editor(field)}</div>}
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`chip ${selected ? "border-accent text-accent" : ""}`}>
      {children}
    </button>
  );
}

function Choices<K extends string>({ value, labels, onPick }: { value: string; labels: Record<K, string>; onPick: (k: K) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(labels) as K[]).map((k) => (
        <Option key={k} selected={value === k} onClick={() => onPick(k)}>
          {labels[k]}
        </Option>
      ))}
    </div>
  );
}

function Tags({
  values,
  ideas,
  onChange,
  placeholder,
}: {
  values: string[];
  ideas: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());
  const toggle = (v: string) => onChange(has(v) ? values.filter((x) => x.toLowerCase() !== v.toLowerCase()) : [...values, v]);
  const extra = values.filter((v) => !ideas.some((i) => i.toLowerCase() === v.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[...ideas, ...extra].map((v) => (
          <Option key={v} selected={has(v)} onClick={() => toggle(v)}>
            {v}
          </Option>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = text.trim();
          if (v && !has(v)) onChange([...values, v.slice(0, 60)]);
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="field" />
        <button className="btn-quiet shrink-0 px-4" disabled={!text.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
