# Ask an agent to build a baby registry with Deepgram voice

You do not have to write a technical plan for your coding agent. Start with the problem you want to solve. Ask questions when the agent's answer is confusing. Then ask it to build and show you what works.

This guide follows the actual Entire sessions for Calm Registry. **“What the creator said”** means the words came from those sessions. **“You could say”** is a new example for your own project, not a quote from the creator. The [code guide](deepgram-build-tutorial.md) explains the finished app.

## Before the conversation: get your keys ready

1. Create a project in the [Deepgram Console](https://console.deepgram.com/).
2. Create a Deepgram API key with **Member** permission or higher. The app needs this to get a short-lived pass for the browser. Copy the key when Deepgram shows it.
3. In the project, copy `.env.example` to `.env.local` and add `DEEPGRAM_API_KEY=your_key_here`. Keep the real key out of agent chats and Git commits.
4. Run `npm install` and `npm run dev`. Open `http://localhost:3000/start`.

You do not need a separate OpenAI key for the live voice chat. Deepgram runs the voice agent's model. `OPENAI_API_KEY` is optional for typed chat and custom registry items. Locally, this app can use sample items and save lists on your computer. For a public website, also set up Supabase with the values in [`.env.example`](../.env.example) and put the Deepgram key in your host's private server settings.

If you want to practice adding voice to this repo from scratch, start from the version before the voice feature:

```bash
git clone https://github.com/blackgirlbytes/calm-registry.git
cd calm-registry
git switch -c codex/deepgram-tutorial af809fa^
npm install
cp .env.example .env.local
```

## 1. Tell the agent why the app should exist

**What the creator said:**

> I want to build a baby registry app that makes it easier for pregnant parents to create a registry. The user should be able to describe what they need conversationally and have the app generate a registry.
>
> pregnant tired moms are often required to build out registries. it feels overwhelming. how can we fix the overwhelm..what would make it easy..im not sure

This gave the agent a job: make a big, tiring task feel smaller. The agent suggested a short chat, a ready-made list, small keep-or-skip choices, and simple edits. You can start with a problem even when you do not know the solution.

## 2. Bring up Deepgram as an idea

**What the creator said:**

> curious about your thoughts on adding a voice mode to this..particularly using deepgram

The agent compared a few ways to use Deepgram. That question was enough to start the voice discussion. You do not have to name sound formats, API routes, or model IDs in your first prompt.

**You could say:**

> People might be holding a baby or resting while they make this list. Could they talk to the app instead of typing? I want to use Deepgram. What are the easiest ways to do that, and what would each feel like for a parent?

## 3. Ask the agent to explain what you do not understand

**What the creator said:**

> i need more help understanding option 2

The agent then described what a parent would see and what the app would do behind the scenes. Ask for a simple example before choosing an approach. The early discussion covered a voice layer on top of the typed chat. The finished code uses **Deepgram Voice Agent**, which listens, picks the next reply, and speaks over one connection. These are different plans. The code guide follows the one that was built.

**You could say:**

> Show me what happens when a parent taps the talk button, answers one question, and hears the next one. Explain it like I have never built a voice app.

## 4. Tell the agent what the parent should be able to do

The sessions do not show the creator writing a long technical build prompt. The agent moved from the conversation into a build plan. If you want the same kind of result, use a short request about the experience you want.

**You could say:**

> Let's use Deepgram's Voice Agent. Let parents answer registry questions out loud and say changes to their list. Keep typing as an option. Show their answers before building the list, and ask before making a change. Build it in this app and tell me how to try it.

That request gives the agent the important rules. It can work out the code details. In this repo, the result uses a private Deepgram key on the server, a short browser pass, and a voice connection from the browser to Deepgram. It shows proposed list changes before applying them.

## 5. Question setup problems

**What the creator said:**

> okay so i added deepgram credits..and why does it need member permissions? I thought I could just leave it at default permissions

That question found a real setup issue. The default key could not ask Deepgram for a short browser pass. A key with Member permission is needed for that step. The private key stays on the server.

**You could say:**

> I added my Deepgram key, but voice will not start. Please check which step fails. Explain the error in simple words, and tell me what I need to change in Deepgram. Do not show or print my key.

## 6. Ask to see it work

Once the agent says the feature is ready, ask for a real check. Do not settle for “the code looks right.”

**You could say:**

> Run the app and tell me the address to open. Try answering a question out loud, finishing the answers, and saying “we already have a stroller.” Show me that the stroller stays on the list until I say yes. Also try blocking the microphone. Tell me plainly what worked and what you could not test.

The creator also asked agents to run the app locally and report the port during development. A browser check matters here because microphone permission and sound playback cannot be proven by reading code alone.

## What Deepgram does in the finished app

Deepgram hears the parent's words with Flux, runs the voice conversation, and speaks back with a Flux voice. The app keeps the answers and gift list. It shows answers for review before building a registry. For changes, it shows a preview and waits for the parent to agree. The [step-by-step code guide](deepgram-build-tutorial.md) shows where each part lives.

The exact quotes above come from Entire checkpoint `01M4CGXCC6K09E5D4XPEE93HGG`, which contains the original conversation and voice work. The voice feature was committed in `af809fa`; the edit confirmation fix was committed in `2f6d827`. Deepgram's [token guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) explains the short browser pass.
