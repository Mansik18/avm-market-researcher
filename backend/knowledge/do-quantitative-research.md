# knowledge: do-quantitative-research

- source: SSE /api/chat round 3

---

# How to Conduct Quantitative Research

## Why Quantitative Validation Is Needed

### Role of Quantitative Research

- **Hypothesis verification**: Qualitative research forms hypotheses about jobs and segments. Quantitative research allows validating these hypotheses.
- **Measuring prevalence**: In qualitative research we can't understand how prevalent a certain behavior, phenomenon, segment, or job is. Quantitative measurement is needed.
- **Estimating sizes**: Quantitative research allows estimating segment size, job frequency, importance, and satisfaction with current solutions.
- **Decision making**: Based on quantitative data, business decisions can be made: prioritize segments, write product strategy, calculate unit economics.

## Differences Between Qualitative and Quantitative Research

### Qualitative Research

- **Goal**: Understand "why," "how it works," "what for," what values, what needs, what deep motivations a person has.
- **Toolkit**: Guide (interview scheme), not a rigid sequence of questions.
- **Collection methods**: In-depth interviews (via Zoom or in-person), focus groups.
- **Output**: Text data, transcripts that are analyzed qualitatively, broken down into the job formula.
- **Respondent selection logic**: Non-probability sampling. Respondents are selected through acquaintances, friends of friends, snowball method, to identify the widest spectrum of opinions, problems, needs.
- **Cannot extrapolate**: Qualitative research results cannot be projected onto the entire population (general population).
- **Many interviews ≠ quantitative**: Even conducting 100 qualitative interviews is still qualitative research, not quantitative.

### Quantitative Research

- **Goal**: Answer questions "how many," "how often," "how important," "how satisfied."
- **Toolkit**: A questionnaire with a rigidly formalized sequence of questions. No arbitrary interpretation or skipping questions is allowed.
- **Collection methods**: In-person interviews, telephone interviews, online interviews (through internet panels).
- **Output**: Numerical data (matrix: rows = respondents, columns = questions, cells = codes/scores).
- **Data analysis**: Statistical processing (regression, correlation, means, proportions).
- **Respondent selection logic**: Probability sampling. Each person has a calculable probability of being included in the sample.
- **Can extrapolate**: Results can be projected onto the general population with known margin of error.

## Sampling Concept

### Definition and Metaphor

- **Sample**: A portion of the studied population that we surveyed.
- **Soup metaphor (George Gallup)**: "If you stir the soup well, the cook will taste just one spoonful, and from it judge what the entire soup tastes like." It's not necessary to survey the entire population to measure indicators with a good level of confidence.

### Types of Probability Samples

- **Simple random sample**: Absolutely randomly survey people from a list of the entire population. Considered a very good type of sample, but difficult to implement.
- **Cluster sample**: People enter the sample in groups. Often used in nationwide research.
- **Systematic selection**: Survey every second, third, fourth, fifth person. Used for surveys in shopping centers, stores.
- **Stratified sample**: First, people are divided into categories (strata), then within each stratum, random selection is done.

### General Population

- **General population**: The entire population being studied. If studying the Russian market — it's the entire population of Russia.
- **Sample goal**: Scoop "one spoonful" from the "well-stirred soup" (general population).

## Sampling Error and Sample Size

### Sampling Error Formula

- **Sampling error = z x (standard deviation / square root of n)**, where:
  - **z** — confidence probability coefficient (usually 95%)
  - **standard deviation** — measure of spread (how much variation in measurements)
  - **n** — sample size (number of respondents)

### Dependencies

- **Greater spread — greater sampling error**: If we're hitting different spots, accuracy is worse.
- **Larger sample size (n) — smaller sampling error**: The more people surveyed, the smaller the margin of error.
- **Greatest margin of error at 50%**: When half of respondents behave one way, half another — this is the most uncertain situation statistically, yielding maximum sampling error.

### Confidence Interval

- **Confidence interval**: The range within which the estimated value plus its margin of error falls.
- **Example**: If measured 38% with a margin of +-2%, then the confidence interval is from 36% to 40%.
- **With 95% probability**: The true value lies within the confidence interval with 95% probability.

### Confidence Probability Levels

- **99%**: Highest accuracy. Required for medical research, aviation testing. Large samples needed.
- **95%**: Standard level for marketing and sociological research. Accepted worldwide. Recommended for serious product research underlying business models.
- **90%**: Acceptable level for exploratory research when budget is limited.
- **85% and 80%**: Lower accuracy. Can be used for preliminary, exploratory research when the cost of error is small.

### Sampling Error Examples at Different Sizes

- **50 interviews**: Margin of +-14% (at 95% probability) — very large, unacceptable.
- **100 interviews**: Margin of +-9.8% — minimally acceptable for quantitative research.
- **200 interviews**: Margin of +-7%.
- **384 interviews**: Margin of +-5%.
- **600 interviews**: Margin of +-4%.
- **1000 interviews**: Margin of +-3%.
- **2000 interviews**: Margin of +-2%.
- **After 800-1000 interviews**: Accuracy gains become insignificant.

### Significance of Differences

- **Problem of comparing numbers**: You can't simply sort segment proportions and claim one is larger than another if their confidence intervals overlap.
- **Example**: 32% and 31% with a margin of +-2% are statistically the same number (confidence intervals overlap: 30-34% and 29-33%).
- **Significance difference calculator**: Allows checking whether differences between two numbers are statistically significant at a given sample size.

## сегментация Indicator Operationalization

### Four Main Parameters

1. **Segment size (penetration)** — number of people for whom the need for this job arises
2. **Frequency** — how often the need to perform this job arises
3. **Importance** — how important this job is for the person
4. **Satisfaction** — satisfaction with the current way of solving this job

### 1. Segment Size (Penetration)

**Question formulation:**

- "Look at the list below and mark those situations that you've experienced [when washing dishes / when ordering from apps / when moving] in the last year."
- **Important to ask about a period** (usually a year), not "ever," so that the job is current.

**Option rotation:**

- **Critically important**: Show the list in random order to each respondent (rotation).
- **Why**: People read top to bottom, get tired toward the end of the list, may read less carefully. Without rotation, top items receive artificially inflated scores.
- **List splitting**: If the list is very long (20-30 jobs), it can be split into 2-3 blocks with other questions between them so the respondent rests.

### 2. Frequency

**Question formulation:**

- For the situations the respondent marked, ask: "How often does this situation arise for you?"

**Response options (frequency scale):**

- Every day / Several times a day
- Several times a week / Once a week
- Several times a month / Once a month
- Once every six months / Once a year or less

**Conversion:**

- Frequency is converted to times per month for analysis convenience.

**Scale adaptation:**

- The scale depends on product consumption frequency. For food, banking services — shifted toward "every day." For rare services (vacation, travel) — shifted toward months and years.

### 3. Importance

**A) Stated Importance:**

- **Formulation**: "Look at the list of factors below and rate how important each one is personally for you on a scale of 1 to 10."
- **Scale**: Usually 5-point or 10-point.
  - **5-point**: Familiar, easier to understand (analogy with school grades).
  - **10-point**: Gives greater variability, more accurate, better for data analysis.
- **Recommendation**: Ideally use the same scales throughout the questionnaire to avoid cognitive dissonance.
- **Label the extremes**: What a score of 1 means (e.g., "not at all important") and what a score of 10 means (e.g., "extremely important"). Intermediate scores are not labeled.

**Stated importance analysis:**

- **Don't look at the mean**: Rating scales are ordinal, not quantitative. Calculating the mean is incorrect.
- **Look at the proportion of top scores (Top-2 or Top-3)**: Percentage of scores 9 and 10 (for 10-point scale) or 4 and 5 (for 5-point scale).
- **Downside**: People may distort importance (underestimate or overestimate), they find it difficult to evaluate importance.

**B) Real Importance / Derived Importance:**

- **Approach**: Calculated through the effect of satisfaction with individual characteristics on overall product satisfaction.
- **Logic**: If a respondent rates characteristics at 10, and overall product satisfaction is also 10 — these characteristics are important. If characteristics are rated 8-9-10, but the overall product score is 1-2 — these characteristics are unimportant.
- **Method**: Regression analysis (ordinary linear or logistic regression).
- **Coefficient interpretation**: The regression coefficient shows **how many times the probability of choosing the product increases** if the person is maximally satisfied with this attribute.
  - **Coefficient ~1.0**: Virtually no effect on choice (unimportant characteristic).
  - **Coefficient >=1.5-1.8**: Important characteristic.
- **Advantage**: Correlates more with actual human behavior than stated importance.
- **Complexity**: Requires regression analysis skills.

**Rescaling real importance to 10-point scale:**

- **Formula**: (Each value / Maximum value) x 10
- **Why**: To bring to a familiar 0-10 scale for convenient interpretation and use in the score formula.

### 4. Satisfaction

**Question formulation:**

- "Look at the list of factors and rate how satisfied you are with how your current main brand / your current solution performs on each factor."

**Scale:**

- Usually 10-point (from 1 = "completely dissatisfied" to 10 = "fully satisfied").

**Satisfaction analysis:**

- **Look at the proportion of top scores (Top-2)**: Percentage of scores 9 and 10 (proportion of those fully or mostly satisfied).

**Two measurement approaches:**

- **Simple variant**: Ask about "current solution" without specifying which one.
- **Complex variant**: Ask about each specific brand/product. More burden on respondent but gives brand comparison data.

**Rescaling to "dissatisfaction":** For the score formula, **(10 - satisfaction)** is used — the higher the number, the greater the dissatisfaction and opportunity for improvement.

## Score Formula and Segment Prioritization

### Score Calculation Formula

**Score = Segment Size x Frequency x Importance x (10 - Satisfaction)**

- **Segment size**: Proportion of people for whom this job arises (in percentages or fractions).
- **Frequency**: Times per month.
- **Importance**: On a 10-point scale (stated or rescaled real importance).
- **(10 - Satisfaction)**: Dissatisfaction on a 10-point scale.

**Result:**

- A dimensionless quantity (overall attractiveness score for the job/segment).
- The higher the score — the more attractive the segment.

Sort segments by score descending — highest scores are the most prioritized for focus.

## Segment Prioritization Maps

### Map 1: Frequency vs Importance

**Axes:**

- **X axis (horizontal)**: Frequency (times per month). Further right — more frequent.
- **Y axis (vertical)**: Importance (regression coefficient or 10-point scale). Higher — more important.

**Additional dimensions:**

- **Bubble size**: Proportional to segment share (size). Larger bubbles — larger segments.
- **Bubble color**: Satisfaction. Red = dissatisfied, green = maximally satisfied.

**Axis intersection:**

- Axes are set at mean values of frequency and importance.
- This creates 4 quadrants.

**Priority zones:**

- **Ideal zone (top-right, large, red)**: Frequent, important, large segment, dissatisfied — maximum priority.
- **Bottom-left**: Rare and unimportant — don't invest here.

### Map 2: Income vs Importance

**Axes:**

- **X axis (horizontal)**: Average per capita income of segment representatives. Further right — wealthier people.
- **Y axis (vertical)**: Importance.

**Additional dimensions:**

- **Bubble size**: Segment share.
- **Bubble color**: Satisfaction.

**Purpose:**

- Adds an economic dimension. You can see which segments are not only important and dissatisfied, but also solvent (high income).

**Variations:**

- Instead of income, you can use **average check** — even more indicative.

## Segment Portraits (Socio-Demographic Profiles)

### Why Portraits Are Needed

- **Describe the segment in detail**: Who these people are, what they watch, where to find them, where to show ads.
- **Profiling**: Precise targeting of the message, product communication.

### What Parameters to Include in a Portrait

- **Demographics**: Gender, age, education, income, marital status, number of children, job title.
- **Context**: Settlement type, region, dishwasher ownership, who lives in the family.
- **Health and specifics**: Diseases, allergies (if relevant to the product), pets.
- **Media consumption**: Which websites they visit, which social networks they use, which channels they watch.

### How to Use a Portrait

- Choose the target segment, examine its portrait (demographics, employment, media consumption), and use for ad targeting on the channels this segment over-indexes on.

### Portrait Color Coding

- **Green/Red**: Values significantly above/below the sample average. **Total** column = sample average.

## How to Conduct Quantitative Research

### Sequence of Work

**1. Problem and hypothesis description:**

- Describe the business objective, list of jobs (from qualitative research).

**2. Research program and sample structure:**

- Target audience description (whom to survey).
- Determine sample size.
- Calculate margin of error and confidence probability.

**3. Questionnaire development:**

- Compose questions, formulations.
- Estimate interview duration (usually 15-30 minutes, rarely up to 50 minutes).

**4. Questionnaire programming:**

- Convert the questionnaire to an online form (responsive for mobile devices).

**5. Pilot study (optional):**

- Launch on the first few respondents to:
  - Measure average completion time.
  - Identify confusing questions.
  - Fix formulations before launching the main study.

**6. Briefing (if not online):**

- For interviewers in telephone or in-person interviews. Not needed for online surveys.

**7. Fieldwork (data collection):**

- Phone survey: Call center calls.
- In-person interview: Interviewers go to streets, stores.
- Online survey: Through internet panels (most common variant).

**8. Open-ended question coding (if applicable):**

- Read all open responses, group into 5-30 codes, create meaningful categories.
- Agencies do this themselves (they have coders). If doing it yourself — must be done manually.

**9. Data cleaning:**

- Remove duplicates.
- Remove respondents who filled out the questionnaire poorly (all "hard to say" or wrote nonsense).

**10. Data processing:**

- Calculate indicators (e.g., compute real importance through regression, average incomes).

**11. Data analysis:**

- Statistical analysis, building prioritization maps, segment portraits.

**12. Report:**

- Usually in PowerPoint presentation format.

**13. Results presentation** to business sponsor or colleagues.

### Key Approval Stages (If Working with an Agency)

Problem description, research program & sample structure, questionnaire, data analysis & report, presentation — each must be approved by the client.

### Two Main Approaches

**A) Independently:**

- **Pros**: Cheaper (2-3x).
- **Cons**: Requires skills (questionnaire design, programming, data analysis). Requires time.
- **Suitable when**: You have skills and time but no budget.

**B) Through an agency:**

- **Pros**: Agency does everything (questionnaire, programming, data collection, processing, coding, analysis, report, presentation).
- **Cons**: More expensive (2-3x more than independently).
- **Suitable when**: You have budget but no skills or time.


