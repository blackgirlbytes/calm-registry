import { generateRegistry } from "@/lib/ai/generate";
import { getOwnerId, unauthorized } from "@/lib/auth";
import { withOffers } from "@/lib/offers";
import { normalizeProfile } from "@/lib/profile";
import { registryStore, RegistryError } from "@/lib/registry-store";
import { ParentProfileSchema } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const ownerId = await getOwnerId(request);
  if (!ownerId) return unauthorized();
  try {
    return Response.json({ registries: await registryStore().listForOwner(ownerId) });
  } catch (error) {
    return Response.json({ error: error instanceof RegistryError ? error.message : "Could not load registries." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const ownerId = await getOwnerId(request);
  if (!ownerId) return unauthorized();

  const parsed = ParentProfileSchema.safeParse(((await request.json().catch(() => ({}))) as { profile?: unknown }).profile);
  if (!parsed.success) return Response.json({ error: "A valid profile is required." }, { status: 400 });

  try {
    const profile = normalizeProfile(parsed.data);
    const { title, items } = await generateRegistry(profile);
    const id = await registryStore().create({ ownerId, title, profile, items: await withOffers(items, profile) });
    return Response.json({ id });
  } catch (error) {
    console.error("Registry creation failed", error);
    return Response.json(
      { error: error instanceof RegistryError ? error.message : "We couldn't build your registry. Please try again." },
      { status: 502 },
    );
  }
}
