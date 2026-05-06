import type * as THREE from 'three';
import { corridorRects, roomRects } from './gallery';

// ============ COLLISION ============
export function canMoveTo(pos: THREE.Vector3): boolean {
  const margin = 0.3;
  for (const r of roomRects) {
    if (pos.x > r.minX + margin && pos.x < r.maxX - margin &&
        pos.z > r.minZ + margin && pos.z < r.maxZ - margin) return true;
  }
  for (const r of corridorRects) {
    const alongX = r.axis === 'x';
    const minX = r.minX + (alongX ? -margin : margin);
    const maxX = r.maxX + (alongX ? margin : -margin);
    const minZ = r.minZ + (alongX ? margin : -margin);
    const maxZ = r.maxZ + (alongX ? -margin : margin);
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) return true;
  }
  return false;
}
