import * as THREE from 'three';
import { CONNECTIONS, ROOM_PLAN, ROOMS } from './data';
import {
  frameMatShared,
  glassMat,
  leafMat,
  makeCeilingTex,
  makeFloorMaterial,
  makePlaqueTex,
  makeSignTex,
  makeWallMaterial,
  metalDarkMat,
  pictureGlassMat,
  potMat,
  sharedTextures,
  trimMatShared,
  warmLightMat,
  woodMat,
} from './materials';
import { scene } from './scene';
import type { Accent, Connection, CorridorRect, DoorWorldPoint, Rect, RoomData, RoomRect, WallSide } from './types';

export const frameMeshes: THREE.Group[] = [];
export const occluderMeshes: THREE.Mesh[] = [];
export const roomGroups: THREE.Group[] = [];
export const roomRects: RoomRect[] = [];
export const corridorRects: CorridorRect[] = [];

export const DOOR_W = 3.5;
const DOOR_H = 3.2;
const CORRIDOR_W = DOOR_W;
const DOOR_CLEARANCE = 0;

type DoorMap = Record<WallSide, number[]>;
type TrimSpan = { center: number; length: number };

function setShadow<T extends THREE.Mesh>(mesh: T, cast = true, receive = true): T {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function roomBounds(i: number): Rect {
  const rm = ROOMS[i];
  const p = ROOM_PLAN[i];
  return {
    minX:p.x - rm.w/2, maxX:p.x + rm.w/2,
    minZ:p.z - rm.d/2, maxZ:p.z + rm.d/2,
  };
}

const roomDoors: DoorMap[] = ROOMS.map(() => ({front:[], back:[], left:[], right:[]}));
CONNECTIONS.forEach(c => {
  roomDoors[c.a][c.sideA].push(c.offsetA);
  roomDoors[c.b][c.sideB].push(c.offsetB);
});

function addWallPanel(group: THREE.Group, side: WallSide, offset: number, length: number, y: number, height: number, w: number, d: number, material: THREE.Material): void {
  if (length <= 0.01 || height <= 0.01) return;
  const panel = setShadow(new THREE.Mesh(new THREE.PlaneGeometry(length, height), material));
  if (side === 'front' || side === 'back') {
    panel.position.set(offset, y, side === 'front' ? d/2 : -d/2);
    panel.rotation.y = side === 'front' ? Math.PI : 0;
  } else {
    panel.position.set(side === 'right' ? w/2 : -w/2, y, offset);
    panel.rotation.y = side === 'left' ? Math.PI/2 : -Math.PI/2;
  }
  group.add(panel);
  occluderMeshes.push(panel);
}

function addWallWithDoors(group: THREE.Group, side: WallSide, w: number, h: number, d: number, material: THREE.Material, doorOffsets: number[]): void {
  const wallLen = (side === 'front' || side === 'back') ? w : d;
  const half = wallLen / 2;
  const intervals = doorOffsets.map(o => ({
    start:Math.max(-half, o - DOOR_W/2 - DOOR_CLEARANCE),
    end:Math.min(half, o + DOOR_W/2 + DOOR_CLEARANCE),
    center:o,
  })).sort((a,b) => a.start - b.start);
  let cursor = -half;
  intervals.forEach(int => {
    addWallPanel(group, side, (cursor + int.start)/2, int.start - cursor, h/2, h, w, d, material);
    const aboveH = h - DOOR_H;
    addWallPanel(group, side, int.center, int.end - int.start, DOOR_H + aboveH/2, aboveH, w, d, material);
    cursor = int.end;
  });
  addWallPanel(group, side, (cursor + half)/2, half - cursor, h/2, h, w, d, material);
}

function trimSpans(wallLen: number, doorOffsets: number[], skipDoors: boolean): TrimSpan[] {
  if (!skipDoors || doorOffsets.length === 0) return [{center:0, length:wallLen}];
  const half = wallLen / 2;
  const spans: TrimSpan[] = [];
  const intervals = doorOffsets.map(o => ({
    start:Math.max(-half, o - DOOR_W/2 - .12),
    end:Math.min(half, o + DOOR_W/2 + .12),
  })).sort((a,b) => a.start - b.start);
  let cursor = -half;
  intervals.forEach(int => {
    if (int.start - cursor > .05) spans.push({center:(cursor + int.start)/2, length:int.start - cursor});
    cursor = int.end;
  });
  if (half - cursor > .05) spans.push({center:(cursor + half)/2, length:half - cursor});
  return spans;
}

function addTrimSegment(group: THREE.Group, side: WallSide, center: number, length: number, y: number, height: number, depth: number, w: number, d: number, material: THREE.Material): void {
  if (length <= .05) return;
  const alongX = side === 'front' || side === 'back';
  const geo = alongX ? new THREE.BoxGeometry(length, height, depth) : new THREE.BoxGeometry(depth, height, length);
  const mesh = setShadow(new THREE.Mesh(geo, material));
  const inset = depth * .45;
  if (side === 'front') mesh.position.set(center, y, d/2 - inset);
  if (side === 'back') mesh.position.set(center, y, -d/2 + inset);
  if (side === 'left') mesh.position.set(-w/2 + inset, y, center);
  if (side === 'right') mesh.position.set(w/2 - inset, y, center);
  group.add(mesh);
}

function addTrimWithDoors(group: THREE.Group, side: WallSide, w: number, h: number, d: number, material: THREE.Material, doorOffsets: number[], y: number, height: number, depth: number, skipDoors: boolean): void {
  const wallLen = (side === 'front' || side === 'back') ? w : d;
  trimSpans(wallLen, doorOffsets, skipDoors).forEach(span => {
    addTrimSegment(group, side, span.center, span.length, y, height, depth, w, d, material);
  });
}

function addDoorFrame(group: THREE.Group, side: WallSide, offset: number, w: number, d: number, material: THREE.Material): void {
  const thick = .16;
  const depth = .14;
  const inset = depth * .42;
  const parts: THREE.Mesh[] = [];
  if (side === 'front' || side === 'back') {
    const z = side === 'front' ? d/2 - inset : -d/2 + inset;
    [offset - DOOR_W/2 - thick/2, offset + DOOR_W/2 + thick/2].forEach(x => {
      const post = setShadow(new THREE.Mesh(new THREE.BoxGeometry(thick, DOOR_H, depth), material));
      post.position.set(x, DOOR_H/2, z);
      parts.push(post);
    });
    const lintel = setShadow(new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + thick*2, thick, depth), material));
    lintel.position.set(offset, DOOR_H + thick/2, z);
    parts.push(lintel);
  } else {
    const x = side === 'right' ? w/2 - inset : -w/2 + inset;
    [offset - DOOR_W/2 - thick/2, offset + DOOR_W/2 + thick/2].forEach(z => {
      const post = setShadow(new THREE.Mesh(new THREE.BoxGeometry(depth, DOOR_H, thick), material));
      post.position.set(x, DOOR_H/2, z);
      parts.push(post);
    });
    const lintel = setShadow(new THREE.Mesh(new THREE.BoxGeometry(depth, thick, DOOR_W + thick*2), material));
    lintel.position.set(x, DOOR_H + thick/2, offset);
    parts.push(lintel);
  }
  parts.forEach(part => group.add(part));
}

function addCornerTrim(group: THREE.Group, w: number, h: number, d: number, material: THREE.Material): void {
  const geo = new THREE.BoxGeometry(.18, h, .18);
  [
    [-w/2+.08, -d/2+.08],
    [ w/2-.08, -d/2+.08],
    [-w/2+.08,  d/2-.08],
    [ w/2-.08,  d/2-.08],
  ].forEach(([x,z]) => {
    const post = setShadow(new THREE.Mesh(geo, material));
    post.position.set(x, h/2, z);
    group.add(post);
  });
}

function addArchitecturalTrim(group: THREE.Group, rm: RoomData, ri: number): void {
  const w = rm.w, h = rm.h, d = rm.d;
  const trimMat = trimMatShared.clone();
  trimMat.color.setHex(0x7a684a);
  const shadowTrim = trimMatShared.clone();
  shadowTrim.color.setHex(0x3a3022);
  (['front','back','left','right'] as WallSide[]).forEach(side => {
    addTrimWithDoors(group, side, w, h, d, trimMat, roomDoors[ri][side], .12, .22, .12, true);
    addTrimWithDoors(group, side, w, h, d, shadowTrim, roomDoors[ri][side], 1.05, .055, .085, true);
    addTrimWithDoors(group, side, w, h, d, trimMat, roomDoors[ri][side], h - .12, .20, .13, false);
    roomDoors[ri][side].forEach(offset => addDoorFrame(group, side, offset, w, d, trimMat));
  });
  addCornerTrim(group, w, h, d, trimMat);
}

function addTrackLights(group: THREE.Group, rm: RoomData): void {
  const h = rm.h;
  const railCount = rm.w > 11 ? 2 : 1;
  const xs = railCount === 2 ? [-rm.w*.22, rm.w*.22] : [0];
  xs.forEach((x, railIdx) => {
    const rail = setShadow(new THREE.Mesh(new THREE.BoxGeometry(.08,.08,rm.d*.66), metalDarkMat), true, false);
    rail.position.set(x, h-.13, 0);
    group.add(rail);
    [-.25, .05, .33].forEach((zFrac, i) => {
      const z = rm.d * zFrac;
      const can = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.22,16), metalDarkMat), true, false);
      can.position.set(x, h-.32, z);
      group.add(can);
      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(.11,.13,.05,16), warmLightMat);
      bulb.position.set(x, h-.46, z);
      group.add(bulb);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.18,24), new THREE.MeshBasicMaterial({color:0xffe2a8, transparent:true, opacity:.9, side:THREE.DoubleSide}));
      lens.rotation.x = -Math.PI/2;
      lens.position.set(x, h-.5, z);
      group.add(lens);
      if (i === 1) {
        const spot = new THREE.SpotLight(0xffe6b0, 1.85, 13, Math.PI/5, .65, 1.25);
        spot.position.set(x, h-.45, z);
        spot.target.position.set(x + (railIdx ? -.8 : .8), 1.1, z - .5);
        group.add(spot); group.add(spot.target);
      }
    });
  });
}

function addBench(group: THREE.Group, x: number, z: number, rot=0): void {
  const bench = new THREE.Group();
  const seat = setShadow(new THREE.Mesh(new THREE.BoxGeometry(2.2,.18,.62), woodMat));
  seat.position.y = .52; bench.add(seat);
  const back = setShadow(new THREE.Mesh(new THREE.BoxGeometry(2.2,.5,.12), woodMat));
  back.position.set(0,.78,-.31); bench.add(back);
  [-.85,.85].forEach(px => [-.18,.18].forEach(pz => {
    const leg = setShadow(new THREE.Mesh(new THREE.BoxGeometry(.11,.5,.11), metalDarkMat));
    leg.position.set(px,.25,pz); bench.add(leg);
  }));
  bench.position.set(x,0,z);
  bench.rotation.y = rot;
  group.add(bench);
}

function addPlant(group: THREE.Group, x: number, z: number): void {
  const pot = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(.32,.24,.55,16), potMat));
  pot.position.set(x,.28,z);
  group.add(pot);
  for (let i = 0; i < 7; i++) {
    const leaf = setShadow(new THREE.Mesh(new THREE.BoxGeometry(.08,.55,.28), leafMat), true, false);
    leaf.position.set(x + Math.sin(i)*.18, .75 + (i%3)*.05, z + Math.cos(i)*.18);
    leaf.rotation.set(.45 + i*.08, i*.9, .35);
    group.add(leaf);
  }
}

function addPedestalObject(group: THREE.Group, x: number, z: number, accent: Accent, type: 'sphere' | 'box' | 'ring' = 'sphere'): void {
  const ped = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(.36,.42,.82,20), new THREE.MeshStandardMaterial({color:0x2a2a28, roughness:.45, metalness:.25})));
  ped.position.set(x,.41,z);
  group.add(ped);
  const mat = new THREE.MeshStandardMaterial({color:new THREE.Color(...accent), emissive:new THREE.Color(...accent), emissiveIntensity:.18, metalness:.45, roughness:.28});
  const geo = type === 'box' ? new THREE.BoxGeometry(.72,.42,.72) : type === 'ring' ? new THREE.TorusGeometry(.32,.08,12,30) : new THREE.IcosahedronGeometry(.38,1);
  const obj = setShadow(new THREE.Mesh(geo, mat));
  obj.position.set(x,1.08,z);
  obj.rotation.set(.35,.7,0);
  group.add(obj);
}

function addVitrine(group: THREE.Group, x: number, z: number, rot=0): void {
  const base = setShadow(new THREE.Mesh(new THREE.BoxGeometry(2,.55,.75), new THREE.MeshStandardMaterial({color:0x181818, roughness:.45, metalness:.25})));
  const glass = setShadow(new THREE.Mesh(new THREE.BoxGeometry(1.8,.55,.55), glassMat), false, false);
  const item = setShadow(new THREE.Mesh(new THREE.TorusKnotGeometry(.18,.06,40,8), frameMatShared));
  const vit = new THREE.Group();
  base.position.y = .28; glass.position.y = .83; item.position.y = .86;
  vit.add(base); vit.add(glass); vit.add(item);
  vit.position.set(x,0,z); vit.rotation.y = rot;
  group.add(vit);
}

function addWayfindingSign(group: THREE.Group, x: number, y: number, z: number, rot: number, lines: string[]): void {
  const sign = new THREE.Group();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.35), new THREE.MeshBasicMaterial({map:makeSignTex(lines), transparent:true}));
  front.position.z = 0.005;
  sign.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.35), new THREE.MeshBasicMaterial({color:0x080807}));
  back.rotation.y = Math.PI;
  back.position.z = -0.005;
  sign.add(back);
  [-1.35, 1.35].forEach(px => {
    const rod = new THREE.Mesh(new THREE.BoxGeometry(.045,.7,.045), metalDarkMat);
    rod.position.set(px,.95,0);
    sign.add(rod);
  });
  sign.position.set(x,y,z);
  sign.rotation.y = rot;
  group.add(sign);
}

function addRoomDetails(group: THREE.Group, rm: RoomData, ri: number): void {
  addTrackLights(group, rm);
  if (ri === 0) {
    addBench(group, -4.2, 2.5, Math.PI/2);
    addBench(group, 4.2, 2.5, -Math.PI/2);
    addPedestalObject(group, 0, 0, rm.accent);
    addVitrine(group, -3.8, -1.8, .18);
    addVitrine(group, 3.8, -1.8, -.18);
    addWayfindingSign(group, 0, 3.05, -3.7, 0,
      ['← 自然之境', '↑ 人间烟火', '都市光影 →']);
  } else if (ri === 1) {
    addPlant(group, -4.4, 3.4); addPlant(group, 4.3, -3.5);
    addBench(group, 0, 2.7, 0);
    addPedestalObject(group, -2.8, -.2, rm.accent, 'ring');
  } else if (ri === 2) {
    addVitrine(group, -2.7, 2.6, 0);
    addVitrine(group, 2.7, -2.6, Math.PI);
    addPedestalObject(group, 0, 0, rm.accent, 'box');
  } else if (ri === 3) {
    addBench(group, -3.2, 1.7, Math.PI/2);
    addPlant(group, 3.6, -3.2);
    addVitrine(group, 0, -1.4, 0);
  } else {
    addBench(group, 0, 5.3, 0);
    addVitrine(group, -2.7, 0, Math.PI/2);
    addVitrine(group, 2.7, -3.6, -Math.PI/2);
  }
}

function getDoorWorld(roomIdx: number, side: WallSide, offset: number): DoorWorldPoint {
  const rm = ROOMS[roomIdx], p = ROOM_PLAN[roomIdx];
  if (side === 'front') return {x:p.x + offset, z:p.z + rm.d/2};
  if (side === 'back') return {x:p.x + offset, z:p.z - rm.d/2};
  if (side === 'left') return {x:p.x - rm.w/2, z:p.z + offset};
  return {x:p.x + rm.w/2, z:p.z + offset};
}

function addCorridor(conn: Connection): void {
  const a = getDoorWorld(conn.a, conn.sideA, conn.offsetA);
  const b = getDoorWorld(conn.b, conn.sideB, conn.offsetB);
  const group = new THREE.Group();
  const h = DOOR_H;
  const polyOff = {polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1};
  const corridorSeed = 720 + conn.a * 41 + conn.b * 17;
  const floorMat = makeFloorMaterial(0x151411, corridorSeed, 1.4, 3.2); Object.assign(floorMat, polyOff);
  const wallMat = makeWallMaterial(0x171614, [.42,.36,.28], corridorSeed + 29, 2.2, 1.15); Object.assign(wallMat, polyOff);
  const ceilTex = makeCeilingTex(0x4f4b43); ceilTex.repeat.set(1.2, 1.2);
  const ceilMat = new THREE.MeshStandardMaterial({map:ceilTex, color:0xffffff, emissive:0x2a251c, emissiveIntensity:.22, roughness:.94, metalness:0, side:THREE.DoubleSide, ...polyOff});

  if (Math.abs(a.x - b.x) < .01) {
    const len = Math.abs(a.z - b.z);
    const zc = (a.z + b.z) / 2;
    const x = a.x;
    corridorRects.push({minX:x-CORRIDOR_W/2, maxX:x+CORRIDOR_W/2, minZ:Math.min(a.z,b.z), maxZ:Math.max(a.z,b.z), axis:'z'});
    const floor = setShadow(new THREE.Mesh(new THREE.PlaneGeometry(CORRIDOR_W, len), floorMat), false, true);
    floor.rotation.x = -Math.PI/2; floor.position.set(x, 0, zc); group.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CORRIDOR_W, len), ceilMat);
    ceil.rotation.x = Math.PI/2; ceil.position.set(x, h, zc); group.add(ceil);
    [-1,1].forEach(s => {
      const wall = setShadow(new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat));
      wall.position.set(x + s*CORRIDOR_W/2, h/2, zc);
      wall.rotation.y = s < 0 ? Math.PI/2 : -Math.PI/2;
      group.add(wall);
      occluderMeshes.push(wall);
    });
  } else {
    const len = Math.abs(a.x - b.x);
    const xc = (a.x + b.x) / 2;
    const z = a.z;
    corridorRects.push({minX:Math.min(a.x,b.x), maxX:Math.max(a.x,b.x), minZ:z-CORRIDOR_W/2, maxZ:z+CORRIDOR_W/2, axis:'x'});
    const floor = setShadow(new THREE.Mesh(new THREE.PlaneGeometry(len, CORRIDOR_W), floorMat), false, true);
    floor.rotation.x = -Math.PI/2; floor.position.set(xc, 0, z); group.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(len, CORRIDOR_W), ceilMat);
    ceil.rotation.x = Math.PI/2; ceil.position.set(xc, h, z); group.add(ceil);
    [-1,1].forEach(s => {
      const wall = setShadow(new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat));
      wall.position.set(xc, h/2, z + s*CORRIDOR_W/2);
      wall.rotation.y = s < 0 ? 0 : Math.PI;
      group.add(wall);
      occluderMeshes.push(wall);
    });
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.1, Math.abs(a.x-b.x)) + .1, .06, Math.max(.1, Math.abs(a.z-b.z)) + .1), metalDarkMat);
  rail.position.set((a.x+b.x)/2, h-.12, (a.z+b.z)/2);
  group.add(rail);
  const glow = new THREE.PointLight(0xffdf9a, .75, 8, 1.4);
  glow.position.set((a.x+b.x)/2, h-.45, (a.z+b.z)/2);
  group.add(glow);
  scene.add(group);
}

ROOMS.forEach((rm, ri) => {
  const group = new THREE.Group();
  const w = rm.w, h = rm.h, d = rm.d;
  const plan = ROOM_PLAN[ri];
  group.position.set(plan.x, 0, plan.z);
  roomRects.push({...roomBounds(ri), roomIdx:ri});

  const wallMat = makeWallMaterial(rm.wallColor, rm.accent, 100 + ri * 31, Math.max(1, w/4.5), Math.max(1, h/2.8));
  const sideMat = makeWallMaterial(rm.sideColor, rm.accent, 200 + ri * 31, Math.max(1, d/4.5), Math.max(1, h/2.8));
  const floorMat = makeFloorMaterial(rm.floorColor, 300 + ri * 31, Math.max(1, w/3.1), Math.max(1, d/3.1));
  const ceilTex = makeCeilingTex(0x5a5650);
  ceilTex.repeat.set(Math.max(1, w/7), Math.max(1, d/7));
  const ceilMat = new THREE.MeshStandardMaterial({map:ceilTex, color:0xffffff, emissive:0x302a20, emissiveIntensity:.20, roughness:.96, metalness:0, side:THREE.DoubleSide});

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
  ceil.rotation.x = Math.PI/2; ceil.position.y = h; group.add(ceil);

  addWallWithDoors(group, 'back', w, h, d, wallMat, roomDoors[ri].back);
  addWallWithDoors(group, 'front', w, h, d, wallMat, roomDoors[ri].front);
  addWallWithDoors(group, 'left', w, h, d, sideMat, roomDoors[ri].left);
  addWallWithDoors(group, 'right', w, h, d, sideMat, roomDoors[ri].right);
  addArchitecturalTrim(group, rm, ri);

  let texIdx = 0;
  rm.layout.forEach(item => {
    const photo = rm.photos[item.photo];
    const tex = sharedTextures[texIdx % sharedTextures.length]; texIdx++;
    const fw = 1.8, fh = 1.8;
    const frameGroup = new THREE.Group();
    const border = new THREE.Mesh(new THREE.BoxGeometry(fw+.15, fh+.15, .05), frameMatShared);
    frameGroup.add(border);
    const matBoard = new THREE.Mesh(new THREE.PlaneGeometry(fw+.04, fh+.04), new THREE.MeshStandardMaterial({color:0x15110b, roughness:.82, metalness:0}));
    matBoard.position.z = .026;
    frameGroup.add(matBoard);
    const photoMat = new THREE.MeshStandardMaterial({map:tex, roughness:.6});
    const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), photoMat);
    photoMesh.position.z = .035; frameGroup.add(photoMesh);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), pictureGlassMat);
    glass.position.z = .043;
    frameGroup.add(glass);
    const catchlight = new THREE.Mesh(new THREE.PlaneGeometry(.28, fh*1.08), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.11, side:THREE.DoubleSide}));
    catchlight.position.set(-fw*.26, 0, .048);
    catchlight.rotation.z = -.18;
    frameGroup.add(catchlight);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.35, .42), new THREE.MeshBasicMaterial({map:makePlaqueTex(photo.t), transparent:true}));
    plaque.position.set(0, -1.2, .045);
    frameGroup.add(plaque);
    const y = item.y || 2.2;
    if (item.wall === 'back') {
      frameGroup.position.set(item.x ?? 0, y, -d/2 + .04);
    } else if (item.wall === 'front') {
      frameGroup.position.set(item.x ?? 0, y, d/2 - .04);
      frameGroup.rotation.y = Math.PI;
    } else if (item.wall === 'left') {
      frameGroup.position.set(-w/2 + .04, y, item.z ?? 0);
      frameGroup.rotation.y = Math.PI/2;
    } else if (item.wall === 'right') {
      frameGroup.position.set(w/2 - .04, y, item.z ?? 0);
      frameGroup.rotation.y = -Math.PI/2;
    }
    frameGroup.userData = {roomIdx:ri, photoIdx:item.photo, title:photo.t, desc:photo.d, h:photo.h, s:photo.s};
    group.add(frameGroup);
    frameMeshes.push(frameGroup);
  });

  addRoomDetails(group, rm, ri);

  scene.add(group); roomGroups.push(group);
});

CONNECTIONS.forEach(addCorridor);

export const dustCount = 140;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  const rect = roomRects[Math.floor(Math.random() * roomRects.length)];
  dustPos[i*3] = rect.minX + Math.random() * (rect.maxX - rect.minX);
  dustPos[i*3+1] = Math.random() * 5;
  dustPos[i*3+2] = rect.minZ + Math.random() * (rect.maxZ - rect.minZ);
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({color:0xffeedd, size:.025, transparent:true, opacity:.35, blending:THREE.AdditiveBlending, depthWrite:false});
export const dust = new THREE.Points(dustGeo, dustMat);
scene.add(dust);
