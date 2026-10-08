# Build the voice registry with a coding agent

This version is for someone who wants a coding agent to build the feature. Copy one prompt, let the agent do that step, then check the result. You do not need to understand every code word inside a prompt. Those words tell the agent exactly what to build. Deepgram does the listening and talking. Your app keeps the gift list and asks before changing it.

These prompts fit this repository. The current `main` branch already has voice, so use the older starting point below if you want to build it yourself. The [code guide](deepgram-build-tutorial.md) shows the finished files.

## Set up before you prompt the agent

1. Install Node.js and npm. Make a copy of the app from just before voice was added:

   ```bash
   git clone https://github.com/blackgirlbytes/calm-registry.git
   cd calm-registry
   git switch -c codex/deepgram-tutorial af809fa^
   npm install
   ```

2. Create a Deepgram account and project in the [Deepgram Console](https://console.deepgram.com/).
3. Create a Deepgram API key with **Member** permission or higher. The app needs that permission to ask Deepgram for a temporary browser token.
4. Run `cp .env.example .env.local`. Put `DEEPGRAM_API_KEY=your_key_here` in `.env.local`. Do not paste the real key into an agent chat, code file, or commit.
5. Run `npm run dev`. Open `http://localhost:3000/start`.

For use on your computer, that is enough. The app can use sample products and save lists on your computer. `OPENAI_API_KEY` is optional for custom registry items and typed chat. Deepgram handles the live voice chat without that separate key. For a public website, you also need Supabase and the settings listed in [`.env.example`](../.env.example). Put `DEEPGRAM_API_KEY` in your website host's **private server settings**, not in a public browser setting.

## Prompt 1: Let the agent learn the app

Copy this into your coding agent:

> Read `README.md`, `.env.example`, `lib/types.ts`, `app/start/page.tsx`, `app/api/registries/route.ts`, and the registry edit route. Tell me, in simple words, how a parent answers questions, checks answers, builds a registry, and edits it. Point out which existing parts the voice feature can reuse. Do not change code yet. Do not read or print `.env.local`.

Check its answer: it should say that the parent reviews answers before building and that edits have a preview step. If it misses either, ask it to reread those files.

## Prompt 2: Add safe Deepgram access

> Add a server route at `/api/voice`. `GET` should say whether voice is set up. `POST` should check the current app user, then call Deepgram's `POST https://api.deepgram.com/v1/auth/grant` using `DEEPGRAM_API_KEY` on the server. Return the temporary token, the Voice Agent WebSocket URL, and the settings the browser needs. In edit mode, load the registry and check that this user owns it. Never send the long-lived API key to the browser. Use the default 30-second token. Show me the changed files and a simple way to check the route.

Check its answer: the key should appear only as `process.env.DEEPGRAM_API_KEY` in server code. A 30-second token only has to be valid when the voice connection starts. The conversation can last longer.

## Prompt 3: Make Deepgram ask registry questions

> Build Deepgram Voice Agent settings for intake. Use Deepgram `flux-general-en` to listen and `flux-alexis-en` to speak. Use the hosted `gpt-4o-mini` model to choose the next question. Set microphone audio to 16 kHz `linear16` and spoken output to 24 kHz `linear16`. Reuse the app's existing intake question rules. Ask one short question at a time. Add useful words such as bassinet, swaddle, stroller, Target, and Walmart as Deepgram keyterms. Give the agent a `finish_intake` function based on the real `ParentProfileSchema`. The function must show answers for review; it must not build the registry by itself.

Check its answer: Deepgram should be the part that listens and speaks. The parent should still see the answer card and tap **Build**.

## Prompt 4: Put a microphone button on the page

> Add an **Answer out loud** button to the intake page. Start microphone access from that button tap. Ask `/api/voice` for a temporary token, open `wss://agent.deepgram.com/v1/agent/converse`, send Settings after Deepgram sends `Welcome`, and send audio only after `SettingsApplied`. Convert microphone sound to the input format you configured. Play the audio Deepgram sends back. Show the words from `ConversationText` in the chat. Stop playing the agent when `UserStartedSpeaking` arrives. Clean up the microphone and connection when the parent stops or leaves the page. Keep typing available if voice fails.

Check its answer: tapping the button should ask for microphone permission. Speaking one answer should show its words on the page and lead to a spoken next question.

## Prompt 5: Finish intake with a function call

> Handle Deepgram `FunctionCallRequest`. When it calls `finish_intake`, check and fill the profile with the app's profile helper, show the answers on screen, and send `FunctionCallResponse` with the same call ID and name. Stop the voice session after the agent asks the parent to review the answers. Do not let a spoken answer create the registry directly. Keep the text and voice transcripts together so the parent can switch between talking and typing.

Check its answer: say “Just build it” during intake. The answers should appear for review. A registry should appear only after you tap **Build**.

## Prompt 6: Let the parent change a registry by voice

> Add **Say a change** to the registry page. Start a Deepgram Voice Agent session in edit mode with a short list of current items. Give it `preview_change`, `apply_change`, and `cancel_change` functions. `preview_change` should use the existing edit endpoint and show what would change. Only call `apply_change` after the parent says yes. `cancel_change` should throw away the preview. The voice must say “I'd remove the stroller” for a preview, not “I removed the stroller.” Recheck ownership on the server. Test both yes and no.

Check its answer: say “We already have a stroller.” You should see a proposed change, but the stroller should still be there. Say no, and it should stay. Try again and say yes, and only then should it change.

## Prompt 7: Test the whole trip

> Run `npm run typecheck` and `npm run build`. Test the voice flow in a browser: start intake, answer by voice, check the transcript, finish intake, review answers, build a registry, preview an edit, cancel one edit, and approve another. Test what happens if microphone permission is blocked and if `DEEPGRAM_API_KEY` is missing. Fix problems you can reproduce. Give me a short report of what passed, what failed, and what could not be tested. Do not claim a microphone test passed if you only tested with text.

Check its answer against what you can see in the browser. For production, use HTTPS so browser microphone access works.

## Why these prompts are in this order

The app first needs a safe key exchange. Then Deepgram needs instructions for listening, thinking, and speaking. After that, the page can send sound and receive words. Finally, function calls turn those words into a profile or a proposed edit. The order makes it easy to spot which step broke.

The original build is recorded in Entire checkpoint `01M4CGFZK7DC2Z8QBA529K3B94` and commit `af809fa`. Checkpoint `01M4CGXCC6K09E5D4XPEE93HGG` and commit `2f6d827` show why the edit prompt must call `preview_change` and speak about a preview as a future change. Checkpoint `01M4DB6PNZ4MB869ZNYF32Y3N6` and commit `dd26f1f` show the shorter question flow.

Deepgram's [Voice Agent message flow](https://developers.deepgram.com/docs/voice-agent-message-flow) and [temporary token guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) are the reference for the connection and key steps.
