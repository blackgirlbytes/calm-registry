# Calm Registry

A mobile-first baby registry that builds itself from a short chat. Parents answer a few
tap-to-answer questions, get a full registry with products from Amazon, Walmart, and Target,
review it one category at a time, edit it in plain language, and share a link with family.

## Deepgram voice tutorials

- [Build it step by step with code](docs/deepgram-build-tutorial.md)
- [Build it with prompts for a coding agent](docs/deepgram-agent-prompts-tutorial.md)

## Run locally

```bash
npm install
npm run dev
```

Every key is optional locally. Without them the app uses a scripted chat, sample products,
and stores data in `.data/registries.json`. See `.env.example` for all settings.

## Production (Vercel)

Supabase is required in deployed environments because Vercel's filesystem is read-only.

1. Apply `supabase/migrations/*.sql` to your Supabase project.
2. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
3. Add the Vercel domains to Supabase Auth's redirect URLs so magic links work.
4. Optionally add `OPENAI_API_KEY` and retailer keys to replace the scripted chat and
   sample products.
5. Optionally add `DEEPGRAM_API_KEY` to turn on voice mode ("Talk instead" in the intake
   chat and the mic in the edit box). The key needs at least Member permission so the
   server can mint 30-second tokens. The browser connects straight to Deepgram's Voice
   Agent API with that token; the agent's AI runs on Deepgram's hosted `gpt-4o-mini`.
