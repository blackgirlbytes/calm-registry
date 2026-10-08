# Ask an agent to build a baby registry with Deepgram voice

You do not have to write a technical plan for your coding agent. Start with the problem you want to solve. Ask questions when the agent's answer is confusing. Then ask it to build and show you what works.

This guide follows the actual Entire sessions for Calm Registry. **“What the creator said”** means the words came from those sessions. **“You could say”** is a new example for your own project, not a quote from the creator. The [code guide](deepgram-build-tutorial.md) explains the finished app.

## What you need from Deepgram

Voice needs a [Deepgram](https://console.deepgram.com/) account with credits and an API key with **Member** permission or higher. That permission lets the app get a short pass for the browser. Your coding agent can handle the project setup, private key settings, and running the app. If it needs the key, provide it through a private secret setting rather than pasting it into chat.

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

> Please test the whole voice experience. Try answering a question out loud, finishing the answers, and saying “we already have a stroller.” Make sure the stroller stays on the list until I say yes. Also try blocking the microphone. Tell me plainly what worked and what you could not test.

A browser check matters here because microphone permission and sound playback cannot be proven by reading code alone.

## What Deepgram does in the finished app

Deepgram hears the parent's words with Flux, runs the voice conversation, and speaks back with a Flux voice. The app keeps the answers and gift list. It shows answers for review before building a registry. For changes, it shows a preview and waits for the parent to agree. The [step-by-step code guide](deepgram-build-tutorial.md) shows where each part lives.

The exact quotes above come from Entire checkpoint `01M4CGXCC6K09E5D4XPEE93HGG`, which contains the original conversation and voice work. The voice feature was committed in `af809fa`; the edit confirmation fix was committed in `2f6d827`. Deepgram's [token guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) explains the short browser pass.
