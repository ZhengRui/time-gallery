import * as THREE from 'three';
import { makeAssetMaterial, makeExhibitTexture } from './assets';
import {
  makePlaqueTex,
  pictureGlassMat,
} from './materials';
import type { ClubIntroAsset, ExhibitData, FrameUserData, RoomData } from './types';

export const exhibitMeshes = new Map<string, THREE.Group>();

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

function placeOnWall(group: THREE.Group, exhibit: ExhibitData, room: RoomData): void {
  const inset = 0.07;
  const y = exhibit.y ?? 2.35;
  if (exhibit.wall === 'back') {
    group.position.set(exhibit.x ?? 0, y, -room.d / 2 + inset);
  } else if (exhibit.wall === 'front') {
    group.position.set(exhibit.x ?? 0, y, room.d / 2 - inset);
    group.rotation.y = Math.PI;
  } else if (exhibit.wall === 'left') {
    group.position.set(-room.w / 2 + inset, y, exhibit.z ?? 0);
    group.rotation.y = Math.PI / 2;
  } else {
    group.position.set(room.w / 2 - inset, y, exhibit.z ?? 0);
    group.rotation.y = -Math.PI / 2;
  }
}

function makeFrameMaterial(exhibit: ExhibitData): THREE.MeshStandardMaterial {
  const warmWood = exhibit.roomIdx === 0 ? 0x5b4630 : 0x60452d;
  return new THREE.MeshStandardMaterial({
    color: warmWood,
    metalness: 0.16,
    roughness: 0.36,
  });
}

function makeLinerMaterial(exhibit: ExhibitData): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: exhibit.accent || '#c9a96e',
    metalness: 0.48,
    roughness: 0.22,
  });
}

function addFrameRails(
  group: THREE.Group,
  width: number,
  height: number,
  rail: number,
  depth: number,
  material: THREE.Material,
  z = 0.08,
): void {
  const topBottomGeo = new THREE.BoxGeometry(width + rail * 2, rail, depth);
  const sideGeo = new THREE.BoxGeometry(rail, height, depth);
  const top = new THREE.Mesh(topBottomGeo, material);
  const bottom = new THREE.Mesh(topBottomGeo, material);
  const left = new THREE.Mesh(sideGeo, material);
  const right = new THREE.Mesh(sideGeo, material);
  top.position.set(0, height / 2 + rail / 2, z);
  bottom.position.set(0, -height / 2 - rail / 2, z);
  left.position.set(-width / 2 - rail / 2, 0, z);
  right.position.set(width / 2 + rail / 2, 0, z);
  [top, bottom, left, right].forEach(mesh => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
}

function addGlassCatchlight(group: THREE.Group, width: number, height: number): void {
  const catchlight = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.18, height * 1.05),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  catchlight.position.set(-width * 0.26, height * 0.02, 0.119);
  catchlight.rotation.z = -0.16;
  group.add(catchlight);
}

function mountedAssetSize(asset: ClubIntroAsset, maxW: number, maxH: number): { width: number; height: number } {
  const ratio = asset.aspect || (asset.kind === 'poster' ? 0.68 : 1.5);
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return { width, height };
}

function addPrimaryAsset(
  group: THREE.Group,
  exhibit: ExhibitData,
  asset: ClubIntroAsset,
): void {
  const matInset = 0.1;
  const maxW = Math.max(0.1, exhibit.width - matInset * 2);
  const maxH = Math.max(0.1, exhibit.height - matInset * 2);
  const size = mountedAssetSize(asset, maxW, maxH);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfc5b0, roughness: 0.78, metalness: 0 });
  const matBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(exhibit.width, exhibit.height),
    mat,
  );
  matBoard.position.z = 0.052;
  group.add(matBoard);

  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(size.width, size.height),
    makeAssetMaterial(asset, exhibit.accent),
  );
  photo.position.z = 0.092;
  group.add(photo);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(size.width, size.height), pictureGlassMat);
  glass.position.z = 0.112;
  group.add(glass);
  addGlassCatchlight(group, size.width, size.height);
}

function addWallSign(group: THREE.Group, exhibit: ExhibitData): void {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(exhibit.width + 0.16, exhibit.height + 0.16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 }),
  );
  shadow.position.set(0.04, -0.04, 0.028);
  group.add(shadow);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(exhibit.width, exhibit.height),
    new THREE.MeshStandardMaterial({
      map: makeExhibitTexture(exhibit),
      roughness: 0.42,
      metalness: 0.08,
    }),
  );
  face.position.z = 0.06;
  group.add(face);

  addFrameRails(group, exhibit.width, exhibit.height, 0.035, 0.055, makeLinerMaterial(exhibit), 0.078);
}

export function addClubIntroExhibit(
  parent: THREE.Group,
  room: RoomData,
  exhibit: ExhibitData,
  assetMap: Map<string, ClubIntroAsset>,
): THREE.Group {
  const assets = (exhibit.assetIds || [])
    .map(id => assetMap.get(id))
    .filter((asset): asset is ClubIntroAsset => !!asset);
  const visualAssets = assets.filter(asset => asset.kind === 'photo' || asset.kind === 'poster');
  const isWallSign = exhibit.kind === 'slogan' || exhibit.kind === 'qr';
  const shadowPad = 0.22;
  const shadowOpacity = 0.2;
  const shadowOffset = 0.045;

  const group = new THREE.Group();
  group.rotation.z = exhibit.rotationZ ?? 0;

  if (isWallSign) {
    addWallSign(group, exhibit);
  } else {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(
        exhibit.width + shadowPad,
        exhibit.height + shadowPad,
      ),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: shadowOpacity,
      }),
    );
    shadow.position.set(shadowOffset, -shadowOffset, 0.018);
    group.add(shadow);

    if (visualAssets.length > 0) {
      addPrimaryAsset(group, exhibit, visualAssets[0]);
    } else {
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(exhibit.width, exhibit.height),
        new THREE.MeshStandardMaterial({
          map: makeExhibitTexture(exhibit),
          roughness: 0.56,
          metalness: 0,
        }),
      );
      face.position.z = 0.058;
      group.add(face);
    }
    addFrameRails(group, exhibit.width, exhibit.height, 0.072, 0.08, makeFrameMaterial(exhibit), 0.084);
    addFrameRails(group, exhibit.width, exhibit.height, 0.018, 0.03, makeLinerMaterial(exhibit), 0.116);
  }

  if (exhibit.showPlaque !== false) {
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(exhibit.width * 0.66, 2.2), 0.43),
      new THREE.MeshBasicMaterial({ map: makePlaqueTex(exhibit.title), transparent: true }),
    );
    plaque.position.set(0, -exhibit.height / 2 - 0.4, 0.09);
    group.add(plaque);
  }

  placeOnWall(group, exhibit, room);

  const popupImageAssets = exhibit.kind === 'timeline' || isWallSign ? [] : assets;
  const imageSrcs = popupImageAssets
    .map(asset => asset.localPath || asset.sourceUrl)
    .filter((src): src is string => !!src);
  const userData: FrameUserData = {
    id: exhibit.id,
    roomIdx: exhibit.roomIdx,
    title: exhibit.title,
    desc: exhibit.desc,
    h: accentHue(exhibit.accent),
    s: 62,
    kind: exhibit.kind,
    imageSrc: imageSrcs[0],
    imageSrcs,
    lines: exhibit.lines,
    accent: exhibit.accent,
  };
  group.userData = userData;

  parent.add(group);
  exhibitMeshes.set(exhibit.id, group);
  return group;
}

export function getExhibitMesh(id: string): THREE.Group | undefined {
  return exhibitMeshes.get(id);
}
