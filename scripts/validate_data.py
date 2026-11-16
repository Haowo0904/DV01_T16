"""Read-only reconciliation checks. Run: python scripts/validate_data.py."""
import csv
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    with (ROOT / 'data' / name).open(encoding='utf-8-sig', newline='') as file:
        return list(csv.DictReader(file))


def near(actual, expected, label, tolerance=1e-7):
    assert math.isclose(actual, expected, rel_tol=0, abs_tol=tolerance), (label, actual, expected)


q1 = read('q1_national_trend.csv')
q2 = read('q2_road_user_trends.csv')
q3 = read('q3_road_user_changes.csv')
national = {int(row['year']): int(row['hospitalisations']) for row in q1}
annual = {(int(row['year']), row['road_user']): int(row['hospitalisations']) for row in q2}
assert len(national) == len(q1)
assert len(annual) == len(q2)
groups = sorted({group for _, group in annual})
years = sorted(national)
for year in years:
    near(sum(annual[year, group] for group in groups), national[year], f'Q2 total {year}')
    shares = [float(row['percentage_share']) for row in q2 if int(row['year']) == year]
    near(sum(shares), 100, f'Q2 shares {year}')
for row in q3:
    start = annual[int(row['start_year']), row['road_user']]
    end = annual[int(row['end_year']), row['road_user']]
    near(start, float(row['start_cases']), 'Q3 start')
    near(end, float(row['end_cases']), 'Q3 end')
    near(end - start, float(row['absolute_change']), 'Q3 change')
    if start:
        near((end - start) / start * 100, float(row['percentage_change']), 'Q3 percentage')
comparisons = 0
for start in years:
    for end in years:
        if end <= start:
            continue
        near(sum(annual[end, group] - annual[start, group] for group in groups), national[end] - national[start], 'Q3 national change')
        comparisons += 1
for name, category in [('q4_age_distribution.csv', 'age_group'), ('q5_sex_distribution.csv', 'sex')]:
    rows = read(name)
    counts, shares = defaultdict(int), defaultdict(float)
    seen = set()
    for row in rows:
        key = int(row['year']), row['road_user']
        identity = (*key, row[category])
        assert identity not in seen, identity
        seen.add(identity)
        counts[key] += int(row['hospitalisations'])
        shares[key] += float(row['percentage_share'])
    assert set(counts) == set(annual)
    for key in annual:
        near(counts[key], annual[key], f'{name} count {key}')
        near(shares[key], 100, f'{name} share {key}', tolerance=0.1)
    print(f'{name}: {len(rows)} records; all {len(counts)} group-year counts and shares reconcile')
print(f'PASS: Q2 reconciles with Q1 for {len(years)} years; Q3 matches all {len(q3)} reference rows and {comparisons} year-pair totals')
