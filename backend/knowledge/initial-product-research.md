# knowledge: initial-product-research

- source: SSE /api/chat round 3

---

# Initial Product Research Algorithm

## What This Is

The initial product research builds the first market map for a new product: hypothesis segments with job graphs, market sizing (TAM/SAM/SOM), competitor landscape, and an executive summary. It replaces speculative entity creation with a structured, evidence-based workflow.

**Key value:** Transforms a bare Product + Market canvas into a rich, research-backed strategy map using real web data and наш подход segmentation.

## When Applicable

- Canvas has a **Product** entity with `name`, `description`, and `valueProposition` filled in
- Canvas has a **Market** entity with a real `name` (not just "market") and `targetGeography` (array of regions/countries)
- There is NO `initial_research` entity on the canvas yet
- The user explicitly asks to "research the market", "analyze competitors", "run initial research", OR the system proactively triggers it when all preconditions are met

## Pre-flight Checklist

Before starting, verify ALL of these from the canvas context:

1. **Product.name** — product name (not a placeholder)
2. **Product.description** — what the product does
3. **Product.valueProposition** — what value it creates for customers
4. **Market.name** — market or niche name
5. **Market.targetGeography** — target geography array (e.g., ["Russia", "CIS"])

If any field is missing — update the entity via `updateEntity` first, then wait for the next step before starting research. Entity updates must be committed before createEntities or batchWebSearch can read them.

**Extract variables for the steps below:**
- `{productName}` — from Product.name
- `{productDescription}` — from Product.description
- `{marketName}` — from Market.name
- `{geography}` — from Market.targetGeography (joined as string)
- `{year}` — current year

## Algorithm

### Step 1: Generate Hypothesis Segments + Job Graphs

Call `createEntities` with 2-4 segment tasks. Use the `id` + `containerIdFromTask` pattern — job graphs are auto-injected by the system and linked to segments automatically.

**Rules for segments:**
- Differentiate by motivation, context, and constraints — NOT by demographics
- Each segment describes a group of people with similar Core Jobs
- Include in instruction: name, description, commonTraits, sharedChallenges, segmentationCriteria, currentAlternatives, whyThisSegment
- Use `displayFormat: 'html'` for segments, `displayFormat: 'reactflow'` for job graphs

**Example createEntities call:**
```
createEntities({
  tasks: [
    {
      id: "seg-1",
      entityType: "segment",
      displayFormat: "html",
      instruction: "Create segment '[Segment Name]' with grade [A/B/C]. containerId = '<market_id>'. Description: [2-3 sentences — who these people are, in what context, which jobs they hire the product for]. Profile: [3-5 behavioral tags]. Purpose: [2-4 jobs they hire the product for]. Success criteria: [2-4 criteria]. Current solutions: [2-4 alternatives and why they're unsatisfactory]. Economic attractiveness: segment size, budget, frequency, competition. Segment voice: [2-3 characteristic quotes]. label: '[A/B/C]'.",
      count: 1
    },
    {
      id: "seg-2",
      entityType: "segment",
      displayFormat: "html",
      instruction: "Create segment '[Segment Name 2]' with grade [B/C]. containerId = '<market_id>'. ...",
      count: 1
    }
  ],
  reasoning: "Creating hypothesis segments with job graphs — dependencies resolved automatically via id/containerIdFromTask"
})
```

**How it works:**
- Tasks with `id` (segments) are created in Phase 1 in parallel
- Job graph tasks are auto-injected by the system with `containerIdFromTask` referencing the segment's `id`
- `autoRelationType: "has_job_graph"` automatically creates the segment → job_graph relation

### Step 2: Market Research (Web Search)

Call `batchWebSearch` with 6 queries to gather market data:

```
batchWebSearch({
  queries: [
    { query: "{productName} {marketName} market size TAM SAM {geography}", label: "Market Size" },
    { query: "{productName} {marketName} competitors alternatives", label: "Competitors" },
    { query: "{marketName} trends growth forecast {year}", label: "Trends" },
    { query: "{marketName} industry overview category", label: "Industry" },
    { query: "{marketName} market {geography} statistics", label: "Statistics" },
    { query: "{marketName} pricing comparison reviews", label: "Pricing" }
  ],
  language: "ru",
  reasoning: "Gathering market data for initial product research"
})
```

**Language selection:**
- `'ru'` — if geography includes Russia, CIS, or Russian-speaking markets
- `'en'` — for international markets
- Can combine: first batch in Russian, second in English

**What to extract from results:**
- Market size figures (TAM/SAM/SOM) with sources
- List of competitors and alternatives
- Growth/decline trends
- Pricing models in the niche
- Key players and market shares

### Step 3: Competitor Deep-Dive

From Step 2 results, extract the names of 3-5 key competitors. Call `batchWebSearch` for detailed analysis:

```
batchWebSearch({
  queries: [
    { query: "{competitor1} pricing features reviews {marketName}", label: "{competitor1}" },
    { query: "{competitor2} pricing features reviews {marketName}", label: "{competitor2}" },
    { query: "{competitor3} pricing features reviews {marketName}", label: "{competitor3}" },
    { query: "{competitor1} vs {competitor2} comparison", label: "Comparison" },
    { query: "{productName} alternatives {marketName} {year}", label: "Alternatives" }
  ],
  language: "ru",
  reasoning: "Deep-diving into competitor details"
})
```

**For each competitor, capture:**
- Pricing model and tiers
- Key features and positioning
- User reviews (what's praised, what's criticized)
- Target audience
- Strengths and weaknesses

**Limit:** Maximum 5 competitors per batch. If there are more — prioritize by relevance.

### Step 4: Segment Demand + TAM/SAM

Call `batchWebSearch` to estimate demand per segment:

```
batchWebSearch({
  queries: [
    { query: "{segment1Name} {marketName} market demand {geography}", label: "Segment 1 Demand" },
    { query: "{segment2Name} {marketName} market demand {geography}", label: "Segment 2 Demand" },
    { query: "{marketName} total addressable market {geography} {year}", label: "TAM" },
    { query: "{productName} {marketName} serviceable addressable market", label: "SAM" },
    { query: "{marketName} customer acquisition cost benchmark", label: "CAC Benchmark" },
    { query: "{marketName} average revenue per user benchmark", label: "ARPU Benchmark" }
  ],
  language: "ru",
  reasoning: "Estimating segment demand and market sizing"
})
```

**Goal:** Collect data for calculating:
- TAM — total market where these jobs are performed
- SAM — portion of TAM reachable with current business model
- SOM — realistic share of SAM in 1-2 years
- CAC and ARPU benchmarks for the niche

### Step 5: Create Research Entities

From all web search results, call `createEntities` to create structured output:

```
createEntities({
  tasks: [
    // Market size entities (under market container)
    {
      entityType: "market_size",
      displayFormat: "html",
      instruction: "Create TAM (Total Addressable Market) entity for {marketName}. containerId = '<market_id>'. Include: monetary size, calculation logic, data sources (URLs), time horizon, geography. Format: number + justification + sources.",
      count: 1
    },
    {
      entityType: "market_size",
      displayFormat: "html",
      instruction: "Create SAM (Serviceable Addressable Market) entity. containerId = '<market_id>'. Logic: which portion of TAM can be served with current business model.",
      count: 1
    },
    {
      entityType: "market_size",
      displayFormat: "html",
      instruction: "Create SOM (Serviceable Obtainable Market) entity. containerId = '<market_id>'. Realistic share for 1-2 years with justification.",
      count: 1
    },
    // Competitor entities (under market container)
    {
      entityType: "competitor",
      displayFormat: "html",
      instruction: "Create competitor entity '{competitor1}'. containerId = '<market_id>'. Include: description, pricing model, key features, target audience, strengths/weaknesses, reviews. sources: [{url, title, domain}].",
      count: 1
    },
    // ... more competitors ...
    // Initial research summary (under document container)
    {
      entityType: "initial_research",
      displayFormat: "html",
      instruction: "Create initial research summary for product {productName}. containerId = '<document_id>'. Include: market summary, key findings, competitive landscape, TAM/SAM/SOM estimates, segment recommendations, main risks, sources. sources: [{url, title, domain}].",
      count: 1
    }
  ],
  reasoning: "Creating structured research results — market_size, competitors, initial_research summary"
})
```

**Always include sources** in entity data:
```json
{
  "sources": [
    {"url": "https://example.com/report", "title": "Market Report 2025", "domain": "example.com"}
  ]
}
```

### Step 6: Suggest Next Steps

After creating all entities, call `suggestNextSteps` with relevant follow-up actions:

```
suggestNextSteps({
  steps: [
    {
      label: "Interview focus segment",
      description: "Prepare an interview guide and conduct 5-7 depth interviews with focus segment representatives"
    },
    {
      label: "Refine value proposition",
      description: "Based on the job graph, refine value proposition for each segment"
    },
    {
      label: "Analyze unit economics",
      description: "Calculate CAC, LTV, and margin for each segment"
    },
    {
      label: "Run RAT analysis",
      description: "Identify and prioritize risky assumptions for each segment"
    }
  ]
})
```

## Execution Order

| Step | Tool | What's Created | Dependencies |
|------|------|----------------|--------------|
| 1 | `createEntities` | Segments + job graphs | Pre-flight check |
| 2 | `batchWebSearch` | Market data | Pre-flight check |
| 3 | `batchWebSearch` | Competitor data | Step 2 |
| 4 | `batchWebSearch` | Segment demand data | Steps 1, 2 |
| 5 | `createEntities` | market_size, competitor, initial_research | Steps 2, 3, 4 |
| 6 | `suggestNextSteps` | Recommendations | Step 5 |

**Steps 1 and 2 can run in parallel** — they don't depend on each other. In practice, call createEntities first (Step 1), then immediately start batchWebSearch (Step 2) while sub-agents are still working.

## Anti-patterns

- Do NOT start research without Product and Market entities fully filled on canvas
- Do NOT create segments by demographics — use the job-based approach
- Do NOT skip web search — without real data, the research will be speculative
- Do NOT create more than 5 competitors in one pass — top 3-5 most relevant is enough
- Do NOT forget to include `sources` with URLs in entity data
- Do NOT start research and updateEntity in the same tool-call step — updates must be committed first

