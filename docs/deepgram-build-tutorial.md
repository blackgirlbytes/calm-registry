# Build a voice-powered baby registry with Deepgram

This guide follows the working Calm Registry app in this repository. A parent talks about what they need for a baby. Deepgram hears them, helps ask the next question, and speaks back. The app shows their answers, builds a gift list after they tap **Build**, and asks before changing that list.

Three words to know: an **API key** is a private password for the app, a **token** is a short pass the browser can use, and a **WebSocket** is an open line that carries sound back and forth. You do not need to memorize the names to follow the steps.

## 1. Set up the project and keys

You need Node.js, npm, a Deepgram project, and a Deepgram API key. In the [Deepgram Console](https://console.deepgram.com/), create a key with **Member** permission or higher. This lets the app ask Deepgram for short browser passes. Copy the key when it is shown.

```bash
git clone https://github.com/blackgirlbytes/calm-registry.git
cd calm-registry
npm install
cp .env.example .env.local
```

Set this value in `.env.local`:

```dotenv
DEEPGRAM_API_KEY=your_deepgram_member_key
```

Keep the key on the server. Do not use `NEXT_PUBLIC_DEEPGRAM_API_KEY` or put the key in the page code. You do not need a separate OpenAI key for the live voice chat. Deepgram runs that model for you. `OPENAI_API_KEY` is optional for the typed chat and custom registry items. Without it, this repo uses built-in questions and sample items. Store keys are also optional on your computer.

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000/start`. The voice button appears when `DEEPGRAM_API_KEY` is set. On your computer, the app can save lists in `.data/registries.json`. For a public website, set up Supabase using the files in `supabase/migrations`, add the four Supabase values from [`.env.example`](../.env.example), and save the Deepgram key as a private server setting. Add your website address to Supabase Auth's redirect URLs.

## 2. Keep the main registry flow independent of voice

First make the app work by typing. It needs to save answers in a `ParentProfile`, show those answers to the parent, and build the list only after they tap **Build**. The code is in [`app/start/page.tsx`](../app/start/page.tsx), [`lib/types.ts`](../lib/types.ts), and [`app/api/registries/route.ts`](../app/api/registries/route.ts).

`ParentProfileSchema` is the list of answers the app expects, such as due date, city, feeding plan, and things the family already owns. Deepgram uses that same list when it calls `finish_intake`. The app uses `coerceProfile` to fill in skipped answers before showing the review card. A spoken phrase cannot build the gift list by itself.

## 3. Mint a temporary Deepgram token on the server

The browser talks to Deepgram using a short pass, not your private key. This code asks Deepgram for that pass. It lives in [`lib/voice/settings.ts`](../lib/voice/settings.ts) and [`app/api/voice/route.ts`](../app/api/voice/route.ts):

```ts
export async function grantToken(): Promise<string> {
  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Deepgram token request failed (${response.status})`);
  return ((await response.json()) as { access_token: string }).access_token;
}
```

Before giving out the pass, `POST /api/voice` checks who is using the app. If they want to edit a list, it checks that the list belongs to them. It then sends the browser `{ token, url, settings, greeting }`. `GET /api/voice` tells the page whether to show the voice button. The pass lasts 30 seconds, so use it right away to **start** the sound connection. The conversation can last longer.

## 4. Configure Deepgram to listen, think, and speak

Next, tell Deepgram what each part should do. This example is shortened from [`lib/voice/settings.ts`](../lib/voice/settings.ts):

```ts
const settings = {
  type: "Settings",
  audio: {
    input: { encoding: "linear16", sample_rate: 16000 },
    output: { encoding: "linear16", sample_rate: 24000, container: "none" },
  },
  agent: {
    listen: {
      provider: {
        type: "deepgram",
        version: "v2",
        model: "flux-general-en",
        keyterms: ["bassinet", "swaddle", "stroller", "Target", "Walmart"],
      },
    },
    think: {
      provider: { type: "open_ai", model: "gpt-4o-mini", temperature: 0.4 },
      prompt: "Ask one short registry question at a time. Use finish_intake when ready.",
      functions: [/* finish_intake schema from ParentProfileSchema */],
    },
    speak: { provider: { type: "deepgram", version: "v2", model: "flux-alexis-en", speed: 0.95 } },
    greeting: "Hi! When is your little one due?",
  },
};
```

In the real app, [`lib/ai/prompts.ts`](../lib/ai/prompts.ts) has the full question rules. Typed chat and voice chat use the same rules. The extra voice rules say to speak in short sentences and ask one question at a time. `finish_intake` uses the actual `ParentProfileSchema`, converted with `z.toJSONSchema`, so Deepgram knows which answers to send back. Flux can tell when the parent has finished a turn. `keyterms` help it hear baby product and store names.

## 5. Stream microphone audio to the Voice Agent

[`components/voice/useVoiceAgent.ts`](../components/voice/useVoiceAgent.ts) handles the sound in the browser. Start it when the parent taps a button. That tap lets the browser ask for microphone access and play the reply. Then ask `/api/voice` for a pass and open the sound connection. This short example uses the `play` and `handleEvent` helpers in the full file:

```ts
const ws = new WebSocket(config.url, ["bearer", config.token]);
ws.binaryType = "arraybuffer";
ws.onmessage = (message) => {
  if (message.data instanceof ArrayBuffer) {
    play(message.data);
    return;
  }
  const event = JSON.parse(String(message.data));
  if (event.type === "Welcome") ws.send(JSON.stringify(config.settings));
  handleEvent(event);
};
```

Wait for `SettingsApplied` before sending sound. [`public/voice-capture-worklet.js`](../public/voice-capture-worklet.js) changes microphone sound into the format Deepgram asked for and sends small pieces, about 50 milliseconds each. Deepgram sends small pieces of spoken reply back. The hook plays them in order.

Use `ConversationText` to show words on the page. When `UserStartedSpeaking` arrives, stop the agent's reply so the parent can interrupt. The other event names help the page show **Listening**, **Thinking**, or **Speaking**. The app also marks **Speaking** when sound arrives, because `AgentStartedSpeaking` does not always arrive. Turn off the microphone and close the connection when the parent stops or leaves. While muted, send `KeepAlive` so the connection stays open.

## 6. Turn the conversation into a reviewable profile

When Deepgram has enough answers, it sends a `FunctionCallRequest` named `finish_intake`. A function call is just Deepgram asking the app to do a job. The app does the job and replies:

```ts
const result = await onFunction(call.name, JSON.parse(call.arguments || "{}"));
ws.send(JSON.stringify({
  type: "FunctionCallResponse",
  id: call.id,
  name: call.name,
  content: result,
}));
```

The handler in [`app/start/page.tsx`](../app/start/page.tsx) fills skipped answers and shows the review card. The parent then taps **Build**. Talking and typing both add messages to the same chat, so the parent can switch between them.

## 7. Let voice propose edits, then require agreement

After the list exists, the same voice code can help change it. [`lib/voice/settings.ts`](../lib/voice/settings.ts) tells Deepgram what is on the list and gives it three jobs:

| Function | App action |
| --- | --- |
| `preview_change` | Ask the edit route what would change and show that list. |
| `apply_change` | Make that change after the parent agrees. |
| `cancel_change` | Throw away the proposed change. |

The handler is in [`app/registry/[id]/page.tsx`](../app/registry/%5Bid%5D/page.tsx). It remembers the change that is waiting for approval. Deepgram must say a change **would** happen while it is only a preview. It can say the change **did** happen only after `apply_change` succeeds. The server checks again that this parent owns the list.

## 8. Test the actual conversation

1. Tap **Answer out loud** on `/start`, allow microphone access, and answer the due date question.
2. Confirm that `ConversationText` appears and the next question is spoken.
3. Say “Just build it.” Check the answers card, then tap **Build** and review the generated items.
4. On the registry page, tap **Say a change** and say “We already have a stroller.” Confirm that the preview appears and nothing changes yet.
5. Say yes to apply it, or no to cancel it. Check the item list after both paths.
6. Block microphone access once. The text controls should still work.

If the voice button is missing, check `DEEPGRAM_API_KEY` and restart the app. If the button appears but voice will not start, check the key's Member permission and the browser's microphone permission. Run `npm run typecheck` and `npm run build` before putting the app online. Use HTTPS for the public website so the microphone works.

## Deepgram references and project history

- [Voice Agent message flow](https://developers.deepgram.com/docs/voice-agent-message-flow)
- [Voice Agent API reference](https://developers.deepgram.com/reference/voice-agent/voice-agent)
- [Flux speech-to-text settings for Voice Agent](https://developers.deepgram.com/docs/voice-agent-stt-models)
- [Temporary token authentication](https://developers.deepgram.com/guides/fundamentals/token-based-authentication)
- Entire checkpoint `01M4CGFZK7DC2Z8QBA529K3B94` records the voice feature in commit `af809fa`.
- Entire checkpoint `01M4CGXCC6K09E5D4XPEE93HGG` records the edit confirmation fix in commit `2f6d827`.
- Entire checkpoint `01M4DB6PNZ4MB869ZNYF32Y3N6` records the shorter, voice-first intake in commit `dd26f1f`.
