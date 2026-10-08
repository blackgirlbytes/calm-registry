# Build a voice-powered baby registry with agent prompts

Give these prompts to your coding agent in order. The agent handles installing packages, writing code, and running the app. You need a [Deepgram](https://console.deepgram.com/) project with credits and an API key with **Member** permission. Provide the key through a private secret setting when the agent asks for it.

Deepgram **Voice Agent** handles the live conversation through one connection, so the app does not have to join separate listening and speaking services. **Flux** hears the parent's words and notices when they finish speaking, so they do not have to press a button after every answer. **Flux text-to-speech** sends back the spoken reply in pieces, which lets playback start sooner. The [code tutorial](deepgram-build-tutorial.md) shows how these parts fit together.

## 1. Build the registry

> Build a baby registry app for expecting parents who feel overwhelmed by making a list. Let them describe their needs in a short conversation. Ask about the due date, where they live, their home and travel needs, feeding plans, and what they already own. Let them skip questions or finish early. Show their answers before building the registry. Then create a list they can review one item at a time and share with family.

## 2. Add Deepgram voice

> Add a **Talk instead** option using Deepgram's Voice Agent API. Parents should be able to answer the registry questions out loud and hear the next question. Keep typing available too. Keep the Deepgram API key private on the server, and give the browser a short-lived token to connect directly to Deepgram. Tell me what I need to provide from my Deepgram account, and handle the app setup yourself.

## 3. Choose how Deepgram listens and speaks

> Use Deepgram Flux `flux-general-en` to listen. I want it to recognize what parents say and know when they have finished a thought, so the conversation feels natural. Add keyterms for baby products and stores, such as bassinet, swaddle, stroller, Target, and Walmart. Use Deepgram Flux voice `flux-alexis-en` to speak the replies. Keep the voice calm and the answers short. Explain these choices in plain language when you show me the result.

## 4. Make the questions work by voice

> Have the voice agent ask one short registry question at a time. Use the same question rules as the typed chat. Show the words on screen as the conversation happens. When the parent says they are done, collect their answers into the app's parent profile and show them for review. Wait for them to tap **Build** before creating the registry. Let them interrupt the spoken reply, mute the mic, or return to typing.

## 5. Review the registry by voice

> After the registry is built, let the parent review items by talking. Read one item at a time and let them say **keep**, **skip**, or name a product they would rather have. If they ask for other choices, read a few options and let them pick one. Use Deepgram Voice Agent function calls to update the item showing on screen. Keep the tap controls available.

## 6. Make spoken edits safe

> Let the parent say changes such as “We already have a stroller” or “Make this cheaper.” Have the voice agent show and read back a preview first. Ask whether to make the change. Apply it only after the parent agrees, and cancel it if they say no. Do not say a change is finished until the app confirms it worked.

## 7. Check the full experience

> Test the full voice journey in a browser: answer questions out loud, review the answers, build the registry, keep or skip an item by voice, and approve and cancel spoken edits. Check that typing still works, microphone permission is handled, and the Deepgram key never reaches browser code. Fix any problems you find. Tell me what you tested and what still needs a real device or account check.
