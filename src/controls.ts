import * as THREE from 'three';
import { canvasContext2d, crosshair, hud, overlay, photoPopup, photoPopupCanvas, photoPopupClose, photoPopupDesc, photoPopupTitle } from './dom';
import { frameMeshes, occluderMeshes } from './gallery';
import { camera, renderer } from './scene';
import type { FrameUserData } from './types';

// ============ FIRST PERSON CONTROLS ============
export const moveState = {f:false,b:false,l:false,r:false};
export let yaw = 0;
export let pitch = 0;
let isLocked = false;
let hasEntered = false;
export const direction = new THREE.Vector3();
export const speed = 5;

function requestPointerLockSafe(): void {
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
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
  } else if (mouseDown) {
    yaw -= (e.clientX - lastMX) * 0.004;
    pitch -= (e.clientY - lastMY) * 0.004;
    lastMX = e.clientX; lastMY = e.clientY;
  }
  pitch = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, pitch));
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
});

renderer.domElement.tabIndex = 0;
renderer.domElement.addEventListener('click', e => {
  renderer.domElement.focus();
  if (hasEntered && !isLocked && !showingPhoto) {
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
  if (photoPopup.contains(e.target as Node)) return;
  if (!isLocked || showingPhoto) return;
  const visibleFrame = getVisibleFrameHit();
  if (visibleFrame) {
    showPhoto(visibleFrame.userData as FrameUserData);
  }
});

export function updateCrosshair(): void {
  if (!isLocked) return;
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
  document.exitPointerLock();
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
