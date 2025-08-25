let extractedText = "";

async function processFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) {
    alert("Please upload an image or PDF first!");
    return;
  }

  document.getElementById("output").innerText = "⏳ Processing... please wait";

  // OCR with Tesseract.js
  const { data } = await Tesseract.recognize(file, "eng");
  extractedText = data.text.trim();

  document.getElementById("output").innerText = extractedText || "⚠️ No text found!";
}

function exportExcel() {
  if (!extractedText) {
    alert("No text extracted yet!");
    return;
  }

  const section = document.getElementById("section").value;
  const day = document.getElementById("day").value;

  // Prepare data
  const ws_data = [
    ["Section", section],
    ["Day", day],
    ["Extracted Notes"],
    [extractedText]
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ScanResult");

  // Download Excel
  XLSX.writeFile(wb, `Scan_${section}_Day${day}.xlsx`);
}
