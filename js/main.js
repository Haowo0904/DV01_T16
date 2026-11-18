"use strict";

// Shared road user palette; demographic colours encode age/sex, not road user.
const roadUserColours = new Map([
  ["Car driver", "#1F78B4"],
  ["Car passenger", "#6BAED6"],
  ["Car unknown position", "#5E4FA2"],
  ["Motorcyclist", "#FF7F00"],
  ["Pedal cyclist", "#E31A1C"],
  ["Pedestrian", "#33A02C"],
  ["Bus occupant", "#008080"],
  ["Pick-up truck or van occupant", "#E6AB02"],
  ["Heavy transport driver", "#882255"],
  ["Heavy transport passenger", "#CC6677"],
  ["Heavy transport unknown position", "#666666"],
  ["Other or unknown", "#A6761D"]
]);
window.roadUserColour = roadUser => roadUserColours.get(roadUser) ?? "#536678";

(() => {
  const fmt = new Intl.NumberFormat("en-AU");
  const number = value => fmt.format(value);
  const pct = value => value == null ? "N/A" : `${value.toFixed(1)}%`;
  const tooltip = document.querySelector("#trend-tooltip");
  let national = [], annual = [], groups = [], years = [];
  const defaultGroups = ["Car driver", "Motorcyclist", "Pedal cyclist"];
  let selected = new Set();

  function parse(row) {
    const result = { ...row };
    if (!row.year?.trim() || !row.hospitalisations?.trim()) throw new Error("Missing year or hospitalisations");
    if ("road_user" in row && (!row.road_user.trim() || !row.percentage_share?.trim())) throw new Error("Missing road user or percentage share");
    for (const field of ["year", "hospitalisations", "percentage_share", "annual_total", "year (Right)"]) {
      if (!(field in row)) continue;
      if (!row[field].trim() || !Number.isFinite(Number(row[field]))) throw new Error(`Invalid ${field}`);
      result[field] = Number(row[field]);
    }
    if (result.hospitalisations < 0 || !Number.isInteger(result.hospitalisations)) throw new Error("Invalid case count");
    if (!Number.isInteger(result.year) || ("percentage_share" in result && (result.percentage_share < 0 || result.percentage_share > 100))) throw new Error("Invalid year or percentage share");
    return result;
  }

  function table(id, headers, rows, caption) {
    const table = d3.select(`#${id}-table`).selectAll("table").data([null]).join("table");
    table.selectAll("caption").data([caption]).join("caption").text(d => d);
    table.selectAll("thead").data([null]).join("thead").selectAll("tr").data([null]).join("tr")
      .selectAll("th").data(headers).join("th").attr("scope", "col").text(d => d);
    table.selectAll("tbody").data([null]).join("tbody").selectAll("tr").data(rows).join("tr")
      .selectAll("td").data(d => d).join("td").text(d => d);
  }

  function hide() { tooltip.hidden = true; }
  function interactive(marks, describe) {
    function show(event, d) {
      tooltip.textContent = describe(d);
      tooltip.hidden = false;
      const box = event.currentTarget.getBoundingClientRect();
      tooltip.style.left = `${Math.max(8, Math.min(event.clientX || box.left, innerWidth - tooltip.offsetWidth - 8))}px`;
      tooltip.style.top = `${Math.max(8, Math.min((event.clientY || box.top) + 14, innerHeight - tooltip.offsetHeight - 8))}px`;
    }
    marks.attr("tabindex", 0).attr("role", "img").attr("aria-label", describe)
      .on("pointerenter.trends", show).on("focus.trends", show).on("click.trends", show)
      .on("pointerleave.trends", hide).on("blur.trends", hide);
  }

  function frame(id, description, height = 390) {
    const host = document.querySelector(`#${id}-chart`);
    const width = Math.max(780, host.clientWidth);
    const svg = d3.select(host).selectAll("svg").data([null]).join("svg")
      .attr("width", width).attr("height", height).attr("role", "group").attr("aria-labelledby", `${id}-desc`);
    svg.selectAll("desc").data([description]).join("desc").attr("id", `${id}-desc`).text(d => d);
    return { svg, width, height };
  }

  function lineChart(id, rows, measure, series, description) {
    const { svg, width, height } = frame(id, description);
    const x = d3.scaleLinear().domain(d3.extent(years)).range([85, width - (id === "q2" ? 225 : 24)]);
    const y = d3.scaleLinear().domain([0, d3.max(rows, d => d[measure]) || 1]).nice().range([height - 48, 64]);
    svg.selectAll("g.x-axis").data([null]).join("g").attr("class", "x-axis")
      .attr("transform", `translate(0,${height - 48})`).call(d3.axisBottom(x).tickValues(years).tickFormat(d3.format("d")));
    svg.selectAll("g.y-axis").data([null]).join("g").attr("class", "y-axis")
      .attr("transform", "translate(85,0)").call(d3.axisLeft(y).ticks(6).tickFormat(measure === "percentage_share" ? d => `${d}%` : d3.format(",")));
    svg.selectAll("text.axis-label").data([null]).join("text").attr("class", "axis-label")
      .attr("x", 85).attr("y", 20).text(measure === "percentage_share" ? "Share of national cases (%)" : "Hospitalisation cases (zero baseline)");
    const line = d3.line().defined(d => d != null).x(d => x(d.year)).y(d => y(d[measure]));
    svg.selectAll("path.series").data(series, d => d.name).join("path").attr("class", "series")
      .attr("fill", "none").attr("stroke-width", 2).attr("stroke", d => d.colour)
      .attr("d", d => line(years.map(year => d.rows.find(row => row.year === year))));
    const points = svg.selectAll("circle.data-point").data(rows, d => `${d.road_user || "national"}-${d.year}`).join("circle")
      .attr("class", "data-point").attr("cx", d => x(d.year)).attr("cy", d => y(d[measure]))
      .attr("r", 5).attr("fill", d => d.road_user ? window.roadUserColour(d.road_user) : "#007c83")
      .attr("stroke", "white");
    interactive(points, d => `${d.year}${d.road_user ? ` · ${d.road_user}` : ""}: ${measure === "percentage_share" ? pct(d[measure]) + " of national cases" : number(d[measure]) + " hospitalisations"}`);
    if (id === "q2") {
      const labels = series.filter(d => d.rows.some(row => row.year === years.at(-1)))
        .map(d => ({ ...d, last: d.rows.find(row => row.year === years.at(-1)) }))
        .sort((a, b) => y(a.last[measure]) - y(b.last[measure]));
      labels.forEach((d, i) => { d.labelY = Math.max(y(d.last[measure]), i ? labels[i - 1].labelY + 20 : 64); });
      if (labels.length && labels.at(-1).labelY > height - 50) {
        labels.at(-1).labelY = height - 50;
        for (let i = labels.length - 2; i >= 0; i--) labels[i].labelY = Math.min(labels[i].labelY, labels[i + 1].labelY - 20);
      }
      svg.selectAll("line.label-leader").data(labels, d => d.name).join("line").attr("class", "label-leader")
        .attr("x1", x(years.at(-1)) + 6).attr("x2", width - 210).attr("y1", d => y(d.last[measure])).attr("y2", d => d.labelY).attr("stroke", d => d.colour);
      svg.selectAll("text.series-label").data(labels, d => d.name).join("text").attr("class", "series-label")
        .attr("x", width - 205).attr("y", d => d.labelY).attr("dominant-baseline", "middle").text(d => d.name);
    }
    return { svg, x, y, height };
  }

  function updateNationalChart() {
    const { svg, x, y, height } = lineChart("q1", national, "hospitalisations", [{ name: "National", colour: "#007c83", rows: national }],
      "National hospitalised injury cases by year. The vertical axis starts at zero. Reporting changes are marked for Victoria in 2012 and NSW from June 2017. Focus a point or open the data table for values.");
    const peak = d3.greatest(national, d => d.hospitalisations);
    const keyPoints = [...new Map([national[0], peak, national.at(-1)].map(d => [d.year, d])).values()];
    svg.selectAll("text.key-value").data(keyPoints, d => d.year).join("text").attr("class", "key-value")
      .attr("x", d => x(d.year)).attr("y", d => y(d.hospitalisations) + (d === national.at(-1) && d !== peak ? 24 : -14))
      .attr("text-anchor", d => d === national[0] ? "start" : d === national.at(-1) ? "end" : "middle")
      .text(d => `${d.year}: ${number(d.hospitalisations)}${d === peak ? " (peak)" : ""}`);
    const annotations = [{ year: 2012, label: "Victoria: 2012" }, { year: 2017 + 5 / 12, label: "NSW: June 2017" }];
    svg.selectAll("line.reporting").data(annotations).join("line").attr("class", "reporting")
      .attr("x1", d => x(d.year)).attr("x2", d => x(d.year)).attr("y1", 58).attr("y2", height - 48)
      .attr("stroke", "#607989").attr("stroke-dasharray", "4 4").attr("pointer-events", "none");
    svg.selectAll("text.reporting").data(annotations).join("text").attr("class", "reporting")
      .attr("x", d => x(d.year)).attr("y", 46).text(d => d.label);
    table("q1", ["Year", "Hospitalisations"], national.map(d => [d.year, number(d.hospitalisations)]), "National hospitalised cases");
  }

  function updateRoadUserChart() {
    hide();
    const measure = document.querySelector("#q2-measure").value;
    const rows = annual.filter(d => selected.has(d.road_user));
    document.querySelector("#q2-status").textContent = selected.size ? `${selected.size} road user groups selected. Focus or tap points for details.` : "No groups selected. Select a road user group to display its trend.";
    lineChart("q2", rows, measure, groups.filter(name => selected.has(name)).map(name => ({ name, colour: window.roadUserColour(name), rows: rows.filter(d => d.road_user === name) })),
      `Road user trends: ${measure === "percentage_share" ? "share of national cases" : "hospitalisation cases"}. Missing annual records break the lines. Colours match the labelled group controls. Focus points or use the data table.`);
    table("q2", ["Year", "Road user", "Hospitalisations", "National share"], rows.map(d => [d.year, d.road_user, number(d.hospitalisations), pct(d.percentage_share)]), "Selected road user groups; shares retain the national denominator");
  }

  function updateChangesChart() {
    hide();
    const start = Number(document.querySelector("#q3-start").value), end = Number(document.querySelector("#q3-end").value);
    const status = document.querySelector("#q3-status");
    if (end <= start) {
      status.textContent = "Choose an end year later than the start year.";
      document.querySelector("#q3-insight").textContent = "A valid comparison needs an end year later than the start year.";
      d3.select("#q3-chart").selectAll("svg").remove();
      table("q3", ["Road user", "Change"], [], "Invalid year comparison");
      return;
    }
    const changes = groups.map(road_user => {
      const first = annual.find(d => d.year === start && d.road_user === road_user);
      const last = annual.find(d => d.year === end && d.road_user === road_user);
      const change = first && last ? last.hospitalisations - first.hospitalisations : null;
      return { road_user, first, last, change, percentage: change == null || first.hospitalisations === 0 ? null : change / first.hospitalisations * 100 };
    }).sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity) || d3.ascending(a.road_user, b.road_user));
    const largest = changes.find(d => d.change > 0);
    document.querySelector("#q3-insight").textContent = largest
      ? `${start}–${end}: ${largest.road_user} had the largest increase among groups with complete records, +${number(largest.change)} cases (${pct(largest.percentage)}). This compares counts, not risk.`
      : `${start}–${end}: no road user group with complete records increased. Missing records cannot be compared.`;
    const complete = changes.every(d => d.change != null);
    const total = d3.sum(changes, d => d.change);
    const firstNational = national.find(d => d.year === start), lastNational = national.find(d => d.year === end);
    const nationalChange = firstNational && lastNational ? lastNational.hospitalisations - firstNational.hospitalisations : null;
    status.textContent = !complete ? "Some group-year records are absent. Their changes are unavailable and reconciliation is incomplete." : `Group changes sum to ${number(total)} cases. ${nationalChange == null ? "National comparison unavailable." : `National change: ${number(nationalChange)} cases. ${total === nationalChange ? "Totals reconcile." : "Warning: totals do not reconcile."}`}`;
    const { svg, width, height } = frame("q3", `Changes from ${start} to ${end}. Bars extend left for decreases and right for increases. All road users are retained. Missing records are labelled, not treated as zero.`, groups.length * 42 + 80);
    const limit = d3.max(changes, d => Math.abs(d.change)) || 1;
    const x = d3.scaleLinear().domain([-limit, limit]).nice().range([260, width - 85]);
    const y = d3.scaleBand().domain(changes.map(d => d.road_user)).range([30, height - 44]).padding(0.2);
    svg.selectAll("g.x-axis").data([null]).join("g").attr("class", "x-axis").attr("transform", `translate(0,${height - 40})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("+,")));
    svg.selectAll("text.axis-label").data([null]).join("text").attr("class", "axis-label").attr("x", 260).attr("y", 17).text(`Change in hospitalisation cases · ${start}–${end}`);
    svg.selectAll("text.group-label").data(changes).join("text").attr("class", "group-label").attr("x", 244).attr("y", d => y(d.road_user) + y.bandwidth() / 2).attr("dominant-baseline", "middle").attr("text-anchor", "end").text(d => d.road_user);
    svg.selectAll("line.zero").data([null]).join("line").attr("class", "zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 28).attr("y2", height - 40).attr("stroke", "#18324b");
    const bars = svg.selectAll("rect.change-bar").data(changes.filter(d => d.change != null), d => d.road_user).join("rect")
      .attr("class", "change-bar").attr("x", d => x(Math.min(0, d.change))).attr("y", d => y(d.road_user))
      .attr("width", d => Math.max(1, Math.abs(x(d.change) - x(0)))).attr("height", y.bandwidth())
      .attr("fill", d => d.change === 0 ? "transparent" : d.change < 0 ? "#d45359" : "#5aa46b");
    svg.selectAll("text.change-value").data(changes.filter(d => d.change != null), d => d.road_user).join("text").attr("class", "change-value")
      .attr("x", d => x(Math.max(0, d.change)) + 8).attr("y", d => y(d.road_user) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle").text(d => d3.format("+,")(d.change));
    interactive(bars, d => `${d.road_user} · ${start}: ${number(d.first.hospitalisations)} cases · ${end}: ${number(d.last.hospitalisations)} cases · Change: ${number(d.change)} cases (${pct(d.percentage)})`);
    svg.selectAll("text.missing").data(changes.filter(d => d.change == null)).join("text").attr("class", "missing").attr("x", x(0) + 8).attr("y", d => y(d.road_user) + y.bandwidth() / 2).text("Missing record");
    table("q3", ["Road user", `${start} cases`, `${end} cases`, "Absolute change", "Percentage change"], changes.map(d => [d.road_user, d.first ? number(d.first.hospitalisations) : "No record", d.last ? number(d.last.hospitalisations) : "No record", d.change == null ? "N/A" : number(d.change), pct(d.percentage)]), `${start}–${end}; percentage change is N/A when start cases are zero or a record is absent`);
  }

  async function init() {
    const status = document.querySelector("#trend-status");
    try {
      if (!window.d3) throw new Error("D3 unavailable; check your internet connection");
      [national, annual] = await Promise.all([d3.csv("data/q1_national_trend.csv", parse), d3.csv("data/q2_road_user_trends.csv", parse)]);
      if (!national.length || !annual.length) throw new Error("National or road user CSV contains no records");
      for (const rows of [national, annual]) {
        const keys = rows.map(d => JSON.stringify([d.year, d.road_user]));
        if (new Set(keys).size !== keys.length) throw new Error("Duplicate annual records");
        rows.sort((a, b) => a.year - b.year);
      }
      groups = [...new Set(annual.map(d => d.road_user))].sort(d3.ascending);
      years = [...new Set([...national, ...annual].map(d => d.year))].sort(d3.ascending);
      selected = new Set(defaultGroups.filter(group => groups.includes(group)));
      const labels = d3.select("#q2-groups").selectAll("label").data(groups).join("label");
      labels.attr("for", (d, i) => `road-user-${i}`);
      labels.append("input").attr("type", "checkbox").property("checked", d => selected.has(d)).attr("id", (d, i) => `road-user-${i}`).attr("value", d => d).on("change", (event, d) => { if (event.target.checked) selected.add(d); else selected.delete(d); updateRoadUserChart(); });
      labels.append("i").style("background", window.roadUserColour).attr("aria-hidden", "true");
      labels.append("span").text(d => d);
      const reset = document.querySelector("#q2-reset");
      reset.disabled = false;
      reset.addEventListener("click", () => {
        selected = new Set(defaultGroups.filter(group => groups.includes(group)));
        labels.select("input").property("checked", d => selected.has(d));
        document.querySelector("#q2-measure").value = "hospitalisations";
        updateRoadUserChart();
      });
      const comparisonYears = [...new Set(annual.map(d => d.year))].sort(d3.ascending);
      for (const [id, preferred, fallback] of [["q3-start", 2011, comparisonYears[0]], ["q3-end", 2021, comparisonYears.at(-1)]]) {
        const select = document.getElementById(id);
        d3.select(select).selectAll("option").data(comparisonYears).join("option").attr("value", d => d).text(d => d);
        select.value = comparisonYears.includes(preferred) ? preferred : fallback;
        select.disabled = false;
        select.addEventListener("change", updateChangesChart);
      }
      const measure = document.querySelector("#q2-measure");
      measure.disabled = false;
      measure.addEventListener("change", updateRoadUserChart);
      document.addEventListener("keydown", event => { if (event.key === "Escape") hide(); });
      document.addEventListener("pointerdown", event => { if (!event.target.closest(".data-point, .change-bar")) hide(); });
      window.addEventListener("scroll", hide, true);
      updateNationalChart(); updateRoadUserChart(); updateChangesChart();
      status.textContent = "National and road user data loaded. Hover, focus with Tab, or tap marks for details. Press Escape to dismiss. Scroll charts horizontally on narrow screens.";
      let width = document.querySelector("#overview").clientWidth;
      new ResizeObserver(() => {
        const next = document.querySelector("#overview").clientWidth;
        if (next !== width) { width = next; updateNationalChart(); updateRoadUserChart(); updateChangesChart(); }
      }).observe(document.querySelector("#overview"));
    } catch (error) {
      status.textContent = `Unable to load trends: ${error.message}. Serve this folder over HTTP and check the CSV files, then reload.`;
      status.setAttribute("role", "alert");
    }
  }
  init();
})();
