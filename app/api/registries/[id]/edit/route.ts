import { proposeEdit } from "@/lib/ai/edit";
import { getOwnerId, unauthorized } from "@/lib/auth";
import { withOffers } from "@/lib/offers";
import { findOffers, mapLimit } from "@/lib/retail/aggregator";
import { registryStore, RegistryError } from "@/lib/registry-store";
import { EditDiffSchema } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

/** { request } -> preview diff.  { diff } -> apply a previously previewed diff. */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ownerId = await getOwnerId(request);
  if (!ownerId) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as { request?: string; diff?: unknown };
  const store = registryStore();

  try {
    const registry = await store.getById(id);
    if (!registry || registry.ownerId !== ownerId) return Response.json({ error: "Registry not found." }, { status: 404 });

    if (typeof body.request === "string" && body.request.trim()) {
      const diff = await proposeEdit(registry, body.request.slice(0, 500));
      return Response.json({ diff });
    }

    const parsed = EditDiffSchema.safeParse(body.diff);
    if (!parsed.success) return Response.json({ error: "Send a request or a diff." }, { status: 400 });
    const diff = parsed.data;

    const [added, swaps] = await Promise.all([
      withOffers(diff.add, registry.profile),
      mapLimit(diff.swap, 6, async (swap) => ({
        itemId: swap.id,
        searchQuery: swap.searchQuery,
        reason: swap.reason,
        offers: await findOffers(swap.searchQuery, registry.preferredRetailers),
      })),
    ]);
    await store.applyEdits(id, ownerId, diff.remove, added, swaps);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Edit failed", error);
    return Response.json({ error: error instanceof RegistryError ? error.message : "That edit didn't go through. Try again?" }, { status: 502 });
  }
}
