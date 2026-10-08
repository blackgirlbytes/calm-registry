# Build a voice-powered baby registry with Deepgram

This guide follows the working Calm Registry app in this repository. A parent answers questions out loud, reviews the answers, builds a registry, and then uses voice to review or change items. Deepgram runs the live conversation. The app owns the registry and decides when a change is allowed.

## Why these Deepgram pieces fit together

| Piece | What it does | Why it helps here |
| --- | --- | --- |
| Voice Agent API | Keeps one live connection for listening, choosing a reply, speaking, and calling app functions. | The parent can have a back-and-forth conversation, while the app still controls registry actions. |
| Flux speech-to-text, `flux-general-en` | Turns English speech into words and detects when a speaking turn ends. | Parents can pause naturally instead of pressing a button after each answer. |
| Keyterms | Give Flux product and store names to listen for. | Names like “bassinet” and “Walmart” are easier to recognize. |
| Hosted thinking model | Uses the prompt and the parent's answers to choose the next question or function call. | Deepgram coordinates the full voice turn over the same connection. |
| Flux text-to-speech, `flux-alexis-en` | Sends the agent's spoken reply back as audio. | The app can start playing before the whole reply has arrived. |

Flux is built for conversation. Deepgram's Nova models offer more transcription features, such as smart formatting, but Flux's built-in turn detection is the useful part for this back-and-forth flow. This app uses the English Flux models. Deepgram also offers `flux-general-multi` for multilingual listening, while Flux speech output currently uses English voices. See Deepgram's [speech-to-text comparison](https://developers.deepgram.com/docs/voice-agent-stt-models) and [Flux voice guide](https://developers.deepgram.com/docs/flux-tts/voices).

## 1. Set up the project and keys

You need Node.js, npm, a Deepgram project, and a Deepgram API key. In the [Deepgram Console](https://console.deepgram.com/), create a key with **Member** permission or higher. This lets the server request temporary browser tokens. Copy the key when it is shown.

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

Keep the key on the server. Do not use `NEXT_PUBLIC_DEEPGRAM_API_KEY` or put the key in browser code. The Voice Agent settings below use a model that Deepgram hosts for the conversation. `OPENAI_API_KEY` is optional for this repo's typed chat and custom registry generation. Without it, the app uses built-in questions and sample items. Retailer keys are also optional locally.

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000/start`. The voice button appears when `DEEPGRAM_API_KEY` is set. On your computer, the app can save lists in `.data/registries.json`. For a public website, set up Supabase using the files in `supabase/migrations`, add the four Supabase values from [`.env.example`](../.env.example), and save the Deepgram key as a private server setting. Add your website address to Supabase Auth's redirect URLs.

## 2. Keep the main registry flow independent of voice

First make the app work by typing. It needs to save answers in a `ParentProfile`, show those answers to the parent, and build the list only after they tap **Build**. The code is in [`app/start/page.tsx`](../app/start/page.tsx), [`lib/types.ts`](../lib/types.ts), and [`app/api/registries/route.ts`](../app/api/registries/route.ts).

`ParentProfileSchema` is the list of answers the app expects, such as due date, city, feeding plan, and things the family already owns. Deepgram uses that same list when it calls `finish_intake`. The app uses `coerceProfile` to fill in skipped answers before showing the review card. A spoken phrase cannot build the gift list by itself.

## 3. Mint a temporary Deepgram token on the server

The browser connects to Deepgram with a temporary token, not the private API key. The server requests that token in [`lib/voice/settings.ts`](../lib/voice/settings.ts), then returns it from [`app/api/voice/route.ts`](../app/api/voice/route.ts):

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

Before giving out the token, `POST /api/voice` checks the app user. For review and edit sessions, it also checks that the registry belongs to that user. It returns `{ token, url, settings, greeting }`. `GET /api/voice` tells the page whether to show voice controls. The token lasts 30 seconds by default, so the browser uses it right away to open the connection. An open conversation can last longer. This is why the private key stays off the page. Deepgram explains this in its [token guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication).

## 4. Configure Deepgram to listen, think, and speak

Next, send Deepgram a `Settings` message. `listen` picks the speech recognition model, `think` sets the conversation prompt and functions, and `speak` picks the voice. This example is shortened from [`lib/voice/settings.ts`](../lib/voice/settings.ts):

```ts
const { $schema: _schema, ...parameters } =
  z.toJSONSchema(ParentProfileSchema) as Record<string, unknown>;
const functions = [{
  name: "finish_intake",
  description: "Collect the parent's answers for review.",
  parameters,
  defer_until_eot: true,
}];

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
      functions,
    },
    speak: { provider: { type: "deepgram", version: "v2", model: "flux-alexis-en", speed: 0.95 } },
    greeting: "Hi! When is your little one due?",
  },
};
```

`flux-general-en` is the English listening model. `version: "v2"` selects the Flux model family inside Voice Agent. The keyterms bias recognition toward registry words. `flux-alexis-en` is the English speaking voice, with speed set a little slower than normal. The `think` setting uses a hosted `gpt-4o-mini` model to follow the prompt and decide when to call an app function. Deepgram coordinates these parts for each turn.

The full question rules live in [`lib/ai/prompts.ts`](../lib/ai/prompts.ts). Typed and voice intake share that guidance. The voice rules add short spoken sentences and one question at a time. `finish_intake` uses `ParentProfileSchema`, converted with `z.toJSONSchema`, so the returned answers follow the app's real profile shape. Deepgram's [Voice Agent prompting guide](https://developers.deepgram.com/docs/prompting-voice-agents) explains why function triggers belong in the prompt as well as the function list.

## 5. Stream microphone audio to the Voice Agent

[`components/voice/useVoiceAgent.ts`](../components/voice/useVoiceAgent.ts) handles audio in the browser. Start it from a button tap so the browser can allow microphone access and playback. Ask `/api/voice` for a token, then open Deepgram's WebSocket. A WebSocket stays open so both sides can send audio and events as the conversation happens. This short example uses the `play` and `handleEvent` helpers in the full file:

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

Wait for `SettingsApplied` before sending sound. [`public/voice-capture-worklet.js`](../public/voice-capture-worklet.js) converts microphone audio to 16 kHz mono `linear16`, the format requested in Settings, and sends roughly 50 ms chunks. Deepgram returns 24 kHz `linear16` audio. The hook queues those chunks for smooth playback.

Use `ConversationText` to show words on the page. When `UserStartedSpeaking` arrives, stop the agent's reply so the parent can interrupt. The other event names help the page show **Listening**, **Thinking**, or **Speaking**. The app also marks **Speaking** when sound arrives, because `AgentStartedSpeaking` does not always arrive. Turn off the microphone and close the connection when the parent stops or leaves. While muted, send `KeepAlive` so the connection stays open.

## 6. Turn the conversation into a reviewable profile

When Deepgram has enough answers, it sends a `FunctionCallRequest` named `finish_intake`. Function calling lets the voice agent ask the app to do a specific job. Deepgram handles the conversation, while the app validates and stores the result. Inside the hook's function handler, after checking that the socket is open, the app replies with the same call ID:

```ts
const args = call.arguments ? JSON.parse(call.arguments) : {};
const content = await optionsRef.current.onFunction?.(call.name, args) ?? "Not available.";
s.ws.send(JSON.stringify({
  type: "FunctionCallResponse",
  id: call.id,
  name: call.name,
  content,
}));
```

The handler in [`app/start/page.tsx`](../app/start/page.tsx) fills skipped answers and shows the review card. The parent then taps **Build**. Talking and typing both add messages to the same chat, so the parent can switch between them.

## 7. Review items by voice

After building, the parent reviews items one at a time. [`reviewSettings`](../lib/voice/settings.ts) starts a Deepgram Voice Agent session with the current item and a prompt to ask “Keep it, or skip?” The agent can call `keep_item`, `skip_item`, `choose_option`, `use_their_pick`, `describe_item`, or `open_category`. The handlers in [`app/registry/[id]/review/page.tsx`](../app/registry/%5Bid%5D/review/page.tsx) update the item on screen and tell Deepgram what to say next.

For example, “We want the HALO BassiNest” calls `use_their_pick` with that product name. The review session adds brand names such as HALO and Nuna to Flux keyterms. This helps speech recognition with names that ordinary words might not cover. The parent can still tap the keep and skip buttons.

## 8. Let voice propose edits, then require agreement

After the list exists, the same voice code can help change it. [`lib/voice/settings.ts`](../lib/voice/settings.ts) tells Deepgram what is on the list and gives it three jobs:

| Function | App action |
| --- | --- |
| `preview_change` | Ask the edit route what would change and show that list. |
| `apply_change` | Make that change after the parent agrees. |
| `cancel_change` | Throw away the proposed change. |

The handler is in [`app/registry/[id]/page.tsx`](../app/registry/%5Bid%5D/page.tsx). It remembers the change that is waiting for approval. Deepgram must say a change **would** happen while it is only a preview. It can say the change **did** happen only after `apply_change` succeeds. The server checks again that this parent owns the list.

## 9. Test the actual conversation

1. Tap **Answer out loud** on `/start`, allow microphone access, and answer the due date question.
2. Confirm that `ConversationText` appears and the next question is spoken.
3. Say “Just build it.” Check the answers card, then tap **Build**.
4. On the review page, say “keep,” “skip,” and the name of a product you prefer. Check that the item on screen follows each response.
5. On the registry page, tap **Say a change** and say “We already have a stroller.” Confirm that the preview appears and nothing changes yet.
6. Say yes to apply it, or no to cancel it. Check the item list after both paths.
7. Block microphone access once. The text controls should still work.

If the voice button is missing, check `DEEPGRAM_API_KEY` and restart the app. If the button appears but voice will not start, check the key's Member permission and the browser's microphone permission. Run `npm run typecheck` and `npm run build` before putting the app online. Use HTTPS for the public website so the microphone works.

## Deepgram references and project history

- [Voice Agent message flow](https://developers.deepgram.com/docs/voice-agent-message-flow)
- [Voice Agent API reference](https://developers.deepgram.com/reference/voice-agent/voice-agent)
- [Flux speech-to-text settings for Voice Agent](https://developers.deepgram.com/docs/voice-agent-stt-models)
- [Flux text-to-speech voices](https://developers.deepgram.com/docs/flux-tts/voices)
- [Temporary token authentication](https://developers.deepgram.com/guides/fundamentals/token-based-authentication)
- Entire checkpoint `01M4CGFZK7DC2Z8QBA529K3B94` records the voice feature in commit `af809fa`.
- Entire checkpoint `01M4CGXCC6K09E5D4XPEE93HGG` records the edit confirmation fix in commit `2f6d827`.
- Entire checkpoint `01M4DB6PNZ4MB869ZNYF32Y3N6` records the shorter, voice-first intake in commit `dd26f1f`.
