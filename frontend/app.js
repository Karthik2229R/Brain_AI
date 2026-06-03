/* ═════════════════════════════════════════════════════════
   BRAIN TUMOR AI DIAGNOSTIC SYSTEM — APP.JS
   Multi-page SPA: Upload → Results → History
═════════════════════════════════════════════════════════ */

const API_BASE = "http://127.0.0.1:8000";
const STORAGE_KEY = "brain_tumor_history";

/* ────────── STATE ────────── */
let currentFile = null;
let currentResult = null;  // active result being viewed

/* ────────── DOM REFS ────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* Nav */
const navLinks       = $$(".nav-link");
const statusDot      = $("#statusDot");
const statusLabel    = $("#statusLabel");
const historyCount   = $("#historyCount");

/* Upload page */
const dropZone       = $("#dropZone");
const fileInput      = $("#fileInput");
const browseBtn      = $("#browseBtn");
const fileRow        = $("#fileRow");
const fileName       = $("#fileName");
const fileSize       = $("#fileSize");
const removeFile     = $("#removeFile");
const predictBtn     = $("#predictBtn");
const predictLabel   = $("#predictLabel");
const previewImg     = $("#previewImg");
const previewPlaceholder = $("#previewPlaceholder");
const previewDesc    = $("#previewDesc");
const previewInfo    = $("#previewInfo");
const imgDim         = $("#imgDim");
const imgFormat      = $("#imgFormat");
const imgSize        = $("#imgSize");

/* Loading */
const loadingOverlay = $("#loadingOverlay");

/* Results page */
const predBadge      = $("#predBadge");
const predSubtitle   = $("#predSubtitle");
const confBar        = $("#confBar");
const uncBar         = $("#uncBar");
const confVal        = $("#confVal");
const uncVal         = $("#uncVal");
const classList      = $("#classList");
const metricsGrid    = $("#metricsGrid");
const resultFileName = $("#resultFileName");
const resultTimestamp = $("#resultTimestamp");
const visOriginal    = $("#visOriginal");
const visGradcam     = $("#visGradcam");
const visSeg         = $("#visSeg");
const panelGradcam   = $("#panelGradcam");
const panelSeg       = $("#panelSeg");
const visCard        = $("#visCard");
const metricsCard    = $("#metricsCard");

/* Toggles */
const togGradcam     = $("#togGradcam");
const togSeg         = $("#togSeg");
const togMetrics     = $("#togMetrics");

/* History */
const historyGrid    = $("#historyGrid");

/* ═══════════════════════════════════════════════════════
   ROUTING — Hash-based SPA
═══════════════════════════════════════════════════════ */
function navigateTo(page) {
  // Hide all pages
  $$(".page").forEach(p => p.classList.remove("active"));
  // Show target
  const target = $(`#page-${page}`);
  if (target) target.classList.add("active");

  // Update nav
  navLinks.forEach(l => {
    l.classList.toggle("active", l.dataset.page === page);
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.addEventListener("hashchange", () => {
  const hash = location.hash.replace("#", "") || "upload";
  navigateTo(hash);
  if (hash === "history") renderHistory();
});

// Initial route
document.addEventListener("DOMContentLoaded", () => {
  const hash = location.hash.replace("#", "") || "upload";
  navigateTo(hash);
  updateHistoryCount();
});

/* ═══════════════════════════════════════════════════════
   API STATUS
═══════════════════════════════════════════════════════ */
async function checkAPI() {
  try {
    const r = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      statusDot.className = "status-dot online";
      statusLabel.textContent = "Online";
    } else throw 0;
  } catch {
    statusDot.className = "status-dot offline";
    statusLabel.textContent = "Offline";
  }
}
checkAPI();
setInterval(checkAPI, 12000);

/* ═══════════════════════════════════════════════════════
   FILE UPLOAD
═══════════════════════════════════════════════════════ */
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
dropZone.addEventListener("click", e => {
  if (e.target !== browseBtn && !browseBtn.contains(e.target)) fileInput.click();
});
browseBtn.addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
removeFile.addEventListener("click", clearFile);

function handleFile(f) {
  if (!f.type.match(/image\/(png|jpeg|jpg)/)) {
    alert("Please upload a PNG or JPG image."); return;
  }
  currentFile = f;
  fileName.textContent = f.name;
  fileSize.textContent = fmtSize(f.size);
  fileRow.style.display = "flex";
  predictBtn.disabled = false;

  const reader = new FileReader();
  reader.onload = ev => {
    previewImg.src = ev.target.result;
    previewImg.style.display = "block";
    previewPlaceholder.style.display = "none";
    previewDesc.textContent = f.name;
    previewInfo.style.display = "flex";
    imgFormat.textContent = f.type.split("/")[1].toUpperCase();
    imgSize.textContent = fmtSize(f.size);
    previewImg.onload = () => {
      imgDim.textContent = `${previewImg.naturalWidth}×${previewImg.naturalHeight}`;
    };
  };
  reader.readAsDataURL(f);
}

function clearFile() {
  currentFile = null; fileInput.value = "";
  fileRow.style.display = "none";
  predictBtn.disabled = true;
  previewImg.src = ""; previewImg.style.display = "none";
  previewPlaceholder.style.display = "flex";
  previewDesc.textContent = "No image loaded";
  previewInfo.style.display = "none";
}

function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/* ═══════════════════════════════════════════════════════
   LOADING STEPS
═══════════════════════════════════════════════════════ */
const LSTEPS = ["ls1","ls2","ls3","ls4","ls5","ls6"];
let stepTimer;

function startSteps() {
  LSTEPS.forEach(id => {
    document.getElementById(id).className = "lstep";
  });
  document.getElementById(LSTEPS[0]).classList.add("active");
  let i = 0;
  stepTimer = setInterval(() => {
    document.getElementById(LSTEPS[i]).classList.remove("active");
    document.getElementById(LSTEPS[i]).classList.add("done");
    i++;
    if (i < LSTEPS.length) document.getElementById(LSTEPS[i]).classList.add("active");
    else clearInterval(stepTimer);
  }, 700);
}

function finishSteps() {
  clearInterval(stepTimer);
  LSTEPS.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove("active"); el.classList.add("done");
  });
}

/* ═══════════════════════════════════════════════════════
   PREDICT & ANALYZE
═══════════════════════════════════════════════════════ */
predictBtn.addEventListener("click", runAnalysis);

async function runAnalysis() {
  if (!currentFile) return;
  predictBtn.disabled = true;
  loadingOverlay.style.display = "flex";
  startSteps();

  const form = new FormData();
  form.append("file", currentFile);

  let data;
  try {
    const r = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
    if (!r.ok) throw new Error(`Server error ${r.status}`);
    data = await r.json();
  } catch (err) {
    finishSteps();
    loadingOverlay.style.display = "none";
    predictBtn.disabled = false;
    alert(`Analysis failed: ${err.message}\n\nEnsure the backend is running:\n  cd backend\n  python -m uvicorn main:app --reload`);
    return;
  }

  // Complete loading animation
  finishSteps();
  await sleep(500);
  loadingOverlay.style.display = "none";
  predictBtn.disabled = false;

  // Add metadata
  data._filename = currentFile.name;
  data._timestamp = new Date().toISOString();
  data._thumb = previewImg.src;

  // Store as current result
  currentResult = data;

  // Save to history
  saveToHistory(data);

  // Navigate to results page
  location.hash = "#results";
  setTimeout(() => displayResult(data), 100);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ═══════════════════════════════════════════════════════
   DISPLAY RESULT
═══════════════════════════════════════════════════════ */
function displayResult(data) {
  const cls = data.classification;
  const met = data.metrics;
  const isTumor = cls.predicted_class !== "No Tumor";

  // File info
  resultFileName.textContent = data._filename;
  resultTimestamp.textContent = new Date(data._timestamp).toLocaleString();

  // Prediction badge
  predBadge.textContent = cls.predicted_class;
  predBadge.className = "pred-badge " + (isTumor ? "tumor" : "no-tumor");
  predSubtitle.textContent = isTumor
    ? `Tumor detected · Class ${cls.class_index} · MC Dropout uncertainty applied`
    : "No tumor detected · Healthy scan";

  // Confidence bars (animate after small delay)
  confBar.style.width = "0"; uncBar.style.width = "0";
  setTimeout(() => {
    confBar.style.width = `${cls.confidence}%`;
    uncBar.style.width = `${Math.min(cls.uncertainty * 5, 100)}%`;
  }, 200);
  confVal.textContent = `${cls.confidence}%`;
  uncVal.textContent = `${cls.uncertainty}%`;

  // Class probabilities
  classList.innerHTML = "";
  Object.entries(cls.all_scores).forEach(([name, pct]) => {
    const isWinner = name === cls.predicted_class;
    classList.innerHTML += `
      <div class="cl-item ${isWinner ? "winner" : ""}">
        <div class="cl-top">
          <span class="cl-name">${name}</span>
          <span class="cl-pct">${pct.toFixed(1)}%</span>
        </div>
        <div class="cl-track"><div class="cl-fill" data-w="${pct}%"></div></div>
      </div>`;
  });
  setTimeout(() => {
    $$(".cl-fill").forEach(b => { b.style.width = b.dataset.w; });
  }, 350);

  // Visualization images
  visOriginal.src = `data:image/png;base64,${data.original_image}`;
  visGradcam.src  = `data:image/png;base64,${data.gradcam_image}`;
  visSeg.src      = `data:image/png;base64,${data.segmentation_mask}`;

  // Metrics
  const M_CFG = [
    { key: "accuracy",   label: "Accuracy",   color: "#00d4ff" },
    { key: "precision",  label: "Precision",  color: "#4fc3f7" },
    { key: "recall",     label: "Recall",     color: "#10b981" },
    { key: "f1_score",   label: "F1 Score",   color: "#a78bfa" },
    { key: "dice_score", label: "Dice Score", color: "#f59e0b" },
    { key: "iou_score",  label: "IoU Score",  color: "#f87171" },
  ];
  metricsGrid.innerHTML = "";
  M_CFG.forEach(cfg => {
    const v = (met[cfg.key] * 100).toFixed(1);
    metricsGrid.innerHTML += `
      <div class="m-card" style="--mc:${cfg.color}">
        <div class="m-name">${cfg.label}</div>
        <div class="m-val">${v}<span class="m-pct">%</span></div>
        <div class="m-bar"><div class="m-bar-fill" data-w="${v}%"></div></div>
      </div>`;
  });
  setTimeout(() => {
    $$(".m-bar-fill").forEach(b => { b.style.width = b.dataset.w; });
  }, 450);

  // Apply toggle state
  applyToggles();

  // Reveal animation for cards
  $$("#page-results .card, #page-results .vis-card").forEach((el, i) => {
    el.style.opacity = "0"; el.style.transform = "translateY(14px)";
    setTimeout(() => {
      el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      el.style.opacity = "1"; el.style.transform = "translateY(0)";
    }, i * 80);
  });
}

/* ═══════════════════════════════════════════════════════
   TOGGLES
═══════════════════════════════════════════════════════ */
togGradcam.addEventListener("change", applyToggles);
togSeg.addEventListener("change", applyToggles);
togMetrics.addEventListener("change", applyToggles);

function applyToggles() {
  panelGradcam.style.display = togGradcam.checked ? "" : "none";
  panelSeg.style.display = togSeg.checked ? "" : "none";
  metricsCard.style.display = togMetrics.checked ? "" : "none";
}

/* ═══════════════════════════════════════════════════════
   HISTORY — localStorage Persistence
═══════════════════════════════════════════════════════ */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveToHistory(data) {
  const history = getHistory();
  // Store a compact version (with images for revisit)
  history.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    filename: data._filename,
    timestamp: data._timestamp,
    thumb: data._thumb,
    classification: data.classification,
    metrics: data.metrics,
    original_image: data.original_image,
    gradcam_image: data.gradcam_image,
    segmentation_mask: data.segmentation_mask,
  });
  // Keep last 30
  if (history.length > 30) history.length = 30;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    // If storage is full, remove oldest items
    history.length = Math.min(history.length, 10);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch {}
  }
  updateHistoryCount();
}

function updateHistoryCount() {
  const count = getHistory().length;
  if (count > 0) {
    historyCount.textContent = count;
    historyCount.style.display = "inline";
  } else {
    historyCount.style.display = "none";
  }
}

function renderHistory() {
  const history = getHistory();
  historyGrid.innerHTML = "";

  if (history.length === 0) {
    historyGrid.innerHTML = `
      <div class="history-empty" id="historyEmpty">
        <div class="empty-icon">📋</div>
        <h3>No predictions yet</h3>
        <p>Upload an MRI scan and run analysis to build your prediction history.</p>
        <a href="#upload" class="btn btn-outline">Upload MRI Scan</a>
      </div>`;
    return;
  }

  history.forEach((item, idx) => {
    const isTumor = item.classification.predicted_class !== "No Tumor";
    const time = new Date(item.timestamp).toLocaleString();
    const card = document.createElement("div");
    card.className = "h-card";
    card.style.animationDelay = `${idx * 50}ms`;
    card.innerHTML = `
      <img class="h-thumb" src="${item.thumb}" alt="MRI" />
      <div class="h-body">
        <div class="h-filename">${item.filename}</div>
        <div class="h-time">${time}</div>
        <div class="h-row">
          <span class="h-class-tag ${isTumor ? "" : "safe"}">${item.classification.predicted_class}</span>
          <span class="h-conf">${item.classification.confidence}%</span>
          <span class="h-view">Click to view →</span>
        </div>
      </div>`;
    card.addEventListener("click", () => loadHistoryItem(item));
    historyGrid.appendChild(card);
  });
}

function loadHistoryItem(item) {
  // Reconstruct a full result object
  const data = {
    classification: item.classification,
    metrics: item.metrics,
    original_image: item.original_image,
    gradcam_image: item.gradcam_image,
    segmentation_mask: item.segmentation_mask,
    _filename: item.filename,
    _timestamp: item.timestamp,
    _thumb: item.thumb,
  };
  currentResult = data;
  location.hash = "#results";
  setTimeout(() => displayResult(data), 100);
}

/* Clear history */
$("#clearAllHistory").addEventListener("click", () => {
  if (confirm("Clear all prediction history?")) {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    updateHistoryCount();
  }
});

/* ═══════════════════════════════════════════════════════
   NEW SCAN BUTTON
═══════════════════════════════════════════════════════ */
$("#btnNewScan").addEventListener("click", () => {
  location.hash = "#upload";
});

/* ═══════════════════════════════════════════════════════
   PDF REPORT
═══════════════════════════════════════════════════════ */
$("#btnDownloadPDF").addEventListener("click", () => {
  if (!currentResult) { alert("No results to generate report from."); return; }
  const cls = currentResult.classification;
  const met = currentResult.metrics;
  const isTumor = cls.predicted_class !== "No Tumor";

  const metricsRows = [
    ["Accuracy",   (met.accuracy   * 100).toFixed(1) + "%"],
    ["Precision",  (met.precision  * 100).toFixed(1) + "%"],
    ["Recall",     (met.recall     * 100).toFixed(1) + "%"],
    ["F1 Score",   (met.f1_score   * 100).toFixed(1) + "%"],
    ["Dice Score", (met.dice_score * 100).toFixed(1) + "%"],
    ["IoU Score",  (met.iou_score  * 100).toFixed(1) + "%"],
  ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

  const scoresRows = Object.entries(cls.all_scores)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v.toFixed(1)}%</td></tr>`).join("");

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Brain Tumor AI Report — ${currentResult._filename}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  body { font-family:'Inter',sans-serif; color:#1a1a2e; padding:40px 48px; max-width:820px; margin:0 auto; }
  h1 { color:#0055cc; border-bottom:3px solid #00b4d8; padding-bottom:14px; font-size:1.6rem; }
  h2 { color:#0055cc; margin-top:32px; font-size:1.1rem; }
  .badge { display:inline-block; padding:8px 20px; border-radius:10px; font-weight:700; font-size:1.15rem; }
  .badge-danger { background:#ffe0e0; color:#cc0000; border:1px solid #ffb0b0; }
  .badge-safe   { background:#d4fce4; color:#005c20; border:1px solid #a0e8b0; }
  .section { background:#f5f9ff; border:1px solid #d0e0f4; border-radius:10px; padding:18px 22px; margin-top:16px; }
  table { border-collapse:collapse; width:100%; margin-top:14px; }
  td, th { border:1px solid #dde; padding:10px 16px; text-align:left; font-size:0.9rem; }
  th { background:#eef4ff; color:#0055cc; font-weight:600; }
  .images { display:flex; gap:16px; margin-top:14px; flex-wrap:wrap; }
  .images img { width:200px; border-radius:10px; border:1px solid #dde; }
  .images .cap { font-size:0.75rem; color:#888; margin-top:4px; text-align:center; }
  .footer { margin-top:48px; font-size:0.78rem; color:#999; border-top:1px solid #dde; padding-top:14px; line-height:1.6; }
  .meta { display:flex; gap:24px; font-size:0.85rem; color:#555; margin-top:8px; }
</style></head><body>
<h1>🧠 Brain Tumor AI — Diagnostic Report</h1>
<div class="meta">
  <span><strong>File:</strong> ${currentResult._filename}</span>
  <span><strong>Date:</strong> ${new Date(currentResult._timestamp).toLocaleString()}</span>
</div>
<h2>Classification Result</h2>
<div class="section">
  <p>Predicted Class: <span class="badge ${isTumor ? "badge-danger" : "badge-safe"}">${cls.predicted_class}</span></p>
  <p style="margin-top:10px"><strong>Confidence Score:</strong> ${cls.confidence}%</p>
  <p><strong>MC Dropout Uncertainty:</strong> ${cls.uncertainty}%</p>
</div>
<h2>Class Probabilities</h2>
<table><tr><th>Class</th><th>Probability</th></tr>${scoresRows}</table>
<h2>Visual Analysis</h2>
<div class="images">
  <div><img src="data:image/png;base64,${currentResult.original_image}" /><div class="cap">Original MRI</div></div>
  <div><img src="data:image/png;base64,${currentResult.gradcam_image}" /><div class="cap">Grad-CAM Heatmap</div></div>
  <div><img src="data:image/png;base64,${currentResult.segmentation_mask}" /><div class="cap">Segmentation Mask</div></div>
</div>
<h2>Evaluation Metrics</h2>
<table><tr><th>Metric</th><th>Value</th></tr>${metricsRows}</table>
<div class="footer">
  Brain Tumor AI Diagnostic System · Explainable Deep Learning Framework<br/>
  ResNet-50 Classification · U-Net Segmentation · MC Dropout Uncertainty · Grad-CAM XAI<br/><br/>
  ⚠️ This report is AI-generated and intended for research/demonstration purposes only. Not for clinical diagnosis.
</div>
<script>setTimeout(()=>window.print(),500);<\/script>
</body></html>`);
  w.document.close();
});
