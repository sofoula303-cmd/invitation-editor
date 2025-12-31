// --- Helpers ---
const $ = (id) => document.getElementById(id);

const SIZES = {
  "5x7": { w: 750, h: 1050 }, // ~150dpi preview
  "a5":  { w: 874, h: 1240 }  // ~150dpi preview
};

let undoStack = [];
let redoStack = [];

function pushHistory(canvas) {
  redoStack = [];
  const json = canvas.toDatalessJSON(["selectable", "evented"]);
  undoStack.push(json);
  if (undoStack.length > 50) undoStack.shift();
}

function restoreFrom(canvas, json) {
  canvas.loadFromJSON(json, () => {
    canvas.renderAll();
  });
}

// --- Canvas setup ---
const canvas = new fabric.Canvas("c", {
  preserveObjectStacking: true
});

function setCanvasSize(key) {
  const { w, h } = SIZES[key];
  canvas.setWidth(w);
  canvas.setHeight(h);
  canvas.renderAll();
}

function resetTemplate() {
  canvas.clear();
  canvas.setBackgroundColor("#ffffff", canvas.renderAll.bind(canvas));

  const title = new fabric.Textbox("SOFIA & STELIOS", {
    left: canvas.getWidth() / 2,
    top: 180,
    originX: "center",
    width: canvas.getWidth() - 140,
    textAlign: "center",
    fontFamily: "Garamond",
    fontSize: 56,
    fill: "#111111",
    charSpacing: 60
  });

  const subtitle = new fabric.Textbox("We joyfully invite you to our wedding", {
    left: canvas.getWidth() / 2,
    top: 270,
    originX: "center",
    width: canvas.getWidth() - 180,
    textAlign: "center",
    fontFamily: "Georgia",
    fontSize: 22,
    fill: "#333333"
  });

  const line = new fabric.Line([120, 360, canvas.getWidth() - 120, 360], {
    stroke: "#222222",
    strokeWidth: 1,
    selectable: true
  });

  const details = new fabric.Textbox(
`Friday, 4 July 2026 • 20:30
Holy Church of Fragkavilla, Amaliada

Reception
La Villa Events, Savalia Ilia`,
    {
      left: canvas.getWidth() / 2,
      top: 420,
      originX: "center",
      width: canvas.getWidth() - 200,
      textAlign: "center",
      fontFamily: "Times New Roman",
      fontSize: 22,
      lineHeight: 1.4,
      fill: "#111111"
    }
  );

  const footer = new fabric.Textbox("RSVP • +30 69X XXX XXXX", {
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() - 170,
    originX: "center",
    width: canvas.getWidth() - 200,
    textAlign: "center",
    fontFamily: "Georgia",
    fontSize: 18,
    fill: "#333333"
  });

  canvas.add(title, subtitle, line, details, footer);
  canvas.setActiveObject(title);
  canvas.renderAll();
  pushHistory(canvas);
}

setCanvasSize("5x7");
resetTemplate();

// --- Selection helpers ---
function getActiveText() {
  const obj = canvas.getActiveObject();
  if (!obj) return null;
  if (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") return obj;
  return null;
}

function syncControlsFromSelection() {
  const t = getActiveText();
  $("fontFamily").disabled = !t;
  $("fontSize").disabled = !t;
  $("fillColor").disabled = !t;

  if (t) {
    $("fontFamily").value = t.fontFamily || "Times New Roman";
    $("fontSize").value = Math.round(t.fontSize || 32);
    $("fillColor").value = (t.fill && typeof t.fill === "string") ? t.fill : "#111111";
  }
}

canvas.on("selection:created", syncControlsFromSelection);
canvas.on("selection:updated", syncControlsFromSelection);
canvas.on("selection:cleared", syncControlsFromSelection);

canvas.on("object:modified", () => pushHistory(canvas));
canvas.on("object:added", () => { /* avoid double pushes during load */ });
canvas.on("text:changed", () => pushHistory(canvas));

// --- UI actions ---
$("canvasSize").addEventListener("change", (e) => {
  setCanvasSize(e.target.value);
  resetTemplate();
});

$("btnReset").addEventListener("click", resetTemplate);

$("btnAddText").addEventListener("click", () => {
  const t = new fabric.Textbox("Double-click to edit", {
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    originX: "center",
    width: canvas.getWidth() - 200,
    textAlign: "center",
    fontFamily: "Georgia",
    fontSize: 28,
    fill: "#111111"
  });
  canvas.add(t);
  canvas.setActiveObject(t);
  canvas.renderAll();
  pushHistory(canvas);
});

$("btnAddLine").addEventListener("click", () => {
  const y = canvas.getHeight() / 2;
  const line = new fabric.Line([140, y, canvas.getWidth() - 140, y], {
    stroke: "#222222",
    strokeWidth: 1
  });
  canvas.add(line);
  canvas.setActiveObject(line);
  canvas.renderAll();
  pushHistory(canvas);
});

$("fontFamily").addEventListener("change", (e) => {
  const t = getActiveText();
  if (!t) return;
  t.set("fontFamily", e.target.value);
  canvas.requestRenderAll();
  pushHistory(canvas);
});

$("fontSize").addEventListener("input", (e) => {
  const t = getActiveText();
  if (!t) return;
  t.set("fontSize", Number(e.target.value));
  canvas.requestRenderAll();
  pushHistory(canvas);
});

$("fillColor").addEventListener("input", (e) => {
  const t = getActiveText();
  if (!t) return;
  t.set("fill", e.target.value);
  canvas.requestRenderAll();
  pushHistory(canvas);
});

$("btnBold").addEventListener("click", () => {
  const t = getActiveText();
  if (!t) return;
  t.set("fontWeight", t.fontWeight === "bold" ? "normal" : "bold");
  canvas.requestRenderAll();
  pushHistory(canvas);
});

$("btnItalic").addEventListener("click", () => {
  const t = getActiveText();
  if (!t) return;
  t.set("fontStyle", t.fontStyle === "italic" ? "normal" : "italic");
  canvas.requestRenderAll();
  pushHistory(canvas);
});

function deleteSelected() {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  canvas.remove(obj);
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  pushHistory(canvas);
}

$("btnDelete").addEventListener("click", deleteSelected);

$("bgUpload").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  fabric.Image.fromURL(url, (img) => {
    // scale background to cover canvas
    const cw = canvas.getWidth(), ch = canvas.getHeight();
    const scale = Math.max(cw / img.width, ch / img.height);
    img.scale(scale);

    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
      originX: "left",
      originY: "top"
    });

    pushHistory(canvas);
    URL.revokeObjectURL(url);
  }, { crossOrigin: "anonymous" });
});

$("btnClearBg").addEventListener("click", () => {
  canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
  pushHistory(canvas);
});

$("btnExport").addEventListener("click", () => {
  canvas.discardActiveObject();
  canvas.renderAll();

  const dataURL = canvas.toDataURL({
    format: "png",
    multiplier: 2 // higher resolution export
  });

  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "wedding-invitation.png";
  a.click();
});

// --- Keyboard shortcuts ---
document.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (e.key === "Delete" || e.key === "Backspace") {
    // avoid deleting while typing in textbox edit mode
    const active = canvas.getActiveObject();
    if (active && active.isEditing) return;
    deleteSelected();
  }

  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (undoStack.length > 1) {
      const current = undoStack.pop();
      redoStack.push(current);
      const prev = undoStack[undoStack.length - 1];
      restoreFrom(canvas, prev);
    }
  }

  if (mod && e.key.toLowerCase() === "y") {
    e.preventDefault();
    const next = redoStack.pop();
    if (next) {
      undoStack.push(next);
      restoreFrom(canvas, next);
    }
  }
});

// Enable copy/paste
fabric.util.addListener(document, "copy", (e) => {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  obj.clone((cloned) => {
    window.__clipboard = cloned;
  });
});

fabric.util.addListener(document, "paste", (e) => {
  const clip = window.__clipboard;
  if (!clip) return;
  clip.clone((clonedObj) => {
    canvas.discardActiveObject();
    clonedObj.set({ left: (clonedObj.left || 0) + 20, top: (clonedObj.top || 0) + 20, evented: true });
    if (clonedObj.type === "activeSelection") {
      clonedObj.canvas = canvas;
      clonedObj.forEachObject((obj) => canvas.add(obj));
      clonedObj.setCoords();
    } else {
      canvas.add(clonedObj);
    }
    canvas.setActiveObject(clonedObj);
    canvas.requestRenderAll();
    pushHistory(canvas);
  });
});
