# knowledge: unit-economics

- source: SSE /api/chat round 2

---

# Unit Economics

## Unit Economics as a Filter

- **Unit economics is a filter**: There may be value, but if LTV < CAC, there is no product. The value must be sufficient to cover CAC and generate profit.
- **Gap**: The difference between "created value" and "received money" is closed by the business model and communication.

## Economics Within a Segment

- **Different segments = different economics**: Small budget, infrequent frequency, small fleet — unprofitable segment. Optimize for the segment with the best economics.
- **Mistake**: Calculating average economics across all users ("average temperature across the hospital").
- **Drop unprofitable segments**: Even if people are thrilled but the segment is unprofitable --- don't work with it.

## B2B vs B2C (Shift)

- **Shift strategy**: If B2C economics don't work (high CAC, low ticket), you can transfer the technology to B2B (example: GetTaxi, Vimeo).
- In B2B, economics often work more easily due to high ticket and LTV, even with a complex sales cycle.

## A Painful Mistake: Forgetting About Unit Economics During Research

- **The essence of the mistake**: Teams at the segment discovery stage forget or ignore unit economics requirements and find people who fundamentally cannot be profitable.
- **What it looks like**: You'll bend over backwards — they have no money. Teams search for segments in areas where there's neither added value nor margin.
- **Dry cleaning example**: Unit economics only work after order value of $300 and frequency of 5 times per year. Less than that — no matter how hard you try, you'll be in the red.
- **Numerical thresholds are mandatory**: Not abstract attributes ("many clients"), but specific numbers: "employee cost >2,500 EUR", "trading volume >X billion", "more than Y articles per year", "more than 10 properties per year", "business profit >Z billion rubles".
- **Thresholds cut off unprofitability**: Threshold values are needed to avoid falling into unprofitable segments in the first place. Minimum thresholds — to not be unprofitable.
- **Dropping an unprofitable segment is a valuable result**: Congratulations, the most important thing happened — you dropped a segment. That's what we do this exercise for: to avoid going into a certain segment.

## Monetizing Jobs

- We monetize not features, but job completion.
- Pricing should be tied to a Value Metric that grows with product usage (for example, payment per subscriber in an email service, not a flat fee).

## Full Unit Economics Model — Structure & Formulas

The unit economics model consists of 4 interconnected blocks. Each block builds on the previous one.

### Block 1: Sales Funnel (воронка продаж)

Tracks the flow from user acquisition to payments:

| Step | Metric | Formula |
|------|--------|---------|
| 1 | Users / Leads | INPUT: monthly inflow |
| 2 | Conv. to Regs (%) | INPUT: conversion rate |
| 3 | Registrations | = Users × ConvToRegs% |
| 4 | Conv. to Trial (%) | INPUT: conversion rate (100% if no trial) |
| 5 | Trials | = Regs × ConvToTrial% |
| 6 | C1 — Conv. to Buyer (%) | INPUT: first payment conversion |
| 7 | Buyers | = Trials × C1% |
| 8 | Avg Payment Count | INPUT: payments per customer over lifetime |
| 9 | Payments | = Buyers × AvgPaymentCount |

**Full funnel conversion** = ConvToRegs × ConvToTrial × C1 (all as fractions).

### Block 2: Per Paying User (доход на 1-го платящего)

Unit economics of one paying customer over their lifetime:

**CRITICAL: Margin and COGS are complements. Margin% + COGS% = 100%.**
- Margin% = what you keep from average price (commission, gross margin)
- COGS% = what you spend per sale (= 100 − Margin%)

| Metric | Formula | Description |
|--------|---------|-------------|
| Avg. Price | INPUT | Average payment amount |
| Margin % | INPUT | Gross margin or commission rate (what you KEEP) |
| COGS % | = 100 − Margin% | Cost as % of price (shown for clarity) |
| **AMPPU** | = AvgPrice × Margin% × AvgPaymentCount | Total margin per paying user over lifetime |
| **CAC** | = CPUser / full_funnel_conversion | Cost to acquire one paying customer |

Reference formula: **AMPPU = Av.Price × Margin × Av.Payment Count**

**LTV/CAC ratio** = AMPPU / CAC. Target: >3. Minimum viable: >1.
**Payback period** = CAC / monthly_margin_per_user. Target: <12 months.

### Block 3: Per Acquired User (на 1-го привлечённого)

Unit profitability per one user/lead entering the top of funnel:

| Metric | Formula | Description |
|--------|---------|-------------|
| CPUser | INPUT | Cost per user/lead (ad spend per click/lead) |
| **AMPU / LTV** | = AMPPU × full_funnel_conversion | Margin per acquired user |
| **AMPU − CPUser** | = AMPU − CPUser | **KEY METRIC**: profit per acquired user |

**This is the single most important number.** If AMPU − CPUser < 0, the business is burning money on every user acquired.

### Block 4: Financial Totals (финансовые метрики)

Aggregate numbers for the monthly cohort:

| Metric | Formula | Description |
|--------|---------|-------------|
| Revenue | = Payments × AvgPrice | Total revenue from cohort |
| Gross Profit | = Revenue × Margin% | What you keep (= AMPPU × Buyers) |
| Acq. Costs | = Users × CPUser | Total acquisition spend (до продажи) |
| COGS total | = Revenue × COGS% | Total cost of goods (после продажи) |
| Profit | = GrossProfit − AcqCosts | Operating profit (= Users × (AMPU − CPUser)) |
| Fix Costs | INPUT | Fixed monthly costs (rent, salaries, tools) |
| **Net Profit** | = Profit − FixCosts | Bottom line |

## Business Model Adaptations

The model adapts terminology and calculations to the business model:

### Subscription (SaaS)
- **AvgPaymentCount** = customer lifetime in months = 1 / monthly_churn_rate
- **Margin%** = gross margin (typically 70-85% for SaaS)
- **COGS** = server costs + API costs + support per user per month
- Trial stage is usually relevant (free trial → paid)
- Key levers: reduce churn, increase ARPU through upsell

### Marketplace
- **AvgPrice** = average order value (or GMV × take rate)
- **Margin%** = commission / take rate (typically 10-30%)
- **COGS** = payment processing + dispute costs + logistics
- May need to model both sides (supply + demand)
- Trial stage often irrelevant (set ConvToTrial = 100%)

### E-commerce / Transactional
- **Margin%** = (selling price − wholesale cost) / selling price
- **COGS** = shipping + packaging + returns handling
- **AvgPaymentCount** = repeat purchase frequency × customer years
- Trial stage irrelevant (set ConvToTrial = 100%)
- Key levers: increase repeat purchases, reduce returns

### Freemium
- **ConvToTrial** = % of signups who become active free users
- **C1** = % of active free users who convert to paid
- **COGS** must include cost of serving FREE users (amortized across payers)
- Low C1 is expected (2-5%) but must be compensated by low CPUser

### One-time Purchase
- **AvgPaymentCount** = 1 (or include upsells/accessories)
- Focus on margin per sale and acquisition efficiency
- LTV/CAC calculation simplified to single transaction

## Key Health Indicators

| Indicator | Healthy | Warning | Critical |
|-----------|---------|---------|----------|
| AMPU − CPUser | > 0 | ≈ 0 | < 0 |
| LTV/CAC | > 3 | 1-3 | < 1 |
| Payback (months) | < 6 | 6-12 | > 12 |
| Gross Margin | > 60% | 30-60% | < 30% |
| Monthly Churn (SaaS) | < 3% | 3-7% | > 7% |
| C1 conversion | > 5% | 2-5% | < 2% |

## Sensitivity Analysis

When building unit economics, always check: what happens if key inputs change by ±20%?

Critical inputs to stress-test:
1. **C1 conversion** — most volatile, hardest to predict
2. **CPUser** — depends on channel competition and market conditions
3. **Churn / AvgPaymentCount** — small churn changes have huge LTV impact
4. **AvgPrice** — market pressure may force price changes

If a 20% adverse change in any single input makes AMPU − CPUser negative, the model is fragile.

