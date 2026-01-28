/**************** GLOBAL STATE ****************/
let extractedText = "";
let comparisonData = { OLD: {}, NEW: {} };
let EXPORT = null;

/**************** MUSIC ****************/
function toggleMute() {
  const audio = document.getElementById("bg-music");
  const btn = document.getElementById("muteBtn");
  if (!audio) return;

  audio.muted = !audio.muted;
  btn.textContent = audio.muted ? "🔇 Unmute" : "🔊 Mute";

  if (!audio.muted) {
    audio.play().catch(()=>{});
  }
}

/**************** EYE LOCK ****************/
function toggleEye() {
  const i = document.getElementById("evaluator");
  i.type = i.type === "password" ? "text" : "password";
}

/**************** HELPERS ****************/
const scoreToPercent = s => s * 5;
const mean = arr => arr.reduce((a,b)=>a+b,0) / (arr.length || 1);
const nowDate = () => new Date().toLocaleDateString();
const nowTime = () => new Date().toLocaleTimeString();
const randScore = () => Math.floor(Math.random() * 2) + 4;
const randPick = arr => arr[Math.floor(Math.random() * arr.length)];

/**************** CHECKMARK (PHOTO SAFE) ****************/
function hasCheckmark(line) {
  return /✓|✔|☑|√|\[x\]|\bx\b|\bv\b/i.test(line);
}

/**************** CRITERIA ****************/
const OLD = {
  "Room Cleanliness": [
    "Desks are clean and organized",
    "Floor is clean",
    "Windows are clean",
    "Board is clean",
    "Comfort room is clean",
    "Tools are stored properly"
  ],
  "Area Cleanliness": [
    "Pathways are clean",
    "Hallways are clean",
    "Trash bins not overflowing",
    "Plants maintained",
    "Exterior clean"
  ],
  "Waste Segregation": [
    "Bins available",
    "Waste sorted",
    "Bins emptied"
  ]
};

const NEW = {
  "Room Cleanliness": [
    "Floor polished",
    "Furniture organized",
    "Walls clean",
    "Fans dust-free",
    "Comfort room odor-free"
  ],
  "Area Cleanliness": [
    "Front area clean",
    "Back area clean",
    "Walkways unobstructed",
    "Plants maintained",
    "Planters clean"
  ],
  "Waste Management": [
    "Labeled bins",
    "Bins with lids",
    "Proper segregation",
    "Segregation maintained",
    "Disposed on schedule"
  ],
  "Discipline and Orderliness": [
    "Students participate",
    "Students cooperate",
    "Materials returned",
    "Cleaning on time",
    "No distractions"
  ]
};

/**************** TOOL DETECTION ****************/
function detectTool(text) {
  const t = text.toLowerCase();
  return t.includes("discipline") || t.includes("orderliness")
    ? "NEW"
    : "OLD";
}

/**************** AUTO SCORE ****************/
function autoScore(text, criterion, tool) {
  if (tool === "NEW") {
    const lines = text.split(/\r?\n+/);
    const found = lines.find(l =>
      l.toLowerCase().includes(criterion.toLowerCase().slice(0, 12))
    );

    if (found && hasCheckmark(found)) return 5;
    return 1;
  }

  // OLD TOOL (text-based fallback)
  if (/excellent|very clean/i.test(text)) return 5;
  if (/good|clean/i.test(text)) return 4;
  if (/fair/i.test(text)) return 3;
  if (/poor|dirty/i.test(text)) return 2;
  return 4;
}

/**************** OCR PROCESS ****************/
async function processFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Please upload an image.");

  document.getElementById("resultsBody").innerHTML =
    `<tr><td colspan="6">⏳ Processing…</td></tr>`;

  const { data } = await Tesseract.recognize(file, "eng");
  extractedText = data.text || "";
  buildFromText(extractedText, false);
}

/**************** TEST MODE ****************/
function runTest() {
  const samples = [
    "✓ Floor polished\n✓ Furniture organized\nWalls clean\n✓ Fans dust-free\nDiscipline",
    "x Pathways are clean\nPlants maintained\nWaste segregation\nDiscipline",
    "Clean classroom\nGood discipline\nStudents cooperate"
  ];
  buildFromText(randPick(samples), true);
}

/**************** CORE BUILDER ****************/
function buildFromText(text, isTest) {
  const tool = detectTool(text);
  const DEF = tool === "NEW" ? NEW : OLD;

  const section = document.getElementById("section").value || "N/A";
  const day = document.getElementById("day").value || "N/A";
  const evaluator = document.getElementById("evaluator").value || "Hidden";

  let html = "";
  let stats = [];
  comparisonData[tool] = {};

  Object.entries(DEF).forEach(([cat, items]) => {
    let percents = [];

    items.forEach(c => {
      const score = isTest ? randScore() : autoScore(text, c, tool);
      const pct = scoreToPercent(score);
      percents.push(pct);

      html += `
        <tr>
          <td>${tool}</td>
          <td>${cat}</td>
          <td>${c}</td>
          <td>${score}</td>
          <td>${pct}%</td>
          <td>${isTest ? "TEST DATA" : ""}</td>
        </tr>`;
    });

    const m = mean(percents);
    comparisonData[tool][cat] = m;

    html += `
      <tr class="avg-row">
        <td colspan="6"><b>${cat} Mean:</b> ${m.toFixed(2)}%</td>
      </tr>`;

    stats.push([section, day, tool, cat, m.toFixed(2)]);
  });

  document.getElementById("resultsBody").innerHTML = html;
  drawChart();
  buildExport(section, day, evaluator, tool, stats, isTest);
}

/**************** CHART ****************/
function drawChart() {
  const ctx = document.getElementById("comparisonChart");
  if (!ctx) return;

  if (window.chart) window.chart.destroy();

  const labels = Array.from(new Set([
    ...Object.keys(comparisonData.OLD || {}),
    ...Object.keys(comparisonData.NEW || {})
  ]));

  window.chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "OLD", data: labels.map(l => comparisonData.OLD[l] || 0) },
        { label: "NEW", data: labels.map(l => comparisonData.NEW[l] || 0) }
      ]
    }
  });
}

/**************** EXPORT ****************/
function buildExport(section, day, evaluator, tool, stats, isTest) {
  EXPORT = {
    meta: [
      ["Section", section],
      ["Day", day],
      ["Evaluator", evaluator],
      ["Tool", tool],
      ["Date", nowDate()],
      ["Time", nowTime()],
      ["Mode", isTest ? "TEST" : "LIVE"]
    ],
    stats
  };
}

function exportExcel() {
  if (!EXPORT) return alert("Nothing to export yet.");

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(EXPORT.meta),
    "Metadata"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Section","Day","Tool","Category","Mean %"],
      ...EXPORT.stats
    ]),
    "Statistical_View"
  );

  XLSX.writeFile(wb, "3Cs_Evaluation.xlsx");
}

/**************** EXPOSE ****************/
window.processFile = processFile;
window.exportExcel = exportExcel;
window.toggleMute = toggleMute;
window.toggleEye = toggleEye;
window.runTest = runTest;
