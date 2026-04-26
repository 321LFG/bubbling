const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");

const imageInput = document.getElementById("imageInput");
const maskColorInput = document.getElementById("maskColor");
const radiusInput = document.getElementById("bubbleRadius");
const radiusOutput = document.getElementById("radiusOutput");
const resetButton = document.getElementById("resetButton");
const emptyState = document.getElementById("emptyState");

const MASK_ALPHA = 1;
const MAX_PIXEL_RATIO = 3;

const state = {
  image: null,
  bubbles: [],
  radius: Number(radiusInput.value),
  maskColor: maskColorInput.value,
  canvasWidth: canvas.width,
  canvasHeight: canvas.height,
  pixelRatio: 1,
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

let renderFrameId = null;

function requestRender() {
  if (renderFrameId !== null) {
    return;
  }

  renderFrameId = window.requestAnimationFrame(() => {
    renderFrameId = null;
    render();
  });
}

function getCanvasSize() {
  return {
    width: state.canvasWidth,
    height: state.canvasHeight,
  };
}

function resizeCanvasToDisplaySize() {
  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return false;
  }

  const previousWidth = state.canvasWidth;
  const previousHeight = state.canvasHeight;
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const bitmapWidth = Math.round(width * pixelRatio);
  const bitmapHeight = Math.round(height * pixelRatio);
  const sizeChanged = width !== previousWidth || height !== previousHeight;
  const bitmapChanged = canvas.width !== bitmapWidth || canvas.height !== bitmapHeight;

  if (!bitmapChanged && state.pixelRatio === pixelRatio) {
    return false;
  }

  state.canvasWidth = width;
  state.canvasHeight = height;
  state.pixelRatio = pixelRatio;

  canvas.width = bitmapWidth;
  canvas.height = bitmapHeight;
  maskCanvas.width = bitmapWidth;
  maskCanvas.height = bitmapHeight;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  maskCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  maskCtx.imageSmoothingEnabled = true;
  maskCtx.imageSmoothingQuality = "high";

  if (sizeChanged && previousWidth && previousHeight) {
    const scaleX = width / previousWidth;
    const scaleY = height / previousHeight;

    for (const bubble of state.bubbles) {
      bubble.x *= scaleX;
      bubble.y *= scaleY;
      bubble.radius *= (scaleX + scaleY) / 2;
    }

    if (state.preview) {
      state.preview.x *= scaleX;
      state.preview.y *= scaleY;
    }

    if (state.lastPaintPoint) {
      state.lastPaintPoint.x *= scaleX;
      state.lastPaintPoint.y *= scaleY;
    }
  }

  if (state.image) {
    fitImageToCanvas(state.image);
  }

  return true;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function fitImageToCanvas(image) {
  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let width = canvasWidth;
  let height = canvasHeight;

  if (imageRatio > canvasRatio) {
    height = width / imageRatio;
  } else {
    width = height * imageRatio;
  }

  state.imageDraw = {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  };
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = state.canvasWidth / rect.width;
  const scaleY = state.canvasHeight / rect.height;

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
  const { width, height } = getCanvasSize();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#eef2f4";
  ctx.fillRect(0, 0, width, height);
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
  resizeCanvasToDisplaySize();

  const { width, height } = getCanvasSize();
  ctx.clearRect(0, 0, width, height);

  if (!state.image) {
    renderEmptyCanvas();
    emptyState.classList.remove("is-hidden");
    return;
  }

  emptyState.classList.add("is-hidden");

  const draw = state.imageDraw;
  ctx.drawImage(state.image, draw.x, draw.y, draw.width, draw.height);

  maskCtx.clearRect(0, 0, width, height);
  maskCtx.fillStyle = hexToRgba(state.maskColor, MASK_ALPHA);
  maskCtx.fillRect(0, 0, width, height);

  maskCtx.save();
  maskCtx.globalCompositeOperation = "destination-out";
  for (const bubble of state.bubbles) {
    maskCtx.beginPath();
    maskCtx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    maskCtx.fill();
  }
  maskCtx.restore();

  ctx.drawImage(maskCanvas, 0, 0, width, height);

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
    requestRender();
  };

  image.src = objectUrl;
}

function openImagePicker() {
  imageInput.click();
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
  requestRender();
}

function handlePointerMove(event) {
  const point = getPointerPosition(event);
  state.preview = point;

  if (state.image && state.isPointerDown && shouldPaintAt(point)) {
    addBubble(point);
    state.lastPaintPoint = point;
  }

  requestRender();
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
  requestRender();
}

function resetEditor() {
  state.image = null;
  state.bubbles = [];
  state.preview = null;
  state.isPointerDown = false;
  state.lastPaintPoint = null;
  imageInput.value = "";
  requestRender();
}

imageInput.addEventListener("change", (event) => {
  loadImage(event.target.files[0]);
});

emptyState.addEventListener("click", openImagePicker);

maskColorInput.addEventListener("input", (event) => {
  state.maskColor = event.target.value;
  requestRender();
});

radiusInput.addEventListener("input", (event) => {
  state.radius = Number(event.target.value);
  radiusOutput.value = `${state.radius}px`;
  requestRender();
});

resetButton.addEventListener("click", resetEditor);

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("pointerleave", handlePointerLeave);
window.addEventListener("resize", requestRender);

render();
