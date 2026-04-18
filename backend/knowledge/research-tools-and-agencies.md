# knowledge: research-tools-and-agencies

- source: SSE /api/chat round 3

---

# Quantitative Research Tools, Panels, and Agencies

## Internet Panels

### What Is an Internet Panel

- A company with a massive respondent base (millions) who agreed to participate in surveys.
- The panel knows respondents' demographics, income, consumption. Services: questionnaire programming, hosting, distribution, data collection, respondent compensation.

### Major Panels

- **Russia**: Tiburon (largest), OMI, Online Interviewer.
- **International**: Every country has its own panels. Search "Internet panel in [country]." Resources: **chat_researcher** (Telegram), **ESOMAR** (association of research agencies).

### Cost

- **Through a panel**: ~100 RUB per interview (20-min questionnaire, broad audience). Programming ~30K RUB. Example: 200 interviews = **~50K RUB** total.
- **Through an agency**: 2-3x more expensive. Same 200 interviews = **~100-150K RUB**.

### How to Work with a Panel

1. Describe the task (target audience, number of interviews, questionnaire duration).
2. Panel calculates cost and timeline.
3. Panel programs questionnaire, sends to their base, collects data.
4. Panel returns a database (matrix: respondents x questions).

### Probability Sampling

- **Don't sample from acquaintances!** Acquaintances are fine for qualitative research, but quantitative requires **probability sampling** — that's why we use internet panels.

## Data Collection Methods

| Method | Pros | Cons |
|--------|------|------|
| **In-person** (homes, malls) | Broad coverage incl. non-internet users; can show physical stimuli | Expensive, hard to implement independently |
| **Telephone** (call center) | Everyone has phones, broad coverage | Can't use long lists/formulations (perception by ear). Not suitable for long job lists |
| **Online** (most popular) | Fast, cheaper, can show lists/images/video | Not everyone has internet (elderly, low-income) — rarely a problem |

### Online Interview Variants

| Variant | How it works | Key tradeoff |
|---------|-------------|--------------|
| **Internet panel** (Tiburon, OMI) | Panel selects respondents by criteria from their base | Probability sampling, fast |
| **Own client base** | Program questionnaire (Google Forms, SurveyMonkey), send mailing | Cheap, but only your clients — no potential clients |
| **Reverse sampling** | Survey invitations on major portals (Yandex, hh.ru) | Broad reach, but expensive, requires agency |
| **Targeted ads + survey** | Find rare audiences via VK targeting, parsers | Can find narrow audiences, but huge refusals, not probability sampling |

## Questionnaire Programming

- **Requirement**: Must display correctly on computers, tablets, and mobile phones.

| Tool | When to use |
|------|-------------|
| **Google Forms** | Free, simple questions. Limited logic. |
| **SurveyMonkey, Anketolog, Yandex Forms** | Complex questions, logic, design. |
| **Agency custom systems** | Very complex questions with images, videos, complex logic. |

### Questionnaire Structure

- Questions follow sequentially (usually on new pages).
- Transition logic (if option X → go to question Y).
- Instructions: "Select one answer" or "Select all that apply."

## Research Brief (for an Agency)

A document describing the task so the agency can prepare a commercial proposal.

### Main Parameters

1. **Basics**: Market, competitors, research context, product, users.
2. **Business objective**: What decisions should be made based on results.
3. **Expected outcome**: What change in consumer behavior you want to achieve.
4. **Parameters to measure**: Brand awareness, usage, health indicators, job ranking, segment size, frequency, importance, satisfaction, socio-demographics.
5. **Duration and budget** (if constraints exist).

### Agency Interaction Flow

1. Client sends brief → Agency returns commercial proposal → Confirm order.
2. Approve: sample structure, questionnaire, report format.
3. Agency returns results, conclusions, presentation → Joint implementation.

### How to Choose an Agency

- **International**: Nielsen, TNS, Ipsos, Millward Brown, GfK.
- **Russian**: Magran and others.
- Send requests to several, compare proposals.
- Even without an agency, filling out a brief for yourself helps structure the task.

## Sampling Error Calculator

Three types:

1. **Sampling error**: Input proportion + sample size + significance level → margin of error.
2. **Significant differences**: Input two numbers + two sample sizes → significant or not.
3. **Minimum sample size**: Calculates what sample is needed for differences to be significant.

## Key Recommendations

- **Minimum sample**: 100 respondents (margin +-10%). Below 100 — results unreliable.
- **Cost benchmarks**: Panel ~50K RUB (200 interviews), agency ~100-150K RUB, large samples (1000-2000) — hundreds of thousands.
- **Resources**: Telegram chat_researcher (5-6K participants), ESOMAR, Radar School (Telegram + YouTube on data analysis).
- **Analysis tools**: SPSS (most popular), regression and correlation analysis for calculating real importance.
- **Open-ended coding**: Group free-text responses into meaningful categories. Agencies do this automatically.
- **Long job lists (50+)**: Split into 2-3 blocks within one questionnaire, or into several questionnaires, or do preliminary research to shorten the list.

