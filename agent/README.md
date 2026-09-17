# Agent Flow Guide

This project has two main orchestration flows:

1. Search / answer flow
2. Plot-to-scene flow

Both are designed to be called by the Next.js client, but the backend logic itself remains in the `agent` service.

---

## 1) Search and answer flow

### Entry point

- Client request comes from `ChatbotWidget.handleSubmit` in `client/src/components/chatbot/ChatbotWidget.tsx`
- The browser sends a `POST` request to the Express API route `/search`

### Router layer

- `agent/src/routes/search_lcel.ts`
  - `searchRouter.post("/", ...)`
  - Validates the incoming payload with `SearchInputSchema`
  - Calls `runSearch(input)`

### Search orchestration

- `agent/src/search_tool/searchChain.ts`
  - `runSearch(input)`
    - If `input.useKnowledgeBase === true`, it calls `runKnowledgeBaseSearch(input)`
    - Otherwise it invokes `searchChain.invoke(input)`

- `agent/src/search_tool/searchChain.ts`
  - `searchChain = RunnableSequence.from([routerStep, branch, finalValidateAndPolish])`
    - `routerStep` parses the user question and adds `mode: "web" | "direct"`
    - `branch` chooses `webPath` or `directPath`
    - `finalValidateAndPolish` guarantees that the output matches the answer schema

### Query routing decision

- `agent/src/search_tool/routeStrategy.ts`
  - `routeStrategy(q)`
  - Checks query length, recency hints, price/comparison/news patterns, and other indicators
  - Returns `"web"` for research-heavy queries and `"direct"` for simple Q&A

- `agent/src/search_tool/routeStrategy.ts`
  - `routerStep`
  - Reads `SearchInputSchema`, computes the route, and returns `{ q, companyName, mode }`

### Web pipeline

- `agent/src/search_tool/webPipeline.ts`
  - `webSearchStep`
    - Calls `webSearch(input.q)`
    - Returns results from Tavily

  - `openAndSummarizeStep`
    - Takes the top results, calls `openUrl()` for each page, then `summarize()` to compact them
    - Returns a `pageSummaries` array and a fallback marker

  - `ComposeStep`
    - Uses the model to answer from the page summaries and attaches a source list
    - Returns `{ answer, sources, mode }`

  - `webPath = RunnableSequence.from([webSearchStep, openAndSummarizeStep, ComposeStep])`

### Direct answer pipeline

- `agent/src/search_tool/directPipeline.ts`
  - `directPath`
  - Calls the chat model directly for quick answers without network browsing
  - Returns `{ answer, sources: [], mode: "direct" }`

### Final validation

- `agent/src/search_tool/finalValidate.ts`
  - `finalValidateAndPolish`
    - Validates the final payload with `SearchAnswerSchema`
    - If invalid, calls `repairSearchAns()` and re-validates

  - `repairSearchAns(obj)`
    - Uses the model to repair malformed output into valid JSON

  - `extractJson(input)`
    - Pulls JSON out of a model response even when it includes markdown wrappers

### Web fetching utilities

- `agent/src/utils/webSearch.ts`
  - `webSearch(q)` calls `searchTavilyUtil(query)` and normalizes results via `WebSearchResultsSchema`

- `agent/src/utils/openUrl.ts`
  - `openUrl(url)` validates the URL, fetches the page, strips HTML boilerplate, and extracts readable text

- `agent/src/utils/summarize.ts`
  - `summarize(text)` condenses long fetched text into a small answer-ready summary

### Knowledge-base path

- `agent/src/knowledgeBase/service.ts`
  - `runKnowledgeBaseSearch(input)`
    - Calls `ensureCompanyPolicyIngested(input.companyName)`
    - Finds the relevant company policy PDF and searches its chunked text
    - Uses the model to answer strictly from those excerpts

- `agent/src/knowledgeBase/service.ts`
  - `ensureCompanyPolicyIngested(companyName)`
    - Calls `findCompanyPolicyFile(companyName)`
    - Reads the PDF file
    - Calls `extractPdfText()`
    - Saves policy chunks with `savePolicyDocument()`

- `agent/src/knowledgeBase/mongo.ts`
  - `getPolicyChunks()` and `getPolicyDocuments()` open the MongoDB collections
  - `companyKey(companyName)` creates a normalized company identifier for search lookup

---

## 2) Plot-to-scene flow

### Entry point

- Client request comes from `PlotToSceneMapper.handleSubmit` in `client/src/components/plot-to-scene/PlotToSceneMapper.tsx`
- The browser sends a `POST` request to `/plot-to-scene/start`

### API route

- `agent/src/routes/plot_to_scene.ts`
  - `plotToSceneRouter.post("/start", ...)`
  - Validates the request with `PlotSubmitSchema`
  - Calls `startPlotToScene(input)`

  - `plotToSceneRouter.post("/decide", ...)`
    - Validates the human approval action with `SceneDecisionSchema`
    - Calls `decidePlotToScene(threadId, action)`

### State graph engine

- `agent/src/plot_to_scene/graph.ts`
  - `startPlotToScene(input)`
    - Parses the plot submission
    - Creates a unique `threadId`
    - Invokes `plotToSceneGraph` with the initial state
    - Returns the first `SceneSession`

  - `decidePlotToScene(threadId, action)`
    - Loads the active state for the given thread
    - Sends the human decision back into the graph via `Command({ resume: action })`
    - Returns the next session state

### Graph nodes

- `agent/src/plot_to_scene/graph.ts`
  - `writeScene(state)`
    - Builds a model prompt using the input plot, scene setting, dialogue mode, and accepted scenes
    - Generates the next scene draft
    - Returns `{ currentScene, status: "awaiting_approval" }`

  - `humanApproval(state)`
    - Uses `interrupt(payload)` to pause for human input
    - Accepts `accept`, `rewrite`, or `finish`
    - Updates the accepted scene list or moves back to `write_scene`

  - `afterHuman(state)`
    - Decides if the graph should continue writing or end the loop

- `agent/src/plot_to_scene/graph.ts`
  - `plotToSceneGraph = new StateGraph(GraphState)...`
  - `START -> write_scene -> human_approval -> write_scene / END`

### Session serialization

- `agent/src/plot_to_scene/graph.ts`
  - `toSession(threadId, values)`
  - Converts the LangGraph internal state into the JSON shape expected by the frontend

---

## 3) Shared configuration and model selection

- `agent/src/shared/models.ts`
  - `getChatModel(opts)`
  - Uses the configured provider (`openai`, `gemini`, or `groq`) and returns the proper LangChain chat model

- `agent/src/shared/env.ts`
  - Loads environment variables such as API keys, provider choice, MongoDB connection, and local document directory information

- `agent/src/utils/schemas.ts`
  - Defines the strict Zod validation contracts for web search results, chat answers, and plot-to-scene sessions

---

## 4) UI implementation notes

### ChatbotWidget

The widget is a floating assistant panel built with React state:

- `isOpen` controls the open/closed state of the panel
- `query` stores the user input text
- `answers` stores the UI transcript of questions and answers
- `loading` indicates whether the backend is processing a request
- `knowledgeBaseMode` toggles the KB answer path

The component reads its brand style from the selected company entry in the JSON config and applies those tokens to:

- panel background and border
- header color and status label
- welcome card and suggestion chips
- user/assistant bubble styling
- launcher button shape and glow
- footer and support labels

### PlotToSceneMapper

The plot-to-scene UI is a cinematic two-column editor:

- left side: screenplay brief, scene setting, dialogue setting, form actions
- right side: cutting room panel with accepted scenes and latest draft
- state tracks plot, selected scene style, dialogue mode, loading, and session status
- submission triggers `/plot-to-scene/start`
- decision buttons `Accept`, `Rewrite`, and `Finish` trigger `/plot-to-scene/decide`

The mapper uses the live company theme so the styling reflects the selected brand rather than a fixed default color scheme.

---

## 5) Module purpose summary

- `index.ts` starts the Express server and mounts routes
- `routes/search_lcel.ts` handles chat search requests
- `routes/plot_to_scene.ts` handles scene-generation API requests
- `search_tool/*` handles route selection, direct answers, web retrieval, and validation
- `knowledgeBase/*` handles MongoDB-backed company policy ingestion and retrieval
- `utils/*` handles model I/O, fetching, normalization, and schema validation
- `shared/*` handles environment config and model creation
- `plot_to_scene/graph.ts` manages the stateful cinematic generation workflow

This directory is intentionally split into router, orchestration, retrieval, and validation layers so the app stays readable and each function has a single responsibility.
