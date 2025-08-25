let extractedText = "";

/* ========= MUSIC: keep working exactly like before ========= */
function toggleMute() {
  const audio = document.getElementById("bg-music");
  const btn = document.getElementById("muteBtn");
  if (!audio) return;

  if (audio.muted) {
    audio.muted = false;
    btn.textContent = "🔊 Mute";
    audio.play().catch(() => {/* ignore */});
  } else {
    audio.muted = true;
    btn.textContent = "🔇 Unmute";
  }
}

// ensure audio starts after first user gesture (browser policy)
document.addEventListener("click", () => {
  const audio = document.getElementById("bg-music");
  if (audio && audio.paused) {
    audio.play().catch(() => {/* ignore */});
  }
}, { once: true });
/* ========================================================== */

/* ===== helpers for scoring/formatting ===== */
const scoreToPercent = (s) => Math.max(1, Math.min(5, Number(s) || 1)) * 5;
const avg = (arr) => arr.reduce((a,b)=>a+b,0) / (arr.length || 1);

/* ====== main fixed criteria (scores here are the example you gave) ======
   You can change the numbers (1–5) below per scan if needed; the % is computed.
*/
const CRITERIA_DEF = {
  "Room Cleanliness": [
    ["Desks are clean and organized", 5],
    ["Classroom floor is clean and free of trash", 5],
    ["Windows are properly cleaned", 5],
    ["Whiteboard/blackboard is clean after use", 5],
    ["Comfort room is clean and maintained", 2],
    ["Cleaning tools are stored properly", 5],
  ],
  "Area Cleanliness": [
    ["Pathways to classroom are free of litter", 5],
    ["Hallways and corridors are clean", 5],
    ["Outdoor trash bins are not overflowing", 5],
    ["Plants and outdoor areas are maintained", 5],
    ["Classroom exterior is clean", 5],
  ],
  "Waste Segregation": [
    ["Separate bins for recyclable, biodegradable, non-biodegradable", 5],
    ["Waste is sorted into correct bins", 5],
    ["Trash bins are emptied regularly", 5],
  ],
};

/* build a fast list of phrases so we don't leak criteria into notes */
const CRITERIA_PHRASES = Object.values(CRITERIA_DEF)
  .flat()
  .map(([name]) => name.toLowerCase());

/* ===== OCR + layout ===== */
async function processFile() {
  const file = document.getElementById("fileInput").files[0];
  const tbody = document.getElementById("resultsBody");
  if (!file) { alert("Please upload an image or PDF first!"); return; }

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">⏳ Processing... please wait</td></tr>`;

  // OCR
  const { data } = await Tesseract.recognize(file, "eng");
  extractedText = (data.text || "").trim();

  // Prepare fixed rows using the criteria + computed % equivalents
  const categoryRows = {};
  const categoryAverages = {};

  Object.entries(CRITERIA_DEF).forEach(([cat, rows]) => {
    const computed = rows.map(([crit, score]) => {
      const pct = scoreToPercent(score); // 1->5%, 2->10%, 3->15%, 4->20%, 5->25%
      return { cat, crit, score, pct };
    });
    categoryRows[cat] = computed;
    categoryAverages[cat] = avg(computed.map(r => r.pct));
  });

  // overall avg of room/area/waste (in % out of 25)
  const rawOverall = avg([
    categoryAverages["Room Cleanliness"],
    categoryAverages["Area Cleanliness"],
    categoryAverages["Waste Segregation"]
  ]);

  // Discipline auto-calc: only 20% or 25%. Map from the overall average.
  // If overall >= 22.5 -> 25% (score 5), else -> 20% (score 4)
  const disciplineScore = rawOverall >= 22.5 ? 5 : 4;
  const disciplinePercent = scoreToPercent(disciplineScore); // 20 or 25

  // Extract ONLY the officer notes (Tagalog/English), no criteria/percents/etc.
  const notes = (extractedText || "")
    .split(/\r?\n+/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    // must contain letters (keeps Tagalog/English)
    .filter(l => /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/.test(l))
    // drop numeric/percent/structured lines
    .filter(l => !/[0-9%]/.test(l))
    // drop meta words that look like headings
    .filter(l => !/(criteria|average|score|percent|section|category|room|area|waste|discipline)/i.test(l))
    // drop anything that looks like our criteria phrases
    .filter(l => !CRITERIA_PHRASES.some(p => l.toLowerCase().includes(p)))
    // de-duplicate
    .filter((v, i, a) => a.indexOf(v) === i)
    // limit to a few important notes
    .slice(0, 6)
    .join("; ");

  // render table
  let html = "";
  ["Room Cleanliness", "Area Cleanliness", "Waste Segregation"].forEach(cat => {
    categoryRows[cat].forEach(row => {
      html += `<tr>
        <td>${row.cat}</td>
        <td>${row.crit}</td>
        <td>${row.score}</td>
        <td>${row.pct}%</td>
        <td></td>
      </tr>`;
    });
    html += `<tr class="avg-row">
      <td colspan="5" style="text-align:center;font-weight:700;">Average %: ${categoryAverages[cat].toFixed(1)}%</td>
    </tr>`;
  });

  // Discipline row (notes go here only)
  html += `<tr>
    <td>Discipline</td>
    <td>Discipline (auto-calculated from Room/Area/Waste averages)</td>
    <td>${disciplineScore}</td>
    <td>${disciplinePercent}%</td>
    <td>${notes || ""}</td>
  </tr>
  <tr class="avg-row">
    <td colspan="5" style="text-align:center;font-weight:700;">Average %: ${disciplinePercent.toFixed(1)}%</td>
  </tr>`;

  document.getElementById("resultsBody").innerHTML = html;
}

/* ===== Excel export: exports exactly what is displayed ===== */
function exportExcel() {
  const section = document.getElementById("section").value || "";
  const day = document.getElementById("day").value || "";
  const table = document.getElementById("resultsTable");

  if (!table || table.tBodies[0].rows.length === 0) {
    alert("Nothing to export yet. Process a file first.");
    return;
  }

  const rows = [];
  // header
  const thead = table.tHead.rows[0];
  rows.push(Array.from(thead.cells).map(c => c.innerText));

  // body
  for (const r of table.tBodies[0].rows) {
    rows.push(Array.from(r.cells).map(c => c.innerText));
  }

  // add section/day on top as metadata
  const meta = [
    ["Section", section],
    ["Day", day],
    []
  ];

  const ws = XLSX.utils.aoa_to_sheet([...meta, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ScanResult");
  XLSX.writeFile(wb, `Scan_${section || "Section"}_Day${day || "X"}.xlsx`);
}

/* expose functions used by HTML buttons if needed (optional) */
window.processFile = processFile;
window.exportExcel = exportExcel;
window.toggleMute = toggleMute;
