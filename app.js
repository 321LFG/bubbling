const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");

maskCanvas.width = canvas.width;
maskCanvas.height = canvas.height;

const imageInput = document.getElementById("imageInput");
const maskColorInput = document.getElementById("maskColor");
const radiusInput = document.getElementById("bubbleRadius");
const radiusOutput = document.getElementById("radiusOutput");
const resetButton = document.getElementById("resetButton");
const emptyState = document.getElementById("emptyState");

const MASK_ALPHA = 1;

const state = {
  image: null,
  bubbles: [],
  radius: Number(radiusInput.value),
  maskColor: maskColorInput.value,
  preview: null,
  isPointerDown: false,
  lastPaintPoint: null,
  imageDraw: {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  },
};

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function fitImageToCanvas(image) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = canvas.width / canvas.height;

  let width = canvas.width;
  let height = canvas.height;

  if (imageRatio > canvasRatio) {
    height = width / imageRatio;
  } else {
    width = height * imageRatio;
  }

  state.imageDraw = {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
  };
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function addBubble(point) {
  state.bubbles.push({
    x: point.x,
    y: point.y,
    radius: state.radius,
  });
}

function shouldPaintAt(point) {
  if (!state.lastPaintPoint) {
    return true;
  }

  const dx = point.x - state.lastPaintPoint.x;
  const dy = point.y - state.lastPaintPoint.y;
  const distance = Math.hypot(dx, dy);

  return distance >= Math.max(6, state.radius * 0.35);
}

function renderEmptyCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#eef2f4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderPreview() {
  if (!state.preview || !state.image) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(state.preview.x, state.preview.y, state.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.stroke();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!state.image) {
    renderEmptyCanvas();
    emptyState.classList.remove("is-hidden");
    return;
  }

  emptyState.classList.add("is-hidden");

  const draw = state.imageDraw;
  ctx.drawImage(state.image, draw.x, draw.y, draw.width, draw.height);

  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskCtx.fillStyle = hexToRgba(state.maskColor, MASK_ALPHA);
  maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

  maskCtx.save();
  maskCtx.globalCompositeOperation = "destination-out";
  for (const bubble of state.bubbles) {
    maskCtx.beginPath();
    maskCtx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    maskCtx.fill();
  }
  maskCtx.restore();

  ctx.drawImage(maskCanvas, 0, 0);

  renderPreview();
}

function loadImage(file) {
  if (!file) {
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    state.image = image;
    state.bubbles = [];
    state.preview = null;
    fitImageToCanvas(image);
    render();
  };

  image.src = objectUrl;
}

function handlePointerDown(event) {
  if (!state.image) {
    return;
  }

  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);

  const point = getPointerPosition(event);
  state.isPointerDown = true;
  state.preview = point;
  addBubble(point);
  state.lastPaintPoint = point;
  render();
}

function handlePointerMove(event) {
  const point = getPointerPosition(event);
  state.preview = point;

  if (state.image && state.isPointerDown && shouldPaintAt(point)) {
    addBubble(point);
    state.lastPaintPoint = point;
  }

  render();
}

function handlePointerUp(event) {
  state.isPointerDown = false;
  state.lastPaintPoint = null;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

function handlePointerLeave() {
  if (state.isPointerDown) {
    return;
  }

  state.preview = null;
  render();
}

function resetEditor() {
  state.image = null;
  state.bubbles = [];
  state.preview = null;
  state.isPointerDown = false;
  state.lastPaintPoint = null;
  imageInput.value = "";
  render();
}

imageInput.addEventListener("change", (event) => {
  loadImage(event.target.files[0]);
});

maskColorInput.addEventListener("input", (event) => {
  state.maskColor = event.target.value;
  render();
});

radiusInput.addEventListener("input", (event) => {
  state.radius = Number(event.target.value);
  radiusOutput.value = `${state.radius}px`;
  render();
});

resetButton.addEventListener("click", resetEditor);

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("pointerleave", handlePointerLeave);

render();
