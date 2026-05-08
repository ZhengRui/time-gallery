import * as THREE from 'three';
import { canMoveTo } from './collision';
import { direction, moveState, pitch, speed, touchMoveState, updateCrosshair, yaw } from './controls';
import { loader, overlay } from './dom';
import { dust, dustCount } from './gallery';
import { camera, renderer, resizeRenderer, scene } from './scene';
import { drawMinimap, updateCurrentRoom } from './ui';

// ============ ANIMATION ============
const clock = new THREE.Clock();
let crosshairTimer = 0;
let minimapTimer = 0;
let dustTimer = 0;

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (document.hidden) return;

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  direction.set(touchMoveState.x, 0, touchMoveState.z);
  if (moveState.f) direction.z -= 1;
  if (moveState.b) direction.z += 1;
  if (moveState.l) direction.x -= 1;
  if (moveState.r) direction.x += 1;
  const directionLength = direction.length();
  if (directionLength > 1) {
    direction.divideScalar(directionLength);
  }

  if (direction.lengthSq() > 0) {
    const moveX = direction.x * Math.cos(yaw) + direction.z * Math.sin(yaw);
    const moveZ = -direction.x * Math.sin(yaw) + direction.z * Math.cos(yaw);
    const newPos = camera.position.clone();
    newPos.x += moveX * speed * dt;
    newPos.z += moveZ * speed * dt;
    if (canMoveTo(newPos)) {
      camera.position.copy(newPos);
    }
  }

  crosshairTimer += dt;
  if (crosshairTimer >= 0.12) {
    updateCrosshair();
    crosshairTimer = 0;
  }

  updateCurrentRoom();

  minimapTimer += dt;
  if (minimapTimer >= 0.12) {
    drawMinimap();
    minimapTimer = 0;
  }

  dustTimer += dt;
  if (dustTimer >= 0.05) {
    const positionAttr = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const dPos = positionAttr.array;
    const step = dustTimer / 0.016;
    for (let i = 0; i < dustCount; i++) {
      const yIndex = i*3+1;
      dPos[yIndex] += Math.sin(clock.elapsedTime + i) * 0.0006 * step;
      if (dPos[yIndex] > 5) dPos[yIndex] = 0;
    }
    positionAttr.needsUpdate = true;
    dustTimer = 0;
  }

  renderer.render(scene, camera);
}

export function startApp(): void {
  loader.addEventListener('click', () => {
    loader.classList.add('fade');
    setTimeout(() => loader.style.display = 'none', 1000);
    overlay.classList.remove('hidden');
  });

  animate();
  window.addEventListener('resize', resizeRenderer);
}
