// DOM integration checks; dependencies installed in the temporary QA directory.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const deps = path.join(require("node:os").tmpdir(), "dv01-chart-qa/node_modules");
const { JSDOM } = require(path.join(deps, "jsdom"));
const root = path.join(__dirname, "..");
async function run() {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window, doc = w.document, observers = [];
  w.ResizeObserver = class { constructor(callback) { observers.push(callback); } observe() {} };
  w.eval(fs.readFileSync(path.join(deps, "d3/dist/d3.min.js"), "utf8"));
  w.d3.csv = async (file, parse) => w.d3.csvParse(fs.readFileSync(path.join(root, file), "utf8"), parse);
  for (const file of ["js/main.js", "js/distributions.js"]) w.eval(fs.readFileSync(path.join(root, file), "utf8"));
  await new Promise(resolve => setTimeout(resolve, 20));
  const get = selector => doc.querySelector(selector), all = selector => [...doc.querySelectorAll(selector)];
  const change = (id, value) => { get(id).value = value; get(id).dispatchEvent(new w.Event("change")); };
  assert.equal(all("svg").length, 5, get("#trend-status").textContent);
  assert.equal(all("#q1-chart circle").length, 11);
  assert.equal(all("#q2-chart .series").length, 3);
  assert.equal(all("#q2-chart .series-label").length, 3);
  assert.match(get("#q3-insight").textContent, /Pedal cyclist/);
  assert.equal(all("#q3-chart .change-value").length, 12);
  change("#q2-measure", "percentage_share");
  assert.match(get("#q2-chart .data-point").getAttribute("aria-label"), /% of national cases/);
  for (const input of all("#q2-groups input")) { input.checked = false; input.dispatchEvent(new w.Event("change")); }
  assert.equal(all("#q2-chart .data-point").length, 0);
  assert.match(get("#q2-status").textContent, /No groups/);
  const input = get("#q2-groups input"); input.checked = true; input.dispatchEvent(new w.Event("change"));
  assert.equal(all("#q2-chart .series").length, 1);
  get("#q2-reset").click();
  assert.equal(all("#q2-chart .series").length, 3);
  assert.equal(get("#q2-measure").value, "hospitalisations");
  assert.deepEqual(all("#q2-groups input:checked").map(n => n.value), ["Car driver", "Motorcyclist", "Pedal cyclist"]);
  assert.match(get("#q3-status").textContent, /Totals reconcile/);
  change("#q3-start", "2021");
  assert.match(get("#q3-status").textContent, /later/);
  assert.equal(all("#q3-chart svg").length, 0);
  change("#q3-start", "2015");
  assert.equal(all("#q3-chart .change-bar").length, 12);
  assert.match(get("#q3-status").textContent, /Totals reconcile/);
  for (const year of [2011, 2017, 2021]) {
    change("#distribution-year", String(year));
    for (const id of ["q4", "q5"]) assert.match(get(`#${id}-title`).textContent, new RegExp(year));
    assert.equal(all("#q4-chart .age-cell").length, 96);
    assert.equal(all("svg").length, 5);
    assert.match(get("#q4-insight").textContent, new RegExp(year));
    assert.match(get("#q5-insight").textContent, new RegExp(year));
  }
  assert.deepEqual(all("#q4-chart .column-labels text").map(n => n.textContent), ["0–7", "8–16", "17–25", "26–39", "40–64", "65–74", "75+", "Missing"]);
  assert.ok(all("#q4-chart .age-cell").some(n => n.getAttribute("aria-label").includes("No record")));
  const source = w.d3.csvParse(fs.readFileSync(path.join(root, "data/q4_age_distribution.csv"), "utf8"));
  const zero = source.find(r => Number(r.percentage_share) === 0);
  change("#distribution-year", zero.year);
  assert.ok(all("#q4-chart .age-cell").some(n => n.__data__.road_user === zero.road_user && n.__data__.age_group === zero.age_group && /0.0%/.test(n.getAttribute("aria-label"))));
  const mark = get("#q4-chart .age-cell");
  mark.dispatchEvent(new w.Event("focus"));
  assert.equal(get("#distribution-tooltip").textContent, mark.getAttribute("aria-label"));
  assert.equal(get("#distribution-tooltip").hidden, false);
  mark.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  get("#distributions").dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(get("#distribution-tooltip").hidden, true);
  for (const width of [350, 1050, 350]) {
    for (const id of ["overview", "distributions", "q1-chart", "q2-chart", "q3-chart", "q4-chart", "q5-chart"]) Object.defineProperty(doc.getElementById(id), "clientWidth", { configurable: true, value: width });
    observers.forEach(callback => callback());
    assert.equal(all("svg").length, 5);
    assert.equal(Number(get("#q4-chart svg").getAttribute("width")), Math.max(780, width));
  }
  console.log("PASS: five chart DOMs; measure/group controls; comparisons; shared year; age order; absent vs zero; tooltip events; resize joins");
  dom.window.close();
  // Synthetic edge cases exist only in memory; source CSVs are never changed.
  for (const scenario of ["missing-and-zero", "empty", "fetch-error"]) {
    const edge = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), { runScripts: "outside-only" });
    const ew = edge.window;
    ew.ResizeObserver = class { observe() {} };
    ew.eval(fs.readFileSync(path.join(deps, "d3/dist/d3.min.js"), "utf8"));
    ew.d3.csv = async (file, parse) => {
      if (scenario === "fetch-error") throw new Error("Test fetch failure");
      if (scenario === "empty") return [];
      let rows = ew.d3.csvParse(fs.readFileSync(path.join(root, file), "utf8"), parse);
      if (file.includes("q2_")) {
        rows = rows.filter(d => !(d.road_user === "Car driver" && d.year === 2011));
        rows.find(d => d.road_user === "Bus occupant" && d.year === 2011).hospitalisations = 0;
      }
      return rows;
    };
    ew.eval(fs.readFileSync(path.join(root, "js/main.js"), "utf8"));
    await new Promise(resolve => setTimeout(resolve, 20));
    if (scenario === "missing-and-zero") {
      assert.match(ew.document.querySelector("#q3-status").textContent, /absent/);
      const bar = [...ew.document.querySelectorAll(".change-bar")].find(n => n.__data__.road_user === "Bus occupant");
      assert.match(bar.getAttribute("aria-label"), /N\/A/);
      assert.equal(ew.document.querySelector("#q3-chart .missing").textContent, "Missing record");
    } else assert.match(ew.document.querySelector("#trend-status").textContent, /Unable to load/);
    edge.window.close();
  }
  console.log("PASS: synthetic missing group-year, zero denominator, empty CSV and fetch failure");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
