let extractedText = "";

// OCR Processing
async function processFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) {
    alert("Please upload an image or PDF first!");
    return;
  }

  document.getElementById("resultsBody").innerHTML =
    `<tr><td colspan="5" style="text-align:center;">⏳ Processing... please wait</td></tr>`;

  // OCR with Tesseract.js
  const { data } = await Tesseract.recognize(file, "eng");
  extractedText = data.text.trim();

  if (!extractedText) {
    document.getElementById("resultsBody").innerHTML =
      `<tr><td colspan="5" style="text-align:center;">⚠️ No text found!</td></tr>`;
    return;
  }

  // Example layout (simulate categories/notes into rows)
  const rows = [
    ["Room Cleanliness", "Desks are clean", "5", "25%", "Auto-detected notes"],
    ["Area Cleanliness", "Hallways clean", "4", "20%", "Auto-detected notes"],
    ["Waste Segregation", "Bins sorted", "3", "15%", "Auto-detected notes"],
    ["Discipline", "Behavior/Notes", "-", "-", extractedText]
  ];

  let html = "";
  rows.forEach(r => {
    html += `<tr>
      <td>${r[0]}</td>
      <td>${r[1]}</td>
      <td>${r[2]}</td>
      <td>${r[3]}</td>
      <td>${r[4]}</td>
    </tr>`;
  });

  document.getElementById("resultsBody").innerHTML = html;
}

// Export to Excel
function exportExcel() {
  if (!extractedText) {
    alert("No text extracted yet!");
    return;
  }

  const section = document.getElementById("section").value;
  const day = document.getElementById("day").value;

  const ws_data = [
    ["Section", section],
    ["Day", day],
    [],
    ["Category", "Criteria", "Score (1-5)", "% Equivalent", "Notes"],
    ["Room Cleanliness", "Desks are clean", "5", "25%", "Auto-detected notes"],
    ["Area Cleanliness", "Hallways clean", "4", "20%", "Auto-detected notes"],
    ["Waste Segregation", "Bins sorted", "3", "15%", "Auto-detected notes"],
    ["Discipline", "Behavior/Notes", "-", "-", extractedText]
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ScanResult");

  XLSX.writeFile(wb, `Scan_${section}_Day${day}.xlsx`);
}

// 🎵 Mute/Unmute Music
function toggleMute() {
  const audio = document.getElementById("bg-music");
  const btn = document.getElementById("muteBtn");

  if (audio.muted) {
    audio.muted = false;
    btn.textContent = "🔊 Mute";
    audio.play();
  } else {
    audio.muted = true;
    btn.textContent = "🔇 Unmute";
  }
}

// Allow audio to play after first click
document.addEventListener("click", () => {
  const audio = document.getElementById("bg-music");
  if (audio.paused) {
    audio.play();
  }
}, { once: true });
