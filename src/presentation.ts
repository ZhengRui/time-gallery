import * as THREE from 'three';
import {
  CLUB_INTRO_ASSET_MAP,
  CLUB_INTRO_EXHIBIT_MAP,
  CLUB_INTRO_PRESENTATION_CUES,
  CLUB_INTRO_PRESENTATION_GROUPS,
} from './clubIntroData';
import { closeActivePhoto, hasEnteredGallery, openFrameData, setViewAngles } from './controls';
import { presentationHud, presentationStatus } from './dom';
import { camera } from './scene';
import type { FrameUserData, PresentationCue } from './types';

const cueCount = CLUB_INTRO_PRESENTATION_CUES.length;
const groupTitleMap = new Map(
  CLUB_INTRO_PRESENTATION_GROUPS.map(group => [group.id, group.title] as const),
);

const startPosition = new THREE.Vector3();
const endPosition = new THREE.Vector3();
const startLookAt = new THREE.Vector3();
const endLookAt = new THREE.Vector3();
const currentLookAt = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();

let active = false;
let currentIndex = -1;
let transitionElapsedMs = 0;
let transitionDurationMs = 0;

function accentHue(accent?: string): number {
  const hex = (accent || '#c9a96e').replace('#', '');
  const n = Number.parseInt(hex.length === 3
    ? hex.split('').map(ch => ch + ch).join('')
    : hex, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 40;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function applyLookAt(position: THREE.Vector3, lookAt: THREE.Vector3): void {
  const dx = lookAt.x - position.x;
  const dy = lookAt.y - position.y;
  const dz = lookAt.z - position.z;
  const length = Math.max(0.0001, Math.hypot(dx, dy, dz));
  const nextYaw = Math.atan2(-dx, -dz);
  const nextPitch = Math.asin(clamp(dy / length, -0.95, 0.95));
  setViewAngles(nextYaw, nextPitch);
}

function frameDataForCue(cue: PresentationCue): FrameUserData | null {
  const exhibit = CLUB_INTRO_EXHIBIT_MAP.get(cue.exhibitId);
  if (!exhibit) return null;
  const assets = (exhibit.assetIds || [])
    .map(id => CLUB_INTRO_ASSET_MAP.get(id))
    .filter(asset => !!asset);
  const imageSrcs = assets
    .map(asset => asset?.localPath || asset?.sourceUrl)
    .filter((src): src is string => !!src);

  return {
    id: exhibit.id,
    roomIdx: exhibit.roomIdx,
    title: cue.title,
    desc: cue.desc,
    h: accentHue(exhibit.accent),
    s: 62,
    kind: exhibit.kind,
    imageSrc: imageSrcs[0],
    imageSrcs,
    lines: exhibit.lines,
    accent: exhibit.accent,
  };
}

function showHud(cue: PresentationCue): void {
  const groupTitle = groupTitleMap.get(cue.groupId) || 'Guided intro';
  presentationStatus.textContent = `${groupTitle} · ${currentIndex + 1}/${cueCount}`;
  presentationHud.classList.add('show');
}

function hideHud(): void {
  presentationHud.classList.remove('show');
}

function currentCameraLookAt(): THREE.Vector3 {
  camera.getWorldDirection(cameraDirection);
  return startLookAt.copy(camera.position).addScaledVector(cameraDirection, 4);
}

function goToCue(index: number): void {
  if (index < 0) return;
  if (index >= cueCount) {
    finishPresentation();
    return;
  }

  const cue = CLUB_INTRO_PRESENTATION_CUES[index];
  const frameData = frameDataForCue(cue);
  if (!frameData) return;

  active = true;
  currentIndex = index;
  transitionElapsedMs = 0;
  transitionDurationMs = cue.camera.durationMs;
  startPosition.copy(camera.position);
  startLookAt.copy(currentCameraLookAt());
  endPosition.fromArray(cue.camera.position);
  endLookAt.fromArray(cue.camera.lookAt);
  showHud(cue);
  openFrameData(frameData);
}

function startPresentation(): void {
  goToCue(0);
}

function nextCue(): void {
  if (!active) {
    startPresentation();
    return;
  }
  goToCue(currentIndex + 1);
}

function previousCue(): void {
  if (!active) {
    startPresentation();
    return;
  }
  goToCue(Math.max(0, currentIndex - 1));
}

function finishPresentation(): void {
  active = false;
  currentIndex = -1;
  hideHud();
  closeActivePhoto(false);
}

export function isPresentationActive(): boolean {
  return active;
}

export function updatePresentation(dt: number): boolean {
  if (!active) return false;

  if (transitionElapsedMs < transitionDurationMs) {
    transitionElapsedMs = Math.min(transitionDurationMs, transitionElapsedMs + dt * 1000);
    const t = transitionDurationMs === 0 ? 1 : easeInOut(transitionElapsedMs / transitionDurationMs);
    camera.position.lerpVectors(startPosition, endPosition, t);
    currentLookAt.lerpVectors(startLookAt, endLookAt, t);
    applyLookAt(camera.position, currentLookAt);
  } else {
    camera.position.copy(endPosition);
    applyLookAt(camera.position, endLookAt);
  }

  return true;
}

function isNextKey(e: KeyboardEvent): boolean {
  return e.code === 'Space' ||
    e.code === 'ArrowRight' ||
    e.code === 'PageDown' ||
    e.key === 'Enter';
}

function isPreviousKey(e: KeyboardEvent): boolean {
  return e.code === 'ArrowLeft' || e.code === 'PageUp';
}

function handlePresentationKeydown(e: KeyboardEvent): void {
  if (!hasEnteredGallery()) return;

  if (e.key === 'Escape' && active) {
    e.preventDefault();
    e.stopPropagation();
    finishPresentation();
    return;
  }

  if (isNextKey(e) && (active || e.code === 'Space' || e.key === 'Enter')) {
    e.preventDefault();
    e.stopPropagation();
    nextCue();
    return;
  }

  if (isPreviousKey(e) && active) {
    e.preventDefault();
    e.stopPropagation();
    previousCue();
  }
}

window.addEventListener('keydown', handlePresentationKeydown, { capture: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('keydown', handlePresentationKeydown, true);
  });
}
