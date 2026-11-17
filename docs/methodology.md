# Processing and design record

## Scope and provenance

The story examines national hospitalised road crash cases by road user, 2011–2021. State/Territory and First Nations comparisons are outside this focused narrative. The project identifies its supplied CSV extracts as BITRE's September 2023 release.

Source landing page and accompanying data dictionary: https://www.bitre.gov.au/publications/ongoing/hospitalised-injury

Original workbooks, their exact filenames and worksheets, download dates, and the upstream extraction/KNIME workflow are not present in this repository. We cannot verify whether the extracts came from raw records or summary tables. Before submission, the team must supply those materials, identify the source sheets and dictionary version, and document every upstream filter and aggregation. Do not claim that the existing validation proves agreement with original BITRE workbooks.

## Verified inputs and transformations

The five CSVs are preserved unchanged. JavaScript parses numeric fields and rejects invalid counts, shares and duplicate keys. National totals use q1; annual road user counts and supplied national shares use q2. Q3 is computed from q2; its CSV is a validation reference, not the displayed calculation.

For selected start and end years, absolute change = end count − start count. Percentage change = 100 × absolute change / start count; zero start counts and missing records return N/A. An end year must be later than the start year.

Q2 shares retain the full national denominator when users hide series. Q4 and Q5 preserve supplied within-year, within-road-user percentages. Age and sex shares are not renormalised. Absent combinations are labelled No record; explicit zero records remain zero. Age groups retain their source ordering, with Missing last. Sex categories retain their recorded labels, including the combined intersex/indeterminate/missing category.

Run `python scripts/validate_data.py` to reconcile national and road user totals, all 55 year pairs, the reference changes, and all 132 demographic group-year totals. This verifies internal consistency, not upstream provenance.

## Evidence and narrative

National cases: 34,033 in 2011, 39,505 in 2021; difference 5,472 (+16.1%). Pedal cyclists increased 2,772 (+51.4%), car drivers 2,379 (+21.7%), and motorcyclists 1,318 (+17.4%). All figures are rounded for prose, with unrounded data retained for calculations. Demographic summaries recompute the largest recorded age band and recorded male share for featured groups whenever the year changes. Ties select the first source record; the text does not claim a unique maximum.

## Design decisions and implementation review

The original question-led chart sequence now has findings, transitions and a concluding synthesis. Q2 initially displays three major groups to reduce visual overload, retaining all twelve as optional comparisons. Reset restores those groups and the count measure. Direct end labels with collision spacing supplement colour. Q1 labels endpoints and the peak; Q3 labels signed changes; Q5 labels segments where sufficient space exists.

The age heatmap uses a fixed domain from zero to the maximum share across every year rounded up to the next ten percentage points, never a per-year domain. This retains cross-year comparability and uses available colour contrast without silently clipping high shares. Cell percentages remain visible. If the maximum approaches 100%, the domain remains correspondingly broad.

Tables, focusable chart scroll regions, native controls, tooltips on focus/tap, Escape dismissal, a skip link and larger coarse-pointer targets support access. Narrow screens preserve readable chart geometry inside horizontally scrollable regions. Text wrapping enhancements degrade to normal wrapping where unsupported. No animation is required.

## Interpretation limits

Hospitalised cases are distinct from crashes, fatalities and unique persons. Counts and shares do not measure individual injury risk. Population size, population change and travel exposure are not controlled. Victoria's 2012 and NSW's June 2017 reporting changes limit comparability. Unequal age-band widths prevent treating larger shares as higher age-specific risk. These descriptive comparisons cannot identify causal policy, behaviour or pandemic effects.

## Submission evidence still required

- Original source workbook and dictionary versions, precise sheets and extraction date.
- Raw-to-extract processing workflow, including filters, grouping and missing-value decisions.
- Participant usability sessions and documented before/after changes; see usability-evaluation.md.
- Real screen-reader and touch-device evaluation; automated DOM checks cannot establish either.
