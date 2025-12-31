const $ = (id) => document.getElementById(id);

const SIZES = {
  "5x7": { w: 750, h: 1050 },
  "a5":  { w: 874, h: 1240 },
  "a4":  { w: 1240, h: 1754 }
};

const canvas = new fabric.Canvas("c", {
  preserveObjectStacking: true,
  selection: true
});

// --------------------
// Fonts (Google + Upload)
// --------------------
function addFontOption(name) {
  const sel = $("fontFamily");
  const exists = [...sel.options].some(o => o.value === name);
  if (exists) return;
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  sel.appendChild(opt);
}

async function waitForFont(name) {
  try { await document.fonts.load(`16px "${name}"`); } catch {}
}

function loadGoogleFont(name) {
  const clean = (name || "").trim();
  if (!clean) return;

  const id = "gf-" + clean.toLowerCase().replace(/\s+/g, "-");
  if (!document.getElementById(id)) {
    const fam = encodeURIComponent(clean).replace(/%20/g, "+");
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fam}:wght@200;300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  waitForFont(clean).then(() => {
    addFontOption(clean);
    $("fontFamily").value = clean;
  });
}

async function loadFontFromFile(file, customName) {
  if (!file) return;

  const inferredName = file.name.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, "");
  const name = (customName || inferredName || "Custom Font").trim();

  const url = URL.createObjectURL(file);
  try {
    const face = new FontFace(name, `url(${url})`);
    const loaded = await face.load();
    document.fonts.add(loaded);

    await waitForFont(name);
    addFontOption(name);
    $("fontFamily").value = name;

    canvas.requestRenderAll();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

// --------------------
// History (undo/redo)
// --------------------
let undoStack = [];
let redoStack = [];
let isRestoring = false;

function pushHistory() {
  if (isRestoring) return;
  redoStack = [];
  undoStack.push(canvas.toDatalessJSON(["animType","animSpeed","animIntensity"]));
  if (undoStack.length > 60) undoStack.shift();
}

function restoreFrom(json) {
  isRestoring = true;
  canvas.loadFromJSON(json, () => {
    canvas.renderAll();
    isRestoring = false;
  });
}

// --------------------
// Guides (safe margins)
// --------------------
let guideGroup = null;

function makeGuides() {
  const w = canvas.getWidth();
  const h = canvas.getHeight();
  const margin = 60;

  const rect = new fabric.Rect({
    left: margin,
    top: margin,
    width: w - margin * 2,
    height: h - margin * 2,
    fill: "transparent",
    stroke: "rgba(0,0,0,0.18)",
    strokeDashArray: [6, 6],
    selectable: false,
    evented: false
  });

  const centerV = new fabric.Line([w/2, margin, w/2, h-margin], {
    stroke: "rgba(0,0,0,0.10)",
    selectable: false,
    evented: false
  });

  guideGroup = new fabric.Group([rect, centerV], {
    selectable: false,
    evented: false,
    excludeFromExport: true
  });

  canvas.add(guideGroup);
  guideGroup.sendToBack();
}

function setGuidesVisible(visible) {
  if (!guideGroup) return;
  guideGroup.visible = visible;
  canvas.requestRenderAll();
}

function resetCanvasBlank() {
  isRestoring = true;

  canvas.clear();
  canvas.setBackgroundColor("#ffffff", canvas.renderAll.bind(canvas));
  makeGuides();
  setGuidesVisible($("toggleGuides").checked);

  isRestoring = false;
  pushHistory();
}

// --------------------
// Canvas size
// --------------------
function setCanvasSize(key) {
  const { w, h } = SIZES[key];
  canvas.setWidth(w);
  canvas.setHeight(h);
  canvas.renderAll();
}

// --------------------
// Selection helpers
// --------------------
function getActive() {
  return canvas.getActiveObject() || null;
}

function getActiveText() {
  const obj = getActive();
  if (!obj) return null;
  return (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") ? obj : null;
}

function syncTextControls() {
  const t = getActiveText();
  const disabled = !t;

  $("fontFamily").disabled = disabled;
  $("fontSize").disabled = disabled;
  $("fillColor").disabled = disabled;
  $("btnBold").disabled = disabled;
  $("btnItalic").disabled = disabled;

  if (t) {
    $("fontFamily").value = t.fontFamily || "Georgia";
    $("fontSize").value = Math.round(t.fontSize || 32);
    $("fillColor").value = (typeof t.fill === "string") ? t.fill : "#111111";
  }
}

function syncAnimControls() {
  const obj = getActive();
  const disabled = !obj;

  $("animType").disabled = disabled;
  $("animSpeed").disabled = disabled;
  $("animIntensity").disabled = disabled;
  $("btnApplyAnim").disabled = disabled;
  $("btnRemoveAnim").disabled = disabled;

  if (obj) {
    $("animType").value = obj.animType || "none";
    $("animSpeed").value = obj.animSpeed ?? 1.2;
    $("animIntensity").value = obj.animIntensity ?? 18;
  }
}

canvas.on("selection:created", () => { syncTextControls(); syncAnimControls(); });
canvas.on("selection:updated", () => { syncTextControls(); syncAnimControls(); });
canvas.on("selection:cleared", () => { syncTextControls(); syncAnimControls(); });

// history reliability improvements
canvas.on("object:modified", pushHistory);
canvas.on("text:editing:entered", pushHistory);
canvas.on("text:editing:exited", pushHistory);
canvas.on("text:changed", pushHistory);

// only push on object:added for real user objects (not guides)
canvas.on("object:added", (e) => {
  if (isRestoring) return;
  const obj = e.target;
  if (!obj) return;
  if (obj === guideGroup) return;
  if (obj.excludeFromExport) return;
  pushHistory();
});

// --------------------
// Add objects
// --------------------
function addText() {
  const t = new fabric.Textbox("", {
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    originX: "center",
    width: Math.min(canvas.getWidth() - 140, 900),
    textAlign: "center",
    fontFamily: $("fontFamily").value || "Georgia",
    fontSize: 36,
    fill: "#111111"
  });

  canvas.add(t);
  canvas.setActiveObject(t);
  canvas.requestRenderAll();

  setTimeout(() => {
    t.enterEditing();
    if (t.hiddenTextarea) t.hiddenTextarea.focus();
  }, 0);
}

function addRect() {
  const r = new fabric.Rect({
    left: canvas.getWidth()/2 - 120,
    top: canvas.getHeight()/2 - 80,
    width: 240,
    height: 160,
    fill: "rgba(0,0,0,0.06)",
    stroke: "rgba(0,0,0,0.25)",
    strokeWidth: 2
  });
  canvas.add(r);
  canvas.setActiveObject(r);
  canvas.requestRenderAll();
}

function addCircle() {
  const c = new fabric.Circle({
    left: canvas.getWidth()/2 - 80,
    top: canvas.getHeight()/2 - 80,
    radius: 80,
    fill: "rgba(0,0,0,0.06)",
    stroke: "rgba(0,0,0,0.25)",
    strokeWidth: 2
  });
  canvas.add(c);
  canvas.setActiveObject(c);
  canvas.requestRenderAll();
}

// --------------------
// Background handling
// --------------------
let currentBgFit = "cover";

function setBackgroundFromFile(file) {
  if (!file) return;

  const url = URL.createObjectURL(file);
  fabric.Image.fromURL(url, (img) => {
    const cw = canvas.getWidth(), ch = canvas.getHeight();

    const scaleCover = Math.max(cw / img.width, ch / img.height);
    const scaleContain = Math.min(cw / img.width, ch / img.height);
    const scale = (currentBgFit === "contain") ? scaleContain : scaleCover;

    img.scale(scale);

    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    img.set({
      left: (cw - scaledW) / 2,
      top: (ch - scaledH) / 2,
      originX: "left",
      originY: "top"
    });

    canvas.setBackgroundImage(img, () => {
      canvas.requestRenderAll();
      if (guideGroup) guideGroup.bringToFront();
      pushHistory();
    }, { crossOrigin: "anonymous" });

    URL.revokeObjectURL(url);
  }, { crossOrigin: "anonymous" });
}

function clearBackground() {
  canvas.setBackgroundImage(null, () => canvas.requestRenderAll());
  pushHistory();
}

// --------------------
// Image object upload
// --------------------
function addImageFromFile(file) {
  if (!file) return;

  const url = URL.createObjectURL(file);
  fabric.Image.fromURL(url, (img) => {
    const maxW = canvas.getWidth() * 0.6;
    const maxH = canvas.getHeight() * 0.6;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);

    img.scale(scale);
    img.set({
      left: canvas.getWidth()/2,
      top: canvas.getHeight()/2,
      originX: "center",
      originY: "center"
    });

    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();

    URL.revokeObjectURL(url);
  }, { crossOrigin: "anonymous" });
}

// --------------------
// Delete selected
// --------------------
function deleteSelected() {
  const obj = getActive();
  if (!obj) return;
  if (obj === guideGroup) return;

  if (obj.type === "activeSelection") {
    obj.forEachObject(o => canvas.remove(o));
    canvas.discardActiveObject();
  } else {
    canvas.remove(obj);
    canvas.discardActiveObject();
  }

  canvas.requestRenderAll();
  pushHistory();
}

// --------------------
// UI: buttons
// --------------------
$("btnAddText").addEventListener("click", addText);
$("btnAddRect").addEventListener("click", addRect);
$("btnAddCircle").addEventListener("click", addCircle);
$("btnDelete").addEventListener("click", deleteSelected);

// Fonts UI
$("btnLoadGoogleFont").addEventListener("click", () => {
  loadGoogleFont($("googleFontName").value);
});

$("btnAddUploadedFont").addEventListener("click", async () => {
  const file = $("fontUpload").files?.[0];
  const name = $("fontUploadName").value;
  await loadFontFromFile(file, name);
});

// --------------------
// Text styling controls
// --------------------
$("fontFamily").addEventListener("change", async (e) => {
  const t = getActiveText();
  if (!t) return;

  const fontName = e.target.value;
  await waitForFont(fontName);

  t.set("fontFamily", fontName);
  canvas.requestRenderAll();
  pushHistory();
});

$("fontSize").addEventListener("input", (e) => {
  const t = getActiveText();
  if (!t) return;
  t.set("fontSize", Number(e.target.value));
  canvas.requestRenderAll();
  pushHistory();
});

$("fillColor").addEventListener("input", (e) => {
  const t = getActiveText();
  if (!t) return;
  t.set("fill", e.target.value);
  canvas.requestRenderAll();
  pushHistory();
});

$("btnBold").addEventListener("click", () => {
  const t = getActiveText();
  if (!t) return;
  t.set("fontWeight", t.fontWeight === "bold" ? "normal" : "bold");
  canvas.requestRenderAll();
  pushHistory();
});

$("btnItalic").addEventListener("click", () => {
  const t = getActiveText();
  if (!t) return;
  t.set("fontStyle", t.fontStyle === "italic" ? "normal" : "italic");
  canvas.requestRenderAll();
  pushHistory();
});

// --------------------
// Background controls
// --------------------
$("bgFit").addEventListener("change", (e) => {
  currentBgFit = e.target.value;
});

$("bgUpload").addEventListener("change", (e) => {
  setBackgroundFromFile(e.target.files?.[0]);
});

$("btnClearBg").addEventListener("click", clearBackground);

// --------------------
// Add image control
// --------------------
$("imgUpload").addEventListener("change", (e) => {
  addImageFromFile(e.target.files?.[0]);
});

// --------------------
// Canvas controls
// --------------------
$("canvasSize").addEventListener("change", (e) => {
  setCanvasSize(e.target.value);
  resetCanvasBlank();
});

$("toggleGuides").addEventListener("change", (e) => {
  setGuidesVisible(e.target.checked);
});

$("btnClear").addEventListener("click", () => {
  resetCanvasBlank();
});

// --------------------
// Export PNG (still)
// --------------------
$("btnExport").addEventListener("click", () => {
  canvas.discardActiveObject();
  canvas.requestRenderAll();

  const dataURL = canvas.toDataURL({
    format: "png",
    multiplier: 2
  });

  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "invitation.png";
  a.click();
});

// --------------------
// Animations (preview)
// --------------------
let isPlaying = false;
let rafId = null;

function ensureAnimBase(obj) {
  if (!obj._animBase) {
    obj._animBase = {
      left: obj.left,
      top: obj.top,
      angle: obj.angle || 0,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      opacity: (typeof obj.opacity === "number") ? obj.opacity : 1
    };
  }
}

function resetAnimToBase(obj) {
  if (!obj?._animBase) return;
  obj.set({
    left: obj._animBase.left,
    top: obj._animBase.top,
    angle: obj._animBase.angle,
    scaleX: obj._animBase.scaleX,
    scaleY: obj._animBase.scaleY,
    opacity: obj._animBase.opacity
  });
  obj.setCoords();
}

function tick(now) {
  if (isPlaying) {
    const time = now / 1000;

    canvas.getObjects().forEach(obj => {
      if (obj === guideGroup) return;

      const type = obj.animType || "none";
      if (type === "none") return;

      ensureAnimBase(obj);

      const speed = Number(obj.animSpeed ?? 1.2);
      const intensity = Number(obj.animIntensity ?? 18);

      resetAnimToBase(obj);

      if (type === "float") {
        const dy = Math.sin(time * speed * 2 * Math.PI) * intensity;
        obj.top = obj._animBase.top + dy;
      } else if (type === "pulse") {
        const s = 1 + (Math.sin(time * speed * 2 * Math.PI) * (intensity / 200));
        obj.scaleX = obj._animBase.scaleX * s;
        obj.scaleY = obj._animBase.scaleY * s;
      } else if (type === "rotate") {
        obj.angle = obj._animBase.angle + (Math.sin(time * speed * 2 * Math.PI) * intensity);
      } else if (type === "fade") {
        const op = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(time * speed * 2 * Math.PI));
        obj.opacity = Math.min(1, Math.max(0.05, op));
      }

      obj.setCoords();
    });

    canvas.requestRenderAll();
  }

  rafId = requestAnimationFrame(tick);
}

function startLoop() {
  if (rafId) return;
  rafId = requestAnimationFrame(tick);
}

function setPlaying(value) {
  isPlaying = value;
  $("btnPlay").textContent = isPlaying ? "Stop" : "Play";

  if (!isPlaying) {
    canvas.getObjects().forEach(obj => {
      if (obj === guideGroup) return;
      resetAnimToBase(obj);
    });
    canvas.requestRenderAll();
  }
}

$("btnPlay").addEventListener("click", () => setPlaying(!isPlaying));

$("btnApplyAnim").addEventListener("click", () => {
  const obj = getActive();
  if (!obj || obj === guideGroup) return;

  ensureAnimBase(obj);

  obj.animType = $("animType").value;
  obj.animSpeed = Number($("animSpeed").value);
  obj.animIntensity = Number($("animIntensity").value);

  pushHistory();
  syncAnimControls();
});

$("btnRemoveAnim").addEventListener("click", () => {
  const obj = getActive();
  if (!obj || obj === guideGroup) return;

  obj.animType = "none";
  obj.animSpeed = 1.2;
  obj.animIntensity = 18;

  resetAnimToBase(obj);

  pushHistory();
  syncAnimControls();
  canvas.requestRenderAll();
});

// --------------------
// Keyboard shortcuts
// --------------------
document.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if ((e.key === "Delete" || e.key === "Backspace") && !(getActive()?.isEditing)) {
    deleteSelected();
  }

  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (undoStack.length > 1) {
      const current = undoStack.pop();
      redoStack.push(current);
      restoreFrom(undoStack[undoStack.length - 1]);
    }
  }

  if (mod && e.key.toLowerCase() === "y") {
    e.preventDefault();
    const next = redoStack.pop();
    if (next) {
      undoStack.push(next);
      restoreFrom(next);
    }
  }
});

// Copy/paste
fabric.util.addListener(document, "copy", () => {
  const obj = getActive();
  if (!obj) return;
  obj.clone((cloned) => { window.__clipboard = cloned; });
});

fabric.util.addListener(document, "paste", () => {
  const clip = window.__clipboard;
  if (!clip) return;

  clip.clone((clonedObj) => {
    canvas.discardActiveObject();

    clonedObj.set({
      left: (clonedObj.left || 0) + 20,
      top: (clonedObj.top || 0) + 20,
      evented: true
    });

    if (clonedObj.type === "activeSelection") {
      clonedObj.canvas = canvas;
      clonedObj.forEachObject((o) => canvas.add(o));
      clonedObj.setCoords();
    } else {
      canvas.add(clonedObj);
    }

    canvas.setActiveObject(clonedObj);
    canvas.requestRenderAll();
    pushHistory();
  });
});

// --------------------
// Init
// --------------------
["Georgia", "Times New Roman", "Garamond", "Arial", "Courier New"].forEach(addFontOption);
$("fontFamily").value = "Georgia";

setCanvasSize("5x7");
resetCanvasBlank();
startLoop();
syncTextControls();
syncAnimControls();
