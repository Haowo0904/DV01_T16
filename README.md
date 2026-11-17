# DV01_T16

Hospitalised Road Crash Injury Trends by Road User Group in Australia, 2011-2021.
Build-free HTML/CSS/JavaScript with D3 7.9.0 from a pinned jsDelivr URL.

## Run locally

From the project folder:

```powershell
python -m http.server 8000
```

Open http://localhost:8000. Internet access is required for D3.
Use HTTP rather than opening index.html directly. No build or deployment is needed.

## Project files

## Data story improvements

The page follows national change → road user contributions → demographic profiles → takeaways. Q2 starts with car drivers, motorcyclists and pedal cyclists; Reset comparison restores that selection and counts. Chart labels expose important values without hover, and demographic insights follow the shared year. The age colour scale is fixed across all years using the rounded-up global maximum.

See [processing and design record](docs/methodology.md) for transformations, evidence and source provenance gaps, and [usability evaluation](docs/usability-evaluation.md) for the participant protocol and blank results template. Participant testing and original-workbook extraction provenance still need team evidence before submission.

### File inventory

- index.html: navigation, Q1 overview, Q2/Q3 comparison section, Q4/Q5 demographics,
  controls, accessible descriptions, tables and source/limitation notes.
- js/main.js: shared road user colours and modular Q1-Q3 updates. Q1/Q2 load once;
  Q3 calculates comparisons from Q2 and retains every road user group.
- js/distributions.js: Q4/Q5 loading, shared year selector, charts and tables.
- css/style.css: existing theme plus chart, legend and control styles.
- data/: supplied CSV files, unchanged. Q3 is used as a validation reference.
- scripts/validate_data.py: read-only reconciliation checks.
- scripts/check_charts.cjs: optional DOM integration tests.

Hover, focus with Tab, or tap marks for details; Escape dismisses tooltips.
Tables expose tiny and zero-width sex segments. Narrow screens use focusable
horizontal scroll areas to preserve labels. Updates use no animation, including
for reduced-motion users. Road user colour keys match across Q2-Q5; demographic
cell and segment colours encode age share or sex rather than road user.

## Checks

```powershell
python scripts/validate_data.py
node --check js/main.js
node --check js/distributions.js
```

These verify annual national totals, Q3 reference values, all 55 year-pair totals,
and demographic counts and share totals for all 132 group-year combinations.

Optional DOM checks use temporary dependencies outside the project:

```powershell
npm.cmd install --prefix "$env:TEMP/dv01-chart-qa" --no-audit --no-fund --package-lock=false jsdom@26 d3@7.9.0
node scripts/check_charts.cjs
```

DOM checks cover charts, controls, comparison validation, shared year updates,
missing vs zero cells, tooltip events and repeated resize joins. They do not
verify visual browser layout, real touch devices or screen-reader behaviour.
Inspect wide/narrow layouts, keyboard focus and tooltip positioning manually.

Optional Edge browser checks (start the local server first):

```powershell
npm.cmd install --prefix "$env:TEMP/dv01-chart-qa" --no-audit --no-fund --package-lock=false playwright
node scripts/check_browser.cjs
```

These check desktop, 390px and 320px layouts for page overflow, runtime errors,
shared-year updates and reset behaviour. Screenshots are saved in the temporary
directory. These checks passed during implementation alongside data and DOM
checks; they do not replace participant, screen-reader or real-touch testing.

Source: BITRE September 2023 release, via supplied project extracts. Reporting
changes in Victoria in 2012 and NSW from June 2017 affect comparability. Counts
and shares describe recorded cases, not individual injury risk or causal effects.
