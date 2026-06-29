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

const startPosition = new THREE.Vector3();
const endPosition = new THREE.Vector3();
const startLookAt = new THREE.Vector3();
const endLookAt = new THREE.Vector3();
const currentLookAt = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();

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

function startCameraMove(cue: PresentationCue, onArrive?: () => void): void {
  isCameraMoving = true;
  transitionElapsedMs = 0;
  transitionDurationMs = cue.camera.durationMs;
  onCameraArrive = onArrive || null;
  startPosition.copy(camera.position);
  startLookAt.copy(currentCameraLookAt());
  endPosition.fromArray(cue.camera.position);
  endLookAt.fromArray(cue.camera.lookAt);
  updateNavButtons();
}

function settleCameraMove(): void {
  camera.position.copy(endPosition);
  applyLookAt(camera.position, endLookAt);
  isCameraMoving = false;
  transitionElapsedMs = 0;
  transitionDurationMs = 0;

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
    startCameraMove(cue, () => openCue(cue, frameData));
    return;
  }

  if (isSameGroup && isSameExhibit) {
    updateFrameText(cue.title, cue.desc, cue.descSegments);
    updateNavButtons();
    return;
  }

  if (isSameGroup) {
    openCue(cue, frameData);
    startCameraMove(cue);
    return;
  }

  closeActivePhoto(false);
  startCameraMove(cue, () => openCue(cue, frameData));
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
  showHud(cue);
}

function updateNavButtons(): void {
  const canUseNav = active && !isCameraMoving;
  presentationPrev.disabled = !canUseNav || currentIndex <= 0;
  presentationNext.disabled = !canUseNav || currentIndex >= cueCount - 1;
}

export function isPresentationActive(): boolean {
  return active;
}

export function updatePresentation(dt: number): boolean {
  if (!active) return false;

  if (!isCameraMoving) return isPhotoOpen();

  if (transitionElapsedMs < transitionDurationMs) {
    transitionElapsedMs = Math.min(transitionDurationMs, transitionElapsedMs + dt * 1000);
    const t = transitionDurationMs === 0 ? 1 : easeInOut(transitionElapsedMs / transitionDurationMs);
    camera.position.lerpVectors(startPosition, endPosition, t);
    currentLookAt.lerpVectors(startLookAt, endLookAt, t);
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
