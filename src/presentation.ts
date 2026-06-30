import * as THREE from 'three';
import {
  CLUB_INTRO_PRESENTATION_CUES,
  CLUB_INTRO_PRESENTATION_GROUPS,
} from './clubIntroData';
import {
  closeActivePhoto,
  hasEnteredGallery,
  isPhotoOpen,
  openFrameData,
  PHOTO_CLOSED_EVENT,
  setViewAngles,
  updateFrameText,
} from './controls';
import {
  presentationHud,
  presentationNav,
  presentationNext,
  presentationPrev,
  presentationStatus,
} from './dom';
import {
  frameDataForPresentationCue,
  PRESENTATION_CUE_SELECTED_EVENT,
} from './presentationFrameData';
import { camera } from './scene';
import type { FrameUserData, PresentationCue } from './types';

const cueCount = CLUB_INTRO_PRESENTATION_CUES.length;
const groupTitleMap = new Map(
  CLUB_INTRO_PRESENTATION_GROUPS.map(group => [group.id, group.title] as const),
);
const groupRoomMap = new Map(
  CLUB_INTRO_PRESENTATION_GROUPS.map(group => [group.id, group.roomIdx] as const),
);

const startPosition = new THREE.Vector3();
const endPosition = new THREE.Vector3();
const startLookAt = new THREE.Vector3();
const endLookAt = new THREE.Vector3();
const currentLookAt = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();

type CameraRoutePoint = {
  position: [number, number, number];
  lookAt: [number, number, number];
  durationMs: number;
};

const room0ToRoom1Route: CameraRoutePoint[] = [
  {
    position: [0, 1.62, -8.35],
    lookAt: [0, 1.56, -11.3],
    durationMs: 1200,
  },
  {
    position: [0, 1.62, -15.85],
    lookAt: [0, 1.56, -17.1],
    durationMs: 2000,
  },
  {
    position: [-2.25, 1.62, -17.9],
    lookAt: [-5.2, 1.66, -18.45],
    durationMs: 950,
  },
  {
    position: [-3.2, 1.66, -18.45],
    lookAt: [-6.4, 1.9, -18.55],
    durationMs: 540,
  },
];

const room1ToRoom0Route: CameraRoutePoint[] = [
  {
    position: [0, 1.62, -18.45],
    lookAt: [0, 1.56, -15.75],
    durationMs: 1200,
  },
  {
    position: [0, 1.62, -8.35],
    lookAt: [0, 1.56, -7.0],
    durationMs: 2000,
  },
  {
    position: [-2.7, 1.65, -8.25],
    lookAt: [-6.0, 1.9, -8.25],
    durationMs: 980,
  },
];

const INTER_ROOM_FINAL_SETTLE_MS = 520;
const routePositions: THREE.Vector3[] = [];
const routeLookAts: THREE.Vector3[] = [];
const routeDurations: number[] = [];
let active = false;
let currentIndex = -1;
let isCameraMoving = false;
let transitionElapsedMs = 0;
let transitionDurationMs = 0;
let onCameraArrive: (() => void) | null = null;

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

function showHud(cue: PresentationCue): void {
  const groupTitle = groupTitleMap.get(cue.groupId) || 'Guided intro';
  presentationStatus.textContent = `${groupTitle} · ${currentIndex + 1}/${cueCount}`;
  presentationHud.classList.add('show');
  presentationNav.classList.add('show');
  updateNavButtons();
}

function hideHud(): void {
  presentationHud.classList.remove('show');
  presentationNav.classList.remove('show');
  updateNavButtons();
}

function currentCameraLookAt(): THREE.Vector3 {
  camera.getWorldDirection(cameraDirection);
  return startLookAt.copy(camera.position).addScaledVector(cameraDirection, 4);
}

function getInterRoomRoute(previousCue: PresentationCue | null, cue: PresentationCue): CameraRoutePoint[] {
  if (!previousCue || previousCue.groupId === cue.groupId) return [];

  const fromRoom = groupRoomMap.get(previousCue.groupId);
  const toRoom = groupRoomMap.get(cue.groupId);
  if (fromRoom === 0 && toRoom === 1) return room0ToRoom1Route;
  if (fromRoom === 1 && toRoom === 0) return room1ToRoom0Route;
  return [];
}

function clearCameraRoute(): void {
  routePositions.length = 0;
  routeLookAts.length = 0;
  routeDurations.length = 0;
}

function queueCameraRoutePoint(point: CameraRoutePoint): void {
  routePositions.push(new THREE.Vector3().fromArray(point.position));
  routeLookAts.push(new THREE.Vector3().fromArray(point.lookAt));
  routeDurations.push(point.durationMs);
  transitionDurationMs += point.durationMs;
}

function sampleCameraRoute(elapsedMs: number): void {
  let segmentStartMs = 0;
  for (let index = 0; index < routeDurations.length; index += 1) {
    const durationMs = Math.max(1, routeDurations[index]);
    const segmentEndMs = segmentStartMs + durationMs;
    if (elapsedMs <= segmentEndMs || index === routeDurations.length - 1) {
      const t = clamp((elapsedMs - segmentStartMs) / durationMs, 0, 1);
      camera.position.lerpVectors(routePositions[index], routePositions[index + 1], t);
      currentLookAt.lerpVectors(routeLookAts[index], routeLookAts[index + 1], t);
      return;
    }
    segmentStartMs = segmentEndMs;
  }
}

function startCameraMove(
  cue: PresentationCue,
  previousCue: PresentationCue | null,
  onArrive?: () => void,
): void {
  isCameraMoving = true;
  transitionElapsedMs = 0;
  transitionDurationMs = 0;
  clearCameraRoute();
  onCameraArrive = onArrive || null;
  startPosition.copy(camera.position);
  startLookAt.copy(currentCameraLookAt());

  const interRoomRoute = getInterRoomRoute(previousCue, cue);
  if (interRoomRoute.length === 0) {
    transitionDurationMs = cue.camera.durationMs;
    endPosition.fromArray(cue.camera.position);
    endLookAt.fromArray(cue.camera.lookAt);
    updateNavButtons();
    return;
  }

  routePositions.push(startPosition.clone());
  routeLookAts.push(startLookAt.clone());
  interRoomRoute.forEach(queueCameraRoutePoint);
  queueCameraRoutePoint({
    ...cue.camera,
    durationMs: INTER_ROOM_FINAL_SETTLE_MS,
  });
  endPosition.copy(routePositions[routePositions.length - 1]);
  endLookAt.copy(routeLookAts[routeLookAts.length - 1]);

  updateNavButtons();
}

function settleCameraMove(): void {
  camera.position.copy(endPosition);
  applyLookAt(camera.position, endLookAt);
  isCameraMoving = false;
  transitionElapsedMs = 0;
  transitionDurationMs = 0;
  clearCameraRoute();

  const callback = onCameraArrive;
  onCameraArrive = null;
  callback?.();
  updateNavButtons();
}

function openCue(cue: PresentationCue, frameData: FrameUserData, animateCanvas = true): void {
  openFrameData(frameData, { animateCanvas });
}

function goToCue(index: number): void {
  if (index < 0) return;
  if (index >= cueCount) {
    finishPresentation();
    return;
  }

  const cue = CLUB_INTRO_PRESENTATION_CUES[index];
  const frameData = frameDataForPresentationCue(cue);
  if (!frameData) return;

  const previousCue = currentIndex >= 0 ? CLUB_INTRO_PRESENTATION_CUES[currentIndex] : null;
  const isSameGroup = previousCue?.groupId === cue.groupId;
  const isSameExhibit = previousCue?.exhibitId === cue.exhibitId;

  active = true;
  currentIndex = index;
  showHud(cue);

  if (!previousCue) {
    closeActivePhoto(false);
    startCameraMove(cue, previousCue, () => openCue(cue, frameData));
    return;
  }

  if (isSameGroup && isSameExhibit) {
    updateFrameText(cue.title, cue.desc, cue.descSegments);
    updateNavButtons();
    return;
  }

  if (isSameGroup) {
    openCue(cue, frameData);
    startCameraMove(cue, previousCue);
    return;
  }

  closeActivePhoto(false);
  startCameraMove(cue, previousCue, () => openCue(cue, frameData));
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
  if (!active) return;
  goToCue(Math.max(0, currentIndex - 1));
}

function finishPresentation(): void {
  active = false;
  currentIndex = -1;
  isCameraMoving = false;
  onCameraArrive = null;
  clearCameraRoute();
  hideHud();
  closeActivePhoto(false);
}

function activatePresentationAtCue(index: number): void {
  const cue = CLUB_INTRO_PRESENTATION_CUES[index];
  if (!cue) return;

  active = true;
  currentIndex = index;
  isCameraMoving = false;
  transitionElapsedMs = 0;
  transitionDurationMs = 0;
  onCameraArrive = null;
  clearCameraRoute();
  showHud(cue);
}

function updateNavButtons(): void {
  const canUseNav = active && !isCameraMoving;
  presentationPrev.disabled = !canUseNav || currentIndex <= 0;
  presentationNext.disabled = !canUseNav || currentIndex >= cueCount - 1;
}

export function updatePresentation(dt: number): boolean {
  if (!active) return false;

  if (!isCameraMoving) return isPhotoOpen();

  if (transitionElapsedMs < transitionDurationMs) {
    transitionElapsedMs = Math.min(transitionDurationMs, transitionElapsedMs + dt * 1000);
    if (routeDurations.length > 0) {
      sampleCameraRoute(transitionElapsedMs);
    } else {
      const t = transitionDurationMs === 0 ? 1 : easeInOut(transitionElapsedMs / transitionDurationMs);
      camera.position.lerpVectors(startPosition, endPosition, t);
      currentLookAt.lerpVectors(startLookAt, endLookAt, t);
    }
    applyLookAt(camera.position, currentLookAt);
  } else {
    settleCameraMove();
  }

  return true;
}

function isNextKey(e: KeyboardEvent): boolean {
  return e.code === 'Space' ||
    e.code === 'ArrowDown' ||
    e.code === 'ArrowRight' ||
    e.code === 'PageDown' ||
    e.key === 'Enter';
}

function isPreviousKey(e: KeyboardEvent): boolean {
  return e.code === 'ArrowUp' ||
    e.code === 'ArrowLeft' ||
    e.code === 'PageUp';
}

function handlePresentationKeydown(e: KeyboardEvent): void {
  if (!hasEnteredGallery()) return;

  if (!active) {
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if ((e.code === 'Space' || e.code === 'ArrowDown') && !isPhotoOpen()) {
      e.preventDefault();
      e.stopPropagation();
      startPresentation();
    }
    return;
  }

  if (e.key === 'Escape' && active) {
    e.preventDefault();
    e.stopPropagation();
    finishPresentation();
    return;
  }

  if (isCameraMoving) {
    if (isNextKey(e) || isPreviousKey(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }

  if (isNextKey(e)) {
    e.preventDefault();
    e.stopPropagation();
    nextCue();
    return;
  }

  if (isPreviousKey(e)) {
    e.preventDefault();
    e.stopPropagation();
    previousCue();
  }
}

window.addEventListener('keydown', handlePresentationKeydown, { capture: true });

function stopNavPointerEvent(e: Event): void {
  e.stopPropagation();
}

function handlePresentationPrevClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  if (!active || isCameraMoving || currentIndex <= 0) return;
  previousCue();
}

function handlePresentationNextClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  if (!active || isCameraMoving || currentIndex >= cueCount - 1) return;
  nextCue();
}

presentationNav.addEventListener('pointerdown', stopNavPointerEvent);
presentationNav.addEventListener('touchstart', stopNavPointerEvent, { passive: true });
presentationPrev.addEventListener('click', handlePresentationPrevClick);
presentationNext.addEventListener('click', handlePresentationNextClick);

function handlePresentationCueSelected(e: Event): void {
  const cueIndex = (e as CustomEvent<{cueIndex?: number}>).detail?.cueIndex;
  if (typeof cueIndex !== 'number') return;
  activatePresentationAtCue(cueIndex);
}

window.addEventListener(PRESENTATION_CUE_SELECTED_EVENT, handlePresentationCueSelected);

function handlePhotoClosed(): void {
  if (!active) return;
  active = false;
  currentIndex = -1;
  isCameraMoving = false;
  onCameraArrive = null;
  clearCameraRoute();
  hideHud();
}

window.addEventListener(PHOTO_CLOSED_EVENT, handlePhotoClosed);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('keydown', handlePresentationKeydown, true);
    window.removeEventListener(PRESENTATION_CUE_SELECTED_EVENT, handlePresentationCueSelected);
    window.removeEventListener(PHOTO_CLOSED_EVENT, handlePhotoClosed);
    presentationNav.removeEventListener('pointerdown', stopNavPointerEvent);
    presentationNav.removeEventListener('touchstart', stopNavPointerEvent);
    presentationPrev.removeEventListener('click', handlePresentationPrevClick);
    presentationNext.removeEventListener('click', handlePresentationNextClick);
  });
}
