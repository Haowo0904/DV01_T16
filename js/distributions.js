"use strict";

// Keep Q4/Q5 scoped independently of the team's main.js visualisations.
(() => {
  const section = document.querySelector("#distributions");
  const status = document.querySelector("#distribution-status");
  const yearSelect = document.querySelector("#distribution-year");
  const tooltip = document.querySelector("#distribution-tooltip");
  const ageOrder = ["0-7", "8-16", "17-25", "26-39", "40-64", "65-74", "75+", "Missing"];
  const sexOrder = ["Female", "Male", "intersex or indeterminate or missing"];
  let ageData = [], sexData = [], roadUsers = [], ages = [], sexes = [];
  let selectedYear;
  const count = new Intl.NumberFormat("en-AU");
  const percent = value => `${value.toFixed(1)}%`;
  const ageLabel = value => value.replace(/-/g, "–");
  const key = (roadUser, category) => JSON.stringify([roadUser, category]);
  let colour, sexColour;

  function parseRow(category) {
    return row => {
      const result = { ...row };
      for (const field of ["year", "hospitalisations", "percentage_share"]) {
        if (!row[field]?.trim()) throw new Error(`Missing numeric field: ${field}`);
        result[field] = Number(row[field]);
        if (!Number.isFinite(result[field])) throw new Error(`Invalid numeric field: ${field}`);
      }
      if (!row.road_user || !row[category] || result.hospitalisations < 0 ||
          !Number.isInteger(result.hospitalisations) || !Number.isInteger(result.year) ||
          result.percentage_share < 0 || result.percentage_share > 100) {
        throw new Error("Invalid category, count or percentage in CSV");
      }
      return result;
    };
  }

  function validateRows(rows, category) {
    const seen = new Set();
    for (const row of rows) {
      const id = JSON.stringify([row.year, row.road_user, row[category]]);
      if (seen.has(id)) throw new Error(`Duplicate ${category} record for ${row.year}: ${row.road_user}`);
      seen.add(id);
    }
  }

  function describe(d, category) {
    return `${selectedYear} · ${d.road_user} · ${category === "age_group" ? ageLabel(d[category]) : d[category]}: ${d.absent ? "No record (not zero)" : `${count.format(d.hospitalisations)} hospitalisations · ${percent(d.percentage_share)}`}`;
  }

  function hideTooltip() { tooltip.hidden = true; }

  function showTooltip(event, d, category) {
    tooltip.textContent = describe(d, category);
    tooltip.hidden = false;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || bounds.left + bounds.width / 2;
    const y = event.clientY || bounds.top;
    tooltip.style.left = `${Math.max(8, Math.min(x + 12, window.innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(y + 12, window.innerHeight - tooltip.offsetHeight - 8))}px`;
  }

  function interactive(selection, category) {
    selection.attr("tabindex", 0).attr("role", "img")
      .attr("aria-label", d => describe(d, category))
      .on("pointerenter.distributions", (event, d) => showTooltip(event, d, category))
      .on("pointerleave.distributions", hideTooltip)
      .on("focus.distributions", (event, d) => showTooltip(event, d, category))
      .on("blur.distributions", hideTooltip)
      .on("click.distributions", (event, d) => showTooltip(event, d, category));
  }

  function frame(id, title, description) {
    const host = d3.select(`#${id}-chart`);
    // A scrollable minimum width preserves readable labels on narrow screens.
    const width = Math.max(780, host.node().clientWidth);
    const height = roadUsers.length * 42 + 84;
    const svg = host.selectAll("svg").data([null]).join("svg")
      .attr("width", width).attr("height", height)
      .attr("role", "group").attr("aria-labelledby", `${id}-title ${id}-description`);
    svg.selectAll("title").data([null]).join("title").attr("id", `${id}-title`).text(`${title}, ${selectedYear}`);
    svg.selectAll("desc").data([null]).join("desc").attr("id", `${id}-description`).text(description);
    const xStart = 255, xEnd = width - 20;
    const y = d3.scaleBand().domain(roadUsers).range([44, height - 40]).padding(0.13);
    svg.selectAll("g.row-labels").data([null]).join("g").attr("class", "row-labels")
      .selectAll("text").data(roadUsers).join("text")
      .attr("x", xStart - 12).attr("y", d => y(d) + y.bandwidth() / 2)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle").text(d => d);
    svg.selectAll("circle.road-user-key").data(roadUsers).join("circle")
      .attr("class", "road-user-key").attr("cx", 5).attr("cy", d => y(d) + y.bandwidth() / 2)
      .attr("r", 4).attr("fill", d => window.roadUserColour(d));
    return { svg, width, height, xStart, xEnd, y };
  }

  function updateTable(id, records, category) {
    const table = d3.select(`#${id}-table`).selectAll("table").data([null]).join("table");
    table.selectAll("caption").data([null]).join("caption").text(`${selectedYear} · ${category === "sex" ? "Sex" : "Age"} distribution. Shares use the same year and road user total.`);
    table.selectAll("thead").data([null]).join("thead").selectAll("tr").data([null]).join("tr")
      .selectAll("th").data(["Year", "Road user", category === "sex" ? "Sex" : "Age group", "Hospitalisations", "Share"])
      .join("th").attr("scope", "col").text(d => d);
    table.selectAll("tbody").data([null]).join("tbody").selectAll("tr").data(records)
      .join("tr").selectAll("td").data(d => [selectedYear, d.road_user,
        category === "sex" ? d.sex : ageLabel(d.age_group),
        d.absent ? "No record" : count.format(d.hospitalisations),
        d.absent ? "No record" : percent(d.percentage_share)])
      .join("td").text(d => d);
  }

  function updateAgeChart() {
    const rows = ageData.filter(d => d.year === selectedYear);
    const lookup = new Map(rows.map(d => [key(d.road_user, d.age_group), d]));
    const cells = roadUsers.flatMap(road_user => ages.map(age_group =>
      lookup.get(key(road_user, age_group)) || { road_user, age_group, absent: true }));
    const { svg, xStart, xEnd, y } = frame("q4", "Age distribution heatmap",
      "Rows are road users; columns are age groups in ascending order, then Missing. Colour shows share on a fixed 0–100% scale across years. Hatched cells have no record. Exact values are available by keyboard focus and in the data table.");
    const defs = svg.selectAll("defs").data([null]).join("defs");
    const pattern = defs.selectAll("pattern").data([null]).join("pattern")
      .attr("id", "q4-absent").attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6);
    pattern.selectAll("rect").data([null]).join("rect").attr("width", 6).attr("height", 6).attr("fill", "#f2f4f5");
    pattern.selectAll("path").data([null]).join("path").attr("d", "M0,6L6,0").attr("stroke", "#a9b5bc");
    const x = d3.scaleBand().domain(ages).range([xStart, xEnd]).padding(0.05);
    svg.selectAll("g.column-labels").data([null]).join("g").attr("class", "column-labels")
      .selectAll("text").data(ages).join("text").attr("x", d => x(d) + x.bandwidth() / 2)
      .attr("y", 26).attr("text-anchor", "middle").text(ageLabel);
    const marks = svg.selectAll("rect.age-cell").data(cells, d => key(d.road_user, d.age_group)).join("rect")
      .attr("class", "age-cell").attr("x", d => x(d.age_group)).attr("y", d => y(d.road_user))
      .attr("width", x.bandwidth()).attr("height", y.bandwidth()).attr("rx", 3)
      .attr("fill", d => d.absent ? "url(#q4-absent)" : colour(d.percentage_share));
    interactive(marks, "age_group");
    svg.selectAll("text.cell-value").data(cells).join("text").attr("class", "cell-value")
      .attr("x", d => x(d.age_group) + x.bandwidth() / 2).attr("y", d => y(d.road_user) + y.bandwidth() / 2)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle").attr("pointer-events", "none")
      .attr("fill", d => !d.absent && d.percentage_share >= 55 ? "white" : "#18324b")
      .text(d => d.absent ? "—" : percent(d.percentage_share));
    updateTable("q4", cells, "age_group");
    return rows.length;
  }

  function updateSexChart() {
    const rows = sexData.filter(d => d.year === selectedYear);
    const lookup = new Map(rows.map(d => [key(d.road_user, d.sex), d]));
    const segments = [], tableRows = [], totals = [];
    for (const road_user of roadUsers) {
      let total = 0, recorded = 0;
      for (const sex of sexes) {
        const row = lookup.get(key(road_user, sex));
        tableRows.push(row || { road_user, sex, absent: true });
        if (row) {
          segments.push({ ...row, start: total });
          total += row.percentage_share;
          recorded++;
        }
      }
      totals.push({ road_user, total, recorded });
    }
    const { svg, xStart, xEnd, height, y } = frame("q5", "Sex distribution stacked bars",
      "One horizontal bar per road user. Recorded sex categories are stacked using their supplied percentages on a 0–100% axis, without renormalising. Focus segments or open the table for exact values, including zero and absent records.");
    const x = d3.scaleLinear().domain([0, 100]).range([xStart, xEnd]);
    svg.selectAll("g.x-axis").data([null]).join("g").attr("class", "x-axis")
      .attr("transform", `translate(0,${height - 34})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}%`));
    svg.selectAll("rect.bar-track").data(roadUsers).join("rect").attr("class", "bar-track")
      .attr("x", xStart).attr("y", d => y(d)).attr("width", xEnd - xStart).attr("height", y.bandwidth()).attr("fill", "#eef2f4");
    const marks = svg.selectAll("rect.sex-segment").data(segments, d => key(d.road_user, d.sex)).join("rect")
      .attr("class", "sex-segment").attr("x", d => x(d.start)).attr("y", d => y(d.road_user))
      .attr("width", d => x(d.percentage_share) - x(0)).attr("height", y.bandwidth())
      .attr("fill", d => sexColour(d.sex));
    interactive(marks, "sex");
    svg.selectAll("text.no-record").data(totals.filter(d => !d.recorded)).join("text").attr("class", "no-record")
      .attr("x", xStart + 10).attr("y", d => y(d.road_user) + y.bandwidth() / 2).attr("dominant-baseline", "middle").text("No records");
    const invalid = totals.filter(d => d.recorded && Math.abs(d.total - 100) > 0.1);
    document.querySelector("#q5-totals").textContent = invalid.length
      ? `Check recorded shares: ${invalid.map(d => `${d.road_user}: ${percent(d.total)}`).join("; ")}. Shares are displayed as supplied.`
      : `All ${totals.filter(d => d.recorded).length} road user groups with records total approximately 100% (tolerance: 0.1 percentage points). Percentages use the total for the same year and road user. Absent categories are not treated as zero.`;
    updateTable("q5", tableRows, "sex");
    return rows.length;
  }

  function renderLegends() {
    const legend = d3.select("#q4-legend");
    legend.append("span").text("Share of hospitalisations (%) · fixed scale");
    const ramp = legend.append("div").attr("class", "age-colour-legend");
    ramp.append("div").attr("class", "age-colour-ramp").style("background",
      `linear-gradient(to right, ${d3.range(0, 101, 10).map(value => colour(value)).join(",")})`);
    ramp.append("div").attr("class", "age-colour-ticks").selectAll("span").data([0, 25, 50, 75, 100]).join("span").text(d => `${d}%`);
    legend.append("span").attr("class", "absent-key").text("▧ No record · 0.0% is an explicit zero");
    const items = d3.select("#q5-legend").selectAll("span").data(sexes).join("span").attr("class", "sex-legend-item");
    items.append("i").style("background-color", d => sexColour(d)).attr("aria-hidden", "true");
    items.append("span").text(d => d);
  }

  function updateCharts() {
    hideTooltip();
    const ageCount = updateAgeChart(), sexCount = updateSexChart();
    status.textContent = `${selectedYear} · ${roadUsers.length} road user groups. ${ageCount ? "Age data loaded." : "No age records for this year."} ${sexCount ? "Sex data loaded." : "No sex records for this year."}`;
  }

  async function init() {
    try {
      if (!window.d3) throw new Error("D3 could not load. Check your internet connection and reload");
      [ageData, sexData] = await Promise.all([
        d3.csv("data/q4_age_distribution.csv", parseRow("age_group")),
        d3.csv("data/q5_sex_distribution.csv", parseRow("sex"))
      ]);
      validateRows(ageData, "age_group");
      validateRows(sexData, "sex");
      const allRows = [...ageData, ...sexData];
      if (!allRows.length) { status.textContent = "No age or sex records are available in the CSV files."; return; }
      roadUsers = [...new Set(allRows.map(d => d.road_user))].sort(d3.ascending);
      const actualAges = [...new Set(ageData.map(d => d.age_group))];
      ages = actualAges.sort((a, b) => {
        const rank = value => { const i = ageOrder.indexOf(value.replace(/–/g, "-")); return i < 0 ? 99 : i; };
        return rank(a) - rank(b) || d3.ascending(a, b);
      });
      sexes = [...new Set(sexData.map(d => d.sex))].sort((a, b) => {
        const rank = value => sexOrder.includes(value) ? sexOrder.indexOf(value) : 99;
        return rank(a) - rank(b) || d3.ascending(a, b);
      });
      colour = d3.scaleSequential(d3.interpolateBlues).domain([0, 100]);
      sexColour = d3.scaleOrdinal().domain(sexes).range(["#007c83", "#b65723", "#7864a7", "#627487"]);
      const years = [...new Set(allRows.map(d => d.year))].sort(d3.ascending);
      selectedYear = years.includes(2021) ? 2021 : years[years.length - 1];
      d3.select(yearSelect).selectAll("option").data(years).join("option").attr("value", d => d).text(d => d);
      yearSelect.value = selectedYear;
      yearSelect.disabled = false;
      yearSelect.addEventListener("change", () => { selectedYear = Number(yearSelect.value); updateCharts(); });
      section.addEventListener("keydown", event => { if (event.key === "Escape") hideTooltip(); });
      document.addEventListener("pointerdown", event => { if (!event.target.closest(".age-cell, .sex-segment")) hideTooltip(); });
      window.addEventListener("scroll", hideTooltip, true);
      renderLegends();
      updateCharts();
      let previousWidth = section.clientWidth;
      new ResizeObserver(() => {
        if (section.clientWidth !== previousWidth) { previousWidth = section.clientWidth; updateCharts(); }
      }).observe(section);
    } catch (error) {
      yearSelect.disabled = true;
      status.textContent = `Unable to load distributions: ${error.message}. Serve the project over HTTP and check both CSV files, then reload.`;
      status.setAttribute("role", "alert");
    }
  }

  init();
})();
