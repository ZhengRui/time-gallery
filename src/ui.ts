import { ROOMS } from './data';
import { canvasContext2d, minimapCanvas, roomLabelName, roomLabelSub } from './dom';
import { corridorRects, roomRects } from './gallery';
import { camera } from './scene';
import { yaw } from './controls';
import type { Rect } from './types';

// ============ MINIMAP ============
const mmCtx = canvasContext2d(minimapCanvas);
let currentRoomIdx = 0;

export function drawMinimap(): void {
  const mw = minimapCanvas.width, mh = minimapCanvas.height;
  mmCtx.clearRect(0,0,mw,mh);
  mmCtx.fillStyle = 'rgba(0,0,0,.3)';
  mmCtx.fillRect(0,0,mw,mh);

  const allRects: Rect[] = [...roomRects, ...corridorRects];
  const minX = Math.min(...allRects.map(r => r.minX));
  const maxX = Math.max(...allRects.map(r => r.maxX));
  const minZ = Math.min(...allRects.map(r => r.minZ));
  const maxZ = Math.max(...allRects.map(r => r.maxZ));
  const scale = Math.min((mw - 20) / (maxX - minX), (mh - 20) / (maxZ - minZ));
  const ox = (mw - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (mh - (maxZ - minZ) * scale) / 2 - minZ * scale;
  const mapX = (x: number) => ox + x * scale;
  const mapZ = (z: number) => oy + z * scale;

  corridorRects.forEach(r => {
    mmCtx.fillStyle = 'rgba(255,255,255,.05)';
    mmCtx.fillRect(mapX(r.minX), mapZ(r.minZ), (r.maxX-r.minX)*scale, (r.maxZ-r.minZ)*scale);
  });

  roomRects.forEach(r => {
    const rm = ROOMS[r.roomIdx];
    const x = mapX(r.minX);
    const y = mapZ(r.minZ);
    const rw = (r.maxX - r.minX) * scale;
    const rd = (r.maxZ - r.minZ) * scale;
    mmCtx.fillStyle = r.roomIdx === currentRoomIdx ? 'rgba(201,169,110,.3)' : 'rgba(255,255,255,.08)';
    mmCtx.fillRect(x, y, rw, rd);
    mmCtx.strokeStyle = 'rgba(201,169,110,.2)';
    mmCtx.strokeRect(x, y, rw, rd);
    mmCtx.fillStyle = 'rgba(201,169,110,.4)';
    mmCtx.font = '7px sans-serif';
    mmCtx.textAlign = 'center';
    mmCtx.fillText(rm.name, x + rw/2, y + rd/2 + 3);
  });

  const camZ = camera.position.z;
  const camX = camera.position.x;
  const dotZ = mapZ(camZ);
  const dotX = mapX(camX);

  mmCtx.fillStyle = '#c9a96e';
  mmCtx.beginPath();
  mmCtx.arc(dotX, dotZ, 3, 0, Math.PI*2);
  mmCtx.fill();

  const dx = -Math.sin(yaw) * 8;
  const dz = -Math.cos(yaw) * 8;
  mmCtx.strokeStyle = '#c9a96e';
  mmCtx.lineWidth = 1.5;
  mmCtx.beginPath();
  mmCtx.moveTo(dotX, dotZ);
  mmCtx.lineTo(dotX + dx, dotZ + dz);
  mmCtx.stroke();
}

// ============ ROOM TRACKING ============
export function updateCurrentRoom(): void {
  for (const r of roomRects) {
    if (camera.position.x > r.minX && camera.position.x < r.maxX &&
        camera.position.z > r.minZ && camera.position.z < r.maxZ) {
      if (r.roomIdx !== currentRoomIdx) {
        currentRoomIdx = r.roomIdx;
        roomLabelName.textContent = ROOMS[currentRoomIdx].name;
        roomLabelSub.textContent = ROOMS[currentRoomIdx].sub;
      }
      break;
    }
  }
}
