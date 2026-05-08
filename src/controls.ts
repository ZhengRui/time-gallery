import * as THREE from 'three';
import {
  canvasContext2d,
  crosshair,
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
import { camera, renderer } from './scene';
import type { FrameUserData } from './types';

// ============ FIRST PERSON CONTROLS ============
export const moveState = {f:false,b:false,l:false,r:false};
export const touchMoveState = {x:0,z:0};
export let yaw = 0;
export let pitch = 0;
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

function requestPointerLockSafe(): void {
  if (touchNavigationAvailable) return;
  if (!renderer.domElement.requestPointerLock) return;
  try {
    const result = renderer.domElement.requestPointerLock();
    if (result && 'catch' in result) result.catch(() => {});
  } catch(e) {}
}

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
    showPhoto(visibleFrame.userData as FrameUserData);
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
  if (e.code === 'KeyW' || key === 'w' || key === 'arrowup') return 'f';
  if (e.code === 'KeyS' || key === 's' || key === 'arrowdown') return 'b';
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
    showPhoto(visibleFrame.userData as FrameUserData);
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

function showPhoto(data: FrameUserData): void {
  showingPhoto = true;
  resetTouchInput();
  document.exitPointerLock?.();
  photoPopupCanvas.width = photoPopupCanvas.height = 600;
  const ctx = canvasContext2d(photoPopupCanvas);
  const g = ctx.createRadialGradient(300,300,0,300,300,420);
  g.addColorStop(0,`hsl(${data.h},${data.s}%,30%)`); g.addColorStop(.5,`hsl(${(data.h+20)%360},${data.s*.8}%,16%)`); g.addColorStop(1,`hsl(${(data.h+40)%360},${data.s*.6}%,7%)`);
  ctx.fillStyle=g; ctx.fillRect(0,0,600,600);
  for(let i=0;i<10;i++){ctx.beginPath();ctx.moveTo(Math.random()*600,Math.random()*600);for(let j=0;j<4;j++)ctx.bezierCurveTo(Math.random()*600,Math.random()*600,Math.random()*600,Math.random()*600,Math.random()*600,Math.random()*600);ctx.strokeStyle=`hsla(${(data.h+i*40)%360},${data.s}%,55%,${.04+Math.random()*.06})`;ctx.lineWidth=2+Math.random()*5;ctx.stroke()}
  for(let i=0;i<6;i++){const x=Math.random()*600,y=Math.random()*600,r=30+Math.random()*120;const og=ctx.createRadialGradient(x,y,0,x,y,r);og.addColorStop(0,`hsla(${(data.h+i*50)%360},${data.s}%,60%,${.06+Math.random()*.1})`);og.addColorStop(1,`hsla(${(data.h+i*50)%360},${data.s}%,35%,0)`);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=og;ctx.fill()}
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='bold 36px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(data.title,300,300);
  photoPopupTitle.textContent = data.title;
  photoPopupDesc.textContent = data.desc;
  photoPopup.classList.add('open');
}

function closePhoto(): void {
  showingPhoto = false;
  photoPopup.classList.remove('open');
  requestPointerLockSafe();
}

photoPopupClose.addEventListener('click', e => {
  e.stopPropagation();
  closePhoto();
});
photoPopup.addEventListener('click', e => {
  if (e.target === photoPopup) closePhoto();
});
document.addEventListener('keydown', e => { if(e.key==='Escape' && showingPhoto) closePhoto(); });
