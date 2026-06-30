import * as THREE from 'three';
import {
  canvasContext2d,
  crosshair,
  fullscreenToggle,
  hud,
  overlay,
  photoPopup,
  photoPopupCanvas,
  photoPopupClose,
  photoPopupDesc,
  photoPopupTitle,
  touchControls,
  touchMove,
  touchStick,
} from './dom';
import { frameMeshes, occluderMeshes } from './gallery';
import {
  PRESENTATION_CUE_SELECTED_EVENT,
  resolvePresentationFrameData,
} from './presentationFrameData';
import { camera, renderer } from './scene';
import type { FrameUserData } from './types';

// ============ FIRST PERSON CONTROLS ============
export const PHOTO_CLOSED_EVENT = 'club-intro:photo-closed';
export const moveState = {f:false,b:false,l:false,r:false};
export const touchMoveState = {x:0,z:0};
export let yaw = Math.PI;
export let pitch = 0.08;
let isLocked = false;
let hasEntered = false;
export const direction = new THREE.Vector3();
export const speed = 5;
const PITCH_LIMIT = Math.PI / 2.5;
const TOUCH_MOVE_RADIUS = 46;
const TOUCH_MOVE_HIT_SLOP = 28;
const TOUCH_LOOK_SENSITIVITY = 0.0045;
const TOUCH_TAP_MOVE_LIMIT = 8;
const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
const touchNavigationAvailable =
  hasCoarsePointer || (!hasFinePointer && navigator.maxTouchPoints > 0);
const pointerTouchEventsAvailable = 'PointerEvent' in window;

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

renderer.domElement.tabIndex = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampPitch(): void {
  pitch = clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
}

function rotateView(deltaX: number, deltaY: number, sensitivity: number): void {
  yaw -= deltaX * sensitivity;
  pitch -= deltaY * sensitivity;
  clampPitch();
}

export function setViewAngles(nextYaw: number, nextPitch: number): void {
  yaw = nextYaw;
  pitch = nextPitch;
  clampPitch();
}

export function hasEnteredGallery(): boolean {
  return hasEntered;
}

function requestPointerLockSafe(): void {
  if (touchNavigationAvailable) return;
  if (!renderer.domElement.requestPointerLock) return;
  try {
    const result = renderer.domElement.requestPointerLock();
    if (result && 'catch' in result) result.catch(() => {});
  } catch(e) {}
}

function fullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

function updateFullscreenButton(): void {
  const isFullscreen = !!fullscreenElement();
  fullscreenToggle.classList.toggle('active', isFullscreen);
  fullscreenToggle.setAttribute(
    'aria-label',
    isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
  );
  fullscreenToggle.title = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
}

async function toggleFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  const root = document.documentElement as FullscreenElement;
  try {
    if (fullscreenElement()) {
      const exit = document.exitFullscreen?.bind(document) || doc.webkitExitFullscreen?.bind(doc);
      await exit?.();
    } else {
      const request = root.requestFullscreen?.bind(root) || root.webkitRequestFullscreen?.bind(root);
      await request?.();
    }
  } catch(e) {
    // Fullscreen can be rejected by the browser outside a direct user gesture.
  } finally {
    updateFullscreenButton();
  }
}

fullscreenToggle.addEventListener('pointerdown', e => {
  e.stopPropagation();
});
fullscreenToggle.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  void toggleFullscreen();
});
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);

function enterGallery(): void {
  hasEntered = true;
  overlay.classList.add('hidden');
  hud.classList.add('show');
  if (touchNavigationAvailable) {
    clearTouchMovePositionOverride();
    touchControls.classList.add('show');
  }
  renderer.domElement.focus();
  requestPointerLockSafe();
}

overlay.addEventListener('click', e => {
  e.stopPropagation();
  enterGallery();
});

document.addEventListener('keydown', e => {
  if (hasEntered) return;
  if (e.code !== 'Space' && e.key !== 'Enter') return;
  e.preventDefault();
  e.stopPropagation();
  enterGallery();
});

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  if (!isLocked) crosshair.classList.remove('hit');
});

let mouseDown = false;
let lastMX = 0, lastMY = 0;
document.addEventListener('mousedown', e => { if(e.button===0) { mouseDown = true; lastMX = e.clientX; lastMY = e.clientY; }});
document.addEventListener('mouseup', e => { if(e.button===0) mouseDown = false; });
document.addEventListener('mousemove', e => {
  if (isLocked) {
    rotateView(e.movementX, e.movementY, 0.002);
  } else if (mouseDown) {
    rotateView(e.clientX - lastMX, e.clientY - lastMY, 0.004);
    lastMX = e.clientX; lastMY = e.clientY;
  }
});

let movePointerId: number | null = null;
let lookPointerId: number | null = null;
let moveOriginX = 0;
let moveOriginY = 0;
let lastLookX = 0;
let lastLookY = 0;
let lookStartX = 0;
let lookStartY = 0;
let lookMoved = false;
let suppressTouchClickUntil = 0;
let touchFallbackActive = false;

function syncTouchActiveClass(): void {
  const hasTouchInput = movePointerId !== null || lookPointerId !== null;
  touchControls.classList.toggle('active', hasTouchInput);
  if (!hasTouchInput) touchFallbackActive = false;
}

function clearTouchMovePositionOverride(): void {
  touchMove.style.removeProperty('left');
  touchMove.style.removeProperty('top');
  touchMove.style.removeProperty('bottom');
}

function capturePointer(e: PointerEvent): void {
  if (!(e.target instanceof Element) || !e.target.setPointerCapture) return;
  try {
    e.target.setPointerCapture(e.pointerId);
  } catch(e) {}
}

function updateTouchMove(clientX: number, clientY: number): void {
  const dx = clientX - moveOriginX;
  const dy = clientY - moveOriginY;
  const length = Math.hypot(dx, dy);
  const scale = length > TOUCH_MOVE_RADIUS ? TOUCH_MOVE_RADIUS / length : 1;
  const stickX = dx * scale;
  const stickY = dy * scale;

  touchMoveState.x = Math.abs(stickX) < 3 ? 0 : stickX / TOUCH_MOVE_RADIUS;
  touchMoveState.z = Math.abs(stickY) < 3 ? 0 : stickY / TOUCH_MOVE_RADIUS;
  touchStick.style.transform =
    `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
}

function resetTouchMove(): void {
  movePointerId = null;
  touchMoveState.x = 0;
  touchMoveState.z = 0;
  touchStick.style.transform = '';
  clearTouchMovePositionOverride();
  touchMove.classList.remove('active');
  syncTouchActiveClass();
}

function resetTouchLook(): void {
  lookPointerId = null;
  lookMoved = false;
  syncTouchActiveClass();
}

function resetTouchInput(): void {
  resetTouchMove();
  resetTouchLook();
}

function startTouchMoveAt(id: number, clientX: number, clientY: number): void {
  suppressTouchClickUntil = performance.now() + 350;
  movePointerId = id;
  const joystickRect = touchMove.getBoundingClientRect();
  moveOriginX = joystickRect.left + joystickRect.width / 2;
  moveOriginY = joystickRect.top + joystickRect.height / 2;
  touchMove.classList.add('active');
  syncTouchActiveClass();
  updateTouchMove(clientX, clientY);
}

function isMoveTouchStart(clientX: number, clientY: number): boolean {
  const rect = touchMove.getBoundingClientRect();
  return (
    clientX >= rect.left - TOUCH_MOVE_HIT_SLOP &&
    clientX <= rect.right + TOUCH_MOVE_HIT_SLOP &&
    clientY >= rect.top - TOUCH_MOVE_HIT_SLOP &&
    clientY <= rect.bottom + TOUCH_MOVE_HIT_SLOP
  );
}

function startTouchMove(e: PointerEvent): void {
  e.preventDefault();
  e.stopPropagation();
  startTouchMoveAt(e.pointerId, e.clientX, e.clientY);
  capturePointer(e);
}

function startTouchLookAt(id: number, clientX: number, clientY: number): void {
  lookPointerId = id;
  lastLookX = clientX;
  lastLookY = clientY;
  lookStartX = clientX;
  lookStartY = clientY;
  lookMoved = false;
  syncTouchActiveClass();
}

function startTouchLook(e: PointerEvent): void {
  e.preventDefault();
  startTouchLookAt(e.pointerId, e.clientX, e.clientY);
  capturePointer(e);
}

function finishTouchLook(allowTap: boolean): void {
  suppressTouchClickUntil = performance.now() + 350;
  const shouldOpenFrame = allowTap && !lookMoved && !showingPhoto;
  resetTouchLook();
  if (!shouldOpenFrame) {
    return;
  }

  const visibleFrame = getVisibleFrameHit();
  if (visibleFrame) {
    openResolvedFrameData(visibleFrame.userData as FrameUserData);
  }
}

document.addEventListener('pointerdown', e => {
  if (!touchNavigationAvailable || e.pointerType === 'mouse' || !hasEntered || showingPhoto) return;
  if (e.target instanceof Node && photoPopup.contains(e.target)) return;

  if (isMoveTouchStart(e.clientX, e.clientY)) {
    if (movePointerId === null) startTouchMove(e);
  } else if (lookPointerId === null) {
    startTouchLook(e);
  }
}, {passive:false});

document.addEventListener('pointermove', e => {
  if (e.pointerId === movePointerId) {
    e.preventDefault();
    updateTouchMove(e.clientX, e.clientY);
  } else if (e.pointerId === lookPointerId) {
    e.preventDefault();
    rotateView(e.clientX - lastLookX, e.clientY - lastLookY, TOUCH_LOOK_SENSITIVITY);
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    if (Math.hypot(e.clientX - lookStartX, e.clientY - lookStartY) > TOUCH_TAP_MOVE_LIMIT) {
      lookMoved = true;
    }
  }
}, {passive:false});

document.addEventListener('pointerup', e => {
  if (e.pointerId === movePointerId) {
    e.preventDefault();
    suppressTouchClickUntil = performance.now() + 350;
    resetTouchMove();
  } else if (e.pointerId === lookPointerId) {
    e.preventDefault();
    finishTouchLook(true);
  }
}, {passive:false});

document.addEventListener('pointercancel', e => {
  if (e.pointerId === movePointerId) {
    resetTouchMove();
  } else if (e.pointerId === lookPointerId) {
    finishTouchLook(false);
  }
});

function shouldHandleTouchEvent(e: TouchEvent): boolean {
  if (pointerTouchEventsAvailable) return false;
  if (!touchNavigationAvailable || !hasEntered || showingPhoto) return false;
  if (!touchFallbackActive && (movePointerId !== null || lookPointerId !== null)) return false;
  if (e.target instanceof Node && photoPopup.contains(e.target)) return false;
  return true;
}

document.addEventListener('touchstart', e => {
  if (!shouldHandleTouchEvent(e)) return;

  let handled = false;
  for (const touch of Array.from(e.changedTouches)) {
    if (isMoveTouchStart(touch.clientX, touch.clientY)) {
      if (movePointerId !== null) continue;
      touchFallbackActive = true;
      startTouchMoveAt(touch.identifier, touch.clientX, touch.clientY);
      handled = true;
    } else {
      if (lookPointerId !== null) continue;
      touchFallbackActive = true;
      startTouchLookAt(touch.identifier, touch.clientX, touch.clientY);
      handled = true;
    }
  }

  if (handled) {
    e.preventDefault();
    e.stopPropagation();
  }
}, {passive:false});

document.addEventListener('touchmove', e => {
  if (!touchFallbackActive) return;

  let handled = false;
  for (const touch of Array.from(e.changedTouches)) {
    if (touch.identifier === movePointerId) {
      updateTouchMove(touch.clientX, touch.clientY);
      handled = true;
    } else if (touch.identifier === lookPointerId) {
      rotateView(touch.clientX - lastLookX, touch.clientY - lastLookY, TOUCH_LOOK_SENSITIVITY);
      lastLookX = touch.clientX;
      lastLookY = touch.clientY;
      if (Math.hypot(touch.clientX - lookStartX, touch.clientY - lookStartY) > TOUCH_TAP_MOVE_LIMIT) {
        lookMoved = true;
      }
      handled = true;
    }
  }

  if (handled) e.preventDefault();
}, {passive:false});

document.addEventListener('touchend', e => {
  if (!touchFallbackActive) return;

  let handled = false;
  for (const touch of Array.from(e.changedTouches)) {
    if (touch.identifier === movePointerId) {
      suppressTouchClickUntil = performance.now() + 350;
      resetTouchMove();
      handled = true;
    } else if (touch.identifier === lookPointerId) {
      finishTouchLook(true);
      handled = true;
    }
  }

  if (handled) e.preventDefault();
}, {passive:false});

document.addEventListener('touchcancel', e => {
  if (!touchFallbackActive) return;

  for (const touch of Array.from(e.changedTouches)) {
    if (touch.identifier === movePointerId) {
      resetTouchMove();
    } else if (touch.identifier === lookPointerId) {
      finishTouchLook(false);
    }
  }
});

type MoveFlag = keyof typeof moveState;

function moveFlagForKey(e: KeyboardEvent): MoveFlag | null {
  const key = e.key.toLowerCase();
  if (e.code === 'KeyW' || key === 'w') return 'f';
  if (e.code === 'KeyS' || key === 's') return 'b';
  if (e.code === 'KeyA' || key === 'a' || key === 'arrowleft') return 'l';
  if (e.code === 'KeyD' || key === 'd' || key === 'arrowright') return 'r';
  return null;
}

document.addEventListener('keydown', e => {
  const flag = moveFlagForKey(e);
  if (!flag) return;
  moveState[flag] = true;
  e.preventDefault();
});
document.addEventListener('keyup', e => {
  const flag = moveFlagForKey(e);
  if (!flag) return;
  moveState[flag] = false;
});
window.addEventListener('blur', () => {
  moveState.f = false;
  moveState.b = false;
  moveState.l = false;
  moveState.r = false;
  resetTouchInput();
});

renderer.domElement.tabIndex = 0;
renderer.domElement.addEventListener('click', e => {
  renderer.domElement.focus();
  if (hasEntered && !touchNavigationAvailable && !isLocked && !showingPhoto) {
    e.stopPropagation();
    requestPointerLockSafe();
  }
});

// ============ RAYCASTING (click frames) ============
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2(0, 0);
const OCCLUSION_EPSILON = 0.08;
let showingPhoto = false;

document.addEventListener('click', e => {
  if (performance.now() < suppressTouchClickUntil) return;
  if (photoPopup.contains(e.target as Node)) return;
  if (showingPhoto || !hasEntered) return;
  if (!isLocked && !touchNavigationAvailable) return;
  const visibleFrame = getVisibleFrameHit();
  if (visibleFrame) {
    openResolvedFrameData(visibleFrame.userData as FrameUserData);
  }
});

export function updateCrosshair(): void {
  if (!hasEntered || showingPhoto) return;
  if (!isLocked && !touchNavigationAvailable) return;
  crosshair.classList.toggle('hit', !!getVisibleFrameHit());
}

function getVisibleFrameHit(): THREE.Object3D | null {
  raycaster.setFromCamera(mouseNDC, camera);
  const blockerHits = raycaster.intersectObjects(occluderMeshes, false);
  const nearestBlocker = blockerHits[0]?.distance ?? Infinity;
  const frameHits = raycaster.intersectObjects(frameMeshes, true);

  for (const hit of frameHits) {
    if (nearestBlocker < hit.distance - OCCLUSION_EPSILON) continue;

    let obj: THREE.Object3D | null = hit.object;
    while (obj && !obj.userData.title) obj = obj.parent;
    if (obj?.userData.title) return obj;
  }

  return null;
}

let popupRenderToken = 0;

function openResolvedFrameData(data: FrameUserData): void {
  const resolved = resolvePresentationFrameData(data);
  openFrameData(resolved.data);
  if (resolved.cueIndex === null) return;

  window.dispatchEvent(new CustomEvent(PRESENTATION_CUE_SELECTED_EVENT, {
    detail: {cueIndex: resolved.cueIndex},
  }));
}

function drawPopupBackground(ctx: CanvasRenderingContext2D, data: FrameUserData, w: number, h: number): void {
  const hue = data.h ?? 200;
  const sat = data.s ?? 55;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue},${sat * .56}%,12%)`);
  g.addColorStop(.54, '#071014');
  g.addColorStop(1, '#020506');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,.045)';
  ctx.lineWidth = 1;
  for (let x = 40; x < w; x += 84) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 120, h);
    ctx.stroke();
  }

  if (data.accent) {
    ctx.fillStyle = data.accent;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(0, 0, 10, h);
    ctx.globalAlpha = 1;
  }
}

function drawPopupWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((ln, i) => {
    ctx.fillText(i === maxLines - 1 && lines.length > maxLines ? `${ln}...` : ln, x, y + i * lineHeight);
  });
  return y + Math.min(lines.length, maxLines) * lineHeight;
}

function drawTimelinePopup(ctx: CanvasRenderingContext2D, data: FrameUserData): void {
  const w = photoPopupCanvas.width;
  const h = photoPopupCanvas.height;
  drawPopupBackground(ctx, data, w, h);

  const entries = [
    { year: '2014', label: 'Shenzhen Airline\nCorporate Club', x: w * 0.2, y: h * 0.64 },
    { year: '2016', label: 'Public Club', x: w * 0.5, y: h * 0.46 },
    { year: '2024', label: '100% English\nSpeaking Club', x: w * 0.8, y: h * 0.62 },
  ];

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 56px sans-serif';
  ctx.fillText(data.title, w / 2, 118);

  ctx.fillStyle = 'rgba(245,240,232,.76)';
  ctx.font = '700 28px sans-serif';
  drawPopupWrappedText(ctx, data.desc, w / 2, 176, w - 230, 38, 2);

  ctx.strokeStyle = data.accent || '#ff8a2a';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(entries[0].x, h * 0.59);
  ctx.bezierCurveTo(w * 0.34, h * 0.36, w * 0.59, h * 0.72, entries[2].x, h * 0.52);
  ctx.stroke();

  entries.forEach((entry, index) => {
    const boxW = index === 1 ? 230 : 245;
    const boxH = index === 1 ? 118 : 136;
    ctx.fillStyle = index === 1 ? 'rgba(151,86,184,.94)' : 'rgba(8,12,14,.88)';
    ctx.fillRect(entry.x - boxW / 2, entry.y - boxH / 2, boxW, boxH);
    ctx.strokeStyle = index === 1 ? 'rgba(245,234,212,.5)' : (data.accent || '#ff8a2a');
    ctx.lineWidth = 3;
    ctx.strokeRect(entry.x - boxW / 2, entry.y - boxH / 2, boxW, boxH);

    ctx.fillStyle = index === 2 ? '#fff45a' : '#ff9d36';
    ctx.font = '900 48px sans-serif';
    ctx.fillText(entry.year, entry.x, entry.y - 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 24px sans-serif';
    entry.label.split('\n').forEach((line, lineIndex) => {
      ctx.fillText(line, entry.x, entry.y + 20 + lineIndex * 28);
    });
  });

  ctx.fillStyle = 'rgba(245,240,232,.7)';
  ctx.font = '800 25px sans-serif';
  ctx.fillText("Bao'an English-speaking Club", w / 2, h - 90);
}

function drawPopupFallback(ctx: CanvasRenderingContext2D, data: FrameUserData): void {
  const w = photoPopupCanvas.width;
  const h = photoPopupCanvas.height;
  drawPopupBackground(ctx, data, w, h);

  if (data.kind === 'timeline') {
    drawTimelinePopup(ctx, data);
    return;
  }

  if (data.kind === 'qr') {
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.fillRect(96, 128, 260, 260);
    ctx.fillRect(w - 356, 128, 260, 260);
    ctx.fillStyle = '#061015';
    for (let row = 0; row < 21; row++) {
      for (let col = 0; col < 21; col++) {
        const finder =
          (row < 6 && col < 6) ||
          (row < 6 && col > 14) ||
          (row > 14 && col < 6);
        if (!finder && (row * 11 + col * 7 + row * col) % 4 > 1) continue;
        const cell = 260 / 21;
        ctx.fillRect(96 + col * cell + 1, 128 + row * cell + 1, cell - 2, cell - 2);
        ctx.fillRect(w - 356 + col * cell + 1, 128 + row * cell + 1, cell - 2, cell - 2);
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 58px sans-serif';
    ctx.fillText('www.soarhigh.top', w / 2, h - 196);
    ctx.font = '800 34px sans-serif';
    ctx.fillText('Mini app: 搜嗨头马', w / 2, h - 132);
    return;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 58px sans-serif';
  let y = h * 0.28;
  y = drawPopupWrappedText(ctx, data.title, w / 2, y, w - 140, 70, 2);

  ctx.fillStyle = 'rgba(245,240,232,.86)';
  ctx.font = '600 30px sans-serif';
  y = drawPopupWrappedText(ctx, data.desc, w / 2, y + 64, w - 180, 42, 4);

  if (data.lines?.length) {
    ctx.fillStyle = data.accent || '#c9a96e';
    const visibleLines = data.lines.slice(0, 5);
    const lineHeight = visibleLines.length >= 5 ? 35 : 44;
    const fontSize = visibleLines.length >= 5 ? 27 : 32;
    const startY = Math.min(y + 54, h - 104 - (visibleLines.length - 1) * lineHeight);
    ctx.font = `800 ${fontSize}px sans-serif`;
    visibleLines.forEach((line, i) => {
      ctx.fillText(line, w / 2, startY + i * lineHeight);
    });
  }
}

function loadPopupImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Unable to load ${src}`));
    img.src = src;
  });
}

function drawCoveredImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawCollageTile(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
): void {
  const pad = 14;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotation);
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = 'rgba(245,236,218,.94)';
  ctx.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(13,18,20,.95)';
  ctx.fillRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10);
  drawCoveredImage(ctx, image, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawLoadedPopupCollage(ctx: CanvasRenderingContext2D, data: FrameUserData, images: HTMLImageElement[]): void {
  const w = photoPopupCanvas.width;
  const h = photoPopupCanvas.height;
  drawPopupBackground(ctx, data, w, h);

  const tiles = images.length > 4
    ? [
      {x: 58, y: 64, w: 202, h: 152, r: -0.035},
      {x: 298, y: 94, w: 202, h: 152, r: 0.026},
      {x: 538, y: 62, w: 202, h: 152, r: -0.024},
      {x: 778, y: 96, w: 202, h: 152, r: 0.028},
      {x: 76, y: 412, w: 202, h: 152, r: 0.02},
      {x: 334, y: 378, w: 152, h: 204, r: -0.024},
      {x: 528, y: 424, w: 258, h: 146, r: 0.018},
      {x: 812, y: 396, w: 164, h: 150, r: -0.02},
    ]
    : [
      {x: 64, y: 56, w: 424, h: 284, r: -0.035},
      {x: 552, y: 86, w: 414, h: 278, r: 0.028},
      {x: 126, y: 414, w: 286, h: 306, r: 0.032},
      {x: 464, y: 402, w: 444, h: 296, r: -0.024},
    ];

  images.slice(0, tiles.length).forEach((image, index) => {
    const tile = tiles[index];
    drawCollageTile(ctx, image, tile.x, tile.y, tile.w, tile.h, tile.r);
  });
}

function drawLoadedPopupImage(ctx: CanvasRenderingContext2D, data: FrameUserData, images: HTMLImageElement[]): void {
  if (images.length > 1) {
    drawLoadedPopupCollage(ctx, data, images);
    return;
  }

  const w = photoPopupCanvas.width;
  const h = photoPopupCanvas.height;
  drawPopupBackground(ctx, data, w, h);

  const maxW = w - 84;
  const maxH = h - 84;
  const scale = Math.min(maxW / images[0].naturalWidth, maxH / images[0].naturalHeight);
  const imageW = images[0].naturalWidth * scale;
  const imageH = images[0].naturalHeight * scale;
  const imageX = (w - imageW) / 2;
  const imageY = (h - imageH) / 2;
  const backingPad = 16;

  ctx.shadowColor = 'rgba(0,0,0,.48)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = 'rgba(245,236,218,.9)';
  ctx.fillRect(imageX - backingPad - 2, imageY - backingPad - 2, imageW + backingPad * 2 + 4, imageH + backingPad * 2 + 4);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(13,18,20,.94)';
  ctx.fillRect(imageX - backingPad, imageY - backingPad, imageW + backingPad * 2, imageH + backingPad * 2);
  ctx.drawImage(images[0], imageX, imageY, imageW, imageH);
}

function resizePopupCanvasForLoadedImage(data: FrameUserData, images: HTMLImageElement[]): void {
  if (data.kind === 'qr' || images.length === 0) return;
  if (images.length > 1) {
    photoPopupCanvas.width = 1040;
    photoPopupCanvas.height = 760;
    return;
  }

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const textColumnW = viewportW >= 900 ? Math.min(viewportW * 0.43, 864) : 0;
  const chromeW = viewportW >= 900 ? 150 + textColumnW : 48;
  const maxImageH = Math.min(1260, viewportH * 0.92);
  const maxImageW = Math.min(1280, viewportW - chromeW);
  const scale = Math.min(maxImageW / images[0].naturalWidth, maxImageH / images[0].naturalHeight);
  const imageW = images[0].naturalWidth * scale;
  const imageH = images[0].naturalHeight * scale;
  const isPortrait = images[0].naturalHeight > images[0].naturalWidth;
  photoPopupCanvas.width = Math.round(Math.max(isPortrait ? 560 : 720, imageW + 72));
  photoPopupCanvas.height = Math.round(Math.max(isPortrait ? 760 : 520, imageH + 72));
}

interface OpenFrameOptions {
  animateCanvas?: boolean;
}

function renderPopupDesc(data: FrameUserData): void {
  photoPopupDesc.replaceChildren();
  if (!data.descSegments?.length) {
    photoPopupDesc.textContent = data.desc;
    return;
  }

  let activeBullet: HTMLSpanElement | null = null;
  data.descSegments.forEach(segment => {
    const span = document.createElement('span');
    span.textContent = segment.text;
    if (segment.tone) span.className = `pp-desc-${segment.tone}`;

    if (segment.bullet) {
      activeBullet = document.createElement('span');
      activeBullet.className = 'pp-desc-bullet';
      activeBullet.append(span);
      photoPopupDesc.append(activeBullet);
    } else if (activeBullet) {
      activeBullet.append(span);
    } else {
      photoPopupDesc.append(span);
    }

    if (segment.breakAfter) {
      activeBullet = null;
      photoPopupDesc.append(document.createElement('br'));
    }
  });
}

export function openFrameData(data: FrameUserData, options: OpenFrameOptions = {}): void {
  showingPhoto = true;
  resetTouchInput();
  document.exitPointerLock?.();
  document.body.classList.add('popup-open');
  renderer.domElement.focus();
  const renderToken = ++popupRenderToken;
  photoPopup.scrollTop = 0;
  photoPopup.classList.remove('swap');
  photoPopup.classList.remove('text-swap');
  if (options.animateCanvas !== false) {
    void photoPopup.offsetWidth;
    photoPopup.classList.add('swap');
  }
  photoPopup.classList.toggle('full-art', data.kind === 'timeline' || data.kind === 'qr');
  photoPopupCanvas.width = data.kind === 'qr' ? 980 : 1120;
  photoPopupCanvas.height = data.kind === 'qr' ? 660 : 720;
  const ctx = canvasContext2d(photoPopupCanvas);
  drawPopupFallback(ctx, data);
  photoPopupTitle.textContent = data.title;
  renderPopupDesc(data);
  photoPopup.classList.add('open');

  const imageSrcs = data.imageSrcs?.length ? data.imageSrcs : data.imageSrc ? [data.imageSrc] : [];
  if (!imageSrcs.length) return;

  Promise.all(imageSrcs.map(loadPopupImage)).then(images => {
    if (renderToken !== popupRenderToken || !showingPhoto) return;
    resizePopupCanvasForLoadedImage(data, images);
    drawLoadedPopupImage(canvasContext2d(photoPopupCanvas), data, images);
  }).catch(() => {});
}

export function updateFrameText(title: string, desc: string, descSegments?: FrameUserData['descSegments']): void {
  if (!showingPhoto) return;
  photoPopup.scrollTop = 0;
  photoPopup.classList.remove('swap');
  photoPopup.classList.remove('text-swap');
  photoPopupTitle.textContent = title;
  renderPopupDesc({title, desc, descSegments});
  void photoPopup.offsetWidth;
  photoPopup.classList.add('text-swap');
}

function closePhoto(restorePointerLock = true, emitClosedEvent = true): void {
  const wasShowingPhoto = showingPhoto;
  showingPhoto = false;
  popupRenderToken++;
  document.body.classList.remove('popup-open');
  photoPopup.classList.remove('open');
  photoPopup.classList.remove('swap');
  photoPopup.classList.remove('text-swap');
  photoPopup.classList.remove('full-art');
  if (restorePointerLock) requestPointerLockSafe();
  if (wasShowingPhoto && emitClosedEvent) {
    window.dispatchEvent(new CustomEvent(PHOTO_CLOSED_EVENT));
  }
}

export function closeActivePhoto(restorePointerLock = false, emitClosedEvent = false): void {
  if (!showingPhoto) return;
  closePhoto(restorePointerLock, emitClosedEvent);
}

export function isPhotoOpen(): boolean {
  return showingPhoto;
}

photoPopupClose.addEventListener('click', e => {
  e.stopPropagation();
  closePhoto();
});
photoPopup.addEventListener('click', e => {
  if (e.target === photoPopup) closePhoto();
});
document.addEventListener('keydown', e => { if(e.key==='Escape' && showingPhoto) closePhoto(); });
