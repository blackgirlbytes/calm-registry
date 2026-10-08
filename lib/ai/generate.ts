import "server-only";
import { z } from "zod";
import { GeneratedItemSchema, type GeneratedItem, type ParentProfile } from "../types";
import { CATALOG_QUERY_RULE } from "../retail/catalog";
import { callJson, isOpenAIConfigured } from "./openai";

const GeneratedRegistrySchema = z.object({
  title: z.string().describe("A short, warm registry title, e.g. 'Baby Rivera's Registry'"),
  items: z.array(GeneratedItemSchema),
});

const SYSTEM_PROMPT = `You build baby registries for tired, overwhelmed expecting parents.
Given a parent profile, return 25-35 items. Rules:
- name: what a parent would call it, short and in sentence case, e.g. "Swaddles", "White noise machine", "Car seat". Never copy searchQuery into name.
- category must be one of: Sleep, Feeding, Diapering, Bath, On-the-go, Clothing, Health, Play.
- priority: "must-have" (needed in the first weeks), "nice-to-have", or "later" (3-12 months).
- reason: ONE short, reassuring sentence explaining why this item helps THEM specifically.
- qty: 1-20, counted in packs or sets (e.g. 4 packs of diapers, 8 bodysuits).
${CATALOG_QUERY_RULE}
- Respect their space (apartment = compact), car use, feeding plan, budget and values.
- Leave out anything they already have. Avoid gimmicks; favor safety-first, proven essentials.
- Never include unsafe sleep items (bumpers, positioners, weighted sleep sacks, inclined sleepers).`;

export async function generateRegistry(profile: ParentProfile): Promise<{ title: string; items: GeneratedItem[] }> {
  if (!isOpenAIConfigured()) return { title: "Our Baby Registry", items: mockItems(profile) };
  return callJson("registry", GeneratedRegistrySchema, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(profile) },
  ]);
}

type Template = GeneratedItem & { when?: (p: ParentProfile) => boolean; skipIfHave?: string };

const TEMPLATES: Template[] = [
  { name: "Bassinet", category: "Sleep", priority: "must-have", qty: 1, searchQuery: "bassinet", reason: "Keeps baby close and safe in your room for the first months.", skipIfHave: "bassinet" },
  { name: "Crib", category: "Sleep", priority: "later", qty: 1, searchQuery: "convertible crib", reason: "A long-term safe sleep spot once baby outgrows the bassinet.", skipIfHave: "crib", when: (p) => p.home !== "apartment" },
  { name: "Mini crib", category: "Sleep", priority: "later", qty: 1, searchQuery: "mini crib", reason: "A full safe sleep space that fits smaller rooms.", skipIfHave: "crib", when: (p) => p.home === "apartment" },
  { name: "Crib mattress", category: "Sleep", priority: "later", qty: 1, searchQuery: "firm crib mattress", reason: "A firm, flat mattress is the foundation of safe sleep.", skipIfHave: "crib" },
  { name: "Fitted sheets", category: "Sleep", priority: "must-have", qty: 3, searchQuery: "fitted bassinet sheets", reason: "Spares mean no 3am laundry after a leak." },
  { name: "Swaddles", category: "Sleep", priority: "must-have", qty: 3, searchQuery: "zip swaddle newborn", reason: "Helps newborns feel snug and settle faster." },
  { name: "Sleep sacks", category: "Sleep", priority: "nice-to-have", qty: 2, searchQuery: "wearable blanket sleep sack", reason: "A safe blanket alternative once swaddling ends." },
  { name: "White noise machine", category: "Sleep", priority: "nice-to-have", qty: 1, searchQuery: "white noise machine baby", reason: "Masks household sounds so naps last longer." },
  { name: "Baby monitor", category: "Sleep", priority: "nice-to-have", qty: 1, searchQuery: "video baby monitor", reason: "Peace of mind while baby naps in another room.", when: (p) => p.home !== "apartment" },
  { name: "Bottles", category: "Feeding", priority: "must-have", qty: 6, searchQuery: "anti colic baby bottles", reason: "Useful for formula, pumped milk, or giving a partner a turn." },
  { name: "Breast pump", category: "Feeding", priority: "must-have", qty: 1, searchQuery: "electric breast pump", reason: "Often covered by insurance and gives you flexibility.", when: (p) => p.feeding === "breast" || p.feeding === "both" },
  { name: "Nursing pillow", category: "Feeding", priority: "nice-to-have", qty: 1, searchQuery: "nursing pillow", reason: "Saves your back and arms during long feeds.", when: (p) => p.feeding !== "formula" },
  { name: "Formula dispenser", category: "Feeding", priority: "nice-to-have", qty: 1, searchQuery: "formula dispenser on the go", reason: "Pre-measured formula makes night feeds faster.", when: (p) => p.feeding === "formula" || p.feeding === "both" },
  { name: "Bottle brush & drying rack", category: "Feeding", priority: "must-have", qty: 1, searchQuery: "bottle drying rack and brush", reason: "Keeps bottle cleanup simple and tidy." },
  { name: "Burp cloths", category: "Feeding", priority: "must-have", qty: 6, searchQuery: "muslin burp cloths", reason: "You'll use these constantly. Trust us." },
  { name: "High chair", category: "Feeding", priority: "later", qty: 1, searchQuery: "compact high chair", reason: "Ready for solids around six months.", skipIfHave: "high chair" },
  { name: "Diapers (newborn & size 1)", category: "Diapering", priority: "must-have", qty: 4, searchQuery: "newborn diapers", reason: "Babies go through 8-12 a day early on." },
  { name: "Wipes", category: "Diapering", priority: "must-have", qty: 4, searchQuery: "sensitive baby wipes", reason: "Gentle, fragrance-free wipes for tender skin." },
  { name: "Changing pad", category: "Diapering", priority: "must-have", qty: 1, searchQuery: "contoured changing pad", reason: "A safe, wipeable spot for changes." },
  { name: "Diaper cream", category: "Diapering", priority: "must-have", qty: 2, searchQuery: "diaper rash cream", reason: "Stops rash before it starts." },
  { name: "Diaper pail", category: "Diapering", priority: "nice-to-have", qty: 1, searchQuery: "odor locking diaper pail", reason: "Keeps smells contained, especially in a small space." },
  { name: "Baby bathtub", category: "Bath", priority: "must-have", qty: 1, searchQuery: "infant bathtub", reason: "Supports baby so bath time feels less nerve-wracking." },
  { name: "Hooded towels", category: "Bath", priority: "must-have", qty: 2, searchQuery: "hooded baby towel", reason: "Keeps baby warm right out of the bath." },
  { name: "Gentle baby wash", category: "Bath", priority: "must-have", qty: 1, searchQuery: "tear free baby wash", reason: "Mild, tear-free wash for sensitive skin." },
  { name: "Infant car seat", category: "On-the-go", priority: "must-have", qty: 1, searchQuery: "infant car seat", reason: "Required to bring baby home from the hospital.", skipIfHave: "car seat" },
  { name: "Stroller", category: "On-the-go", priority: "must-have", qty: 1, searchQuery: "lightweight compact stroller", reason: "Gets you both out of the house for fresh air.", skipIfHave: "stroller" },
  { name: "Baby carrier", category: "On-the-go", priority: "must-have", qty: 1, searchQuery: "ergonomic baby carrier", reason: "Hands-free comfort for baby, and freedom for you.", when: (p) => p.hasCar === false },
  { name: "Baby carrier", category: "On-the-go", priority: "nice-to-have", qty: 1, searchQuery: "ergonomic baby carrier", reason: "Hands-free snuggles while you get things done.", when: (p) => p.hasCar !== false },
  { name: "Diaper bag", category: "On-the-go", priority: "must-have", qty: 1, searchQuery: "backpack diaper bag", reason: "Everything you need in one grab-and-go spot." },
  { name: "Car mirror", category: "On-the-go", priority: "nice-to-have", qty: 1, searchQuery: "baby car mirror", reason: "See baby in the rear-facing seat while you drive.", when: (p) => p.hasCar !== false },
  { name: "Bodysuits (0-3 mo)", category: "Clothing", priority: "must-have", qty: 8, searchQuery: "newborn bodysuits", reason: "The everyday basic. Easy snaps make changes quick." },
  { name: "Zip sleepers", category: "Clothing", priority: "must-have", qty: 6, searchQuery: "zip footed sleeper newborn", reason: "Zippers beat snaps at 3am." },
  { name: "Socks & mittens", category: "Clothing", priority: "nice-to-have", qty: 1, searchQuery: "newborn socks and mittens", reason: "Keeps tiny hands and feet warm." },
  { name: "Thermometer", category: "Health", priority: "must-have", qty: 1, searchQuery: "baby thermometer", reason: "A quick, reliable read when baby feels warm." },
  { name: "Nail clippers", category: "Health", priority: "must-have", qty: 1, searchQuery: "baby nail clippers", reason: "Tiny nails grow fast and scratch." },
  { name: "Nasal aspirator", category: "Health", priority: "must-have", qty: 1, searchQuery: "baby nasal aspirator", reason: "Helps a congested baby breathe and feed." },
  { name: "Humidifier", category: "Health", priority: "nice-to-have", qty: 1, searchQuery: "cool mist humidifier", reason: "Eases stuffy noses during cold season." },
  { name: "Play mat", category: "Play", priority: "nice-to-have", qty: 1, searchQuery: "baby play gym mat", reason: "A safe spot for tummy time and kicking." },
  { name: "Bouncer", category: "Play", priority: "nice-to-have", qty: 1, searchQuery: "baby bouncer", reason: "A safe place to set baby down for a few minutes.", skipIfHave: "bouncer" },
  { name: "Board books", category: "Play", priority: "later", qty: 1, searchQuery: "baby board books set", reason: "Reading together builds bonding and language." },
];

function adjustQuery(query: string, profile: ParentProfile) {
  const prefix = [profile.values.includes("eco") ? "organic" : "", profile.budget === "lean" ? "affordable" : ""]
    .filter(Boolean)
    .join(" ");
  return prefix ? `${prefix} ${query}` : query;
}

export function mockItems(profile: ParentProfile): GeneratedItem[] {
  return TEMPLATES.filter((t) => (t.when ? t.when(profile) : true))
    .filter((t) => !t.skipIfHave || !profile.alreadyHave.includes(t.skipIfHave))
    .filter((t) => !(profile.values.includes("minimal") && t.priority === "nice-to-have" && t.category === "Play"))
    .map(({ when: _when, skipIfHave: _skip, ...item }) => ({ ...item, searchQuery: adjustQuery(item.searchQuery, profile) }));
}
