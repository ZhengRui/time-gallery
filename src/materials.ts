import * as THREE from 'three';
import { canvasContext2d } from './dom';
import { renderer } from './scene';
import type { Accent } from './types';

function makeArtTex(h: number, s: number, title: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = canvasContext2d(c);
  const g = ctx.createRadialGradient(256,256,0,256,256,360);
  g.addColorStop(0, `hsl(${h},${s}%,30%)`);
  g.addColorStop(0.5, `hsl(${(h+20)%360},${s*.8}%,16%)`);
  g.addColorStop(1, `hsl(${(h+40)%360},${s*.6}%,7%)`);
  ctx.fillStyle = g; ctx.fillRect(0,0,512,512);
  for(let i=0;i<8;i++){
    ctx.beginPath(); ctx.moveTo(Math.random()*512,Math.random()*512);
    for(let j=0;j<4;j++) ctx.bezierCurveTo(Math.random()*512,Math.random()*512,Math.random()*512,Math.random()*512,Math.random()*512,Math.random()*512);
    ctx.strokeStyle=`hsla(${(h+i*45)%360},${s}%,55%,${.05+Math.random()*.06})`; ctx.lineWidth=2+Math.random()*5; ctx.stroke();
  }
  for(let i=0;i<5;i++){
    const x=Math.random()*512,y=Math.random()*512,r=30+Math.random()*100;
    const og=ctx.createRadialGradient(x,y,0,x,y,r);
    og.addColorStop(0,`hsla(${(h+i*55)%360},${s}%,60%,${.08+Math.random()*.1})`);
    og.addColorStop(1,`hsla(${(h+i*55)%360},${s}%,35%,0)`);
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=og;ctx.fill();
  }
  ctx.fillStyle='rgba(255,255,255,.85)';
  ctx.font='bold 28px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(title,256,256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCeilingTex(baseHex: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  const size = 384;
  c.width = c.height = size;
  const ctx = canvasContext2d(c);
  const rand = seededRandom(baseHex);
  const base = `#${baseHex.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = base;
  ctx.fillRect(0,0,size,size);
  const img = ctx.getImageData(0,0,size,size);
  const bytes = colorBytes(baseHex);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const grain = (rand() - .5) * 18 + Math.sin(x*.05 + y*.02) * 4;
      img.data[i] = clamp255(bytes.r + grain);
      img.data[i+1] = clamp255(bytes.g + grain);
      img.data[i+2] = clamp255(bytes.b + grain);
    }
  }
  ctx.putImageData(img,0,0);
  ctx.fillStyle = 'rgba(255,255,255,.04)';
  for (let y = 0; y < size; y += 48) {
    for (let x = 0; x < size; x += 96) {
      ctx.fillRect(x + 5, y + 5, 86, 38);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.13)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= size; x += 48) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.stroke(); }
  for (let y = 0; y <= size; y += 48) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  for (let i = 0; i < 5; i++) {
    const x = 20 + (i * 53) % 320;
    const y = 25 + (i * 73) % 315;
    ctx.fillRect(x, y, 56, 14);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(x + 7 + k * 11, y + 3); ctx.lineTo(x + 7 + k * 11, y + 12); ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makePlaqueTex(title: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const ctx = canvasContext2d(c);
  ctx.fillStyle = 'rgba(12,12,10,.92)';
  ctx.fillRect(0,0,512,160);
  ctx.strokeStyle = 'rgba(201,169,110,.75)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8,8,496,144);
  ctx.fillStyle = 'rgba(230,214,176,.95)';
  ctx.font = 'bold 42px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title,256,78);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSignTex(lines: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 768; c.height = 320;
  const ctx = canvasContext2d(c);
  ctx.fillStyle = 'rgba(8,8,7,.95)';
  ctx.fillRect(0,0,768,320);
  ctx.strokeStyle = 'rgba(201,169,110,.82)';
  ctx.lineWidth = 10;
  ctx.strokeRect(10,10,748,300);
  ctx.fillStyle = 'rgba(235,222,190,.95)';
  ctx.font = 'bold 42px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, 384, 82 + i * 78));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v | 0));
}

function colorBytes(hex: number): { r: number; g: number; b: number } {
  return {
    r:(hex >> 16) & 255,
    g:(hex >> 8) & 255,
    b:hex & 255,
  };
}

function themedWallBase(baseHex: number, accent: Accent): { r: number; g: number; b: number } {
  const base = colorBytes(baseHex);
  return {
    r:clamp255(base.r * 1.35 + 38 + accent[0] * 58),
    g:clamp255(base.g * 1.35 + 38 + accent[1] * 58),
    b:clamp255(base.b * 1.35 + 38 + accent[2] * 58),
  };
}

function prepTexture<T extends THREE.Texture>(tex: T, repeatX=1, repeatY=1, srgb=true): T {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function makeWallTex(baseHex: number, accent: Accent, seed=1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = canvasContext2d(c);
  const base = themedWallBase(baseHex, accent);
  const rand = seededRandom(seed);
  const img = ctx.createImageData(c.width, c.height);

  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const plaster = Math.sin((x + seed * 19) * .031) * 5 + Math.sin((y + seed * 37) * .017) * 6;
      const grain = (rand() - .5) * 24;
      const verticalDirt = Math.max(0, (y / c.height) - .76) * 16;
      const softCloud = Math.sin((x * .011) + (y * .008) + seed) * 8;
      const v = plaster + grain + softCloud - verticalDirt;
      img.data[i] = clamp255(base.r + v);
      img.data[i+1] = clamp255(base.g + v);
      img.data[i+2] = clamp255(base.b + v);
      img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.globalCompositeOperation = 'screen';
  const accentRgb = `${Math.round(accent[0]*255)},${Math.round(accent[1]*255)},${Math.round(accent[2]*255)}`;
  for (let i = 0; i < 5; i++) {
    const x = rand() * c.width, y = rand() * c.height, r = 120 + rand() * 220;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${accentRgb},${.045 + rand() * .055})`);
    g.addColorStop(1, `rgba(${accentRgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x-r, y-r, r*2, r*2);
  }

  ctx.strokeStyle = `rgba(${accentRgb},.14)`;
  for (let i = 0; i < 20; i++) {
    const x = rand() * c.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= c.height; y += 96) {
      ctx.lineTo(x + Math.sin(y * .018 + seed + i) * (8 + rand() * 18), y);
    }
    ctx.lineWidth = .6 + rand() * 1.8;
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 10; i++) {
    const x = rand() * c.width, y = rand() * c.height, r = 40 + rand() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${.018 + rand() * .035})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x-r, y-r, r*2, r*2);
  }

  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  for (let i = 0; i < 6; i++) {
    const sx = rand() * c.width, sy = rand() * c.height;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    let x = sx, y = sy;
    for (let k = 0; k < 5; k++) {
      x += (rand() - .5) * 85;
      y += 22 + rand() * 65;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = .55 + rand() * .7;
    ctx.stroke();
  }

  return prepTexture(new THREE.CanvasTexture(c));
}

function makeFloorTex(baseHex: number, seed=1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = canvasContext2d(c);
  const base = colorBytes(baseHex);
  const rand = seededRandom(seed);
  ctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
  ctx.fillRect(0, 0, c.width, c.height);

  const plankH = 56;
  for (let y = 0; y < c.height; y += plankH) {
    const tone = (rand() - .5) * 28;
    const grad = ctx.createLinearGradient(0, y, c.width, y + plankH);
    grad.addColorStop(0, `rgb(${clamp255(base.r+tone+12)},${clamp255(base.g+tone+10)},${clamp255(base.b+tone+8)})`);
    grad.addColorStop(.5, `rgb(${clamp255(base.r+tone-2)},${clamp255(base.g+tone-2)},${clamp255(base.b+tone-2)})`);
    grad.addColorStop(1, `rgb(${clamp255(base.r+tone-16)},${clamp255(base.g+tone-14)},${clamp255(base.b+tone-12)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, c.width, plankH);

    ctx.strokeStyle = 'rgba(255,255,255,.055)';
    for (let i = 0; i < 7; i++) {
      const yy = y + 12 + rand() * (plankH - 24);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      for (let x = 0; x <= c.width; x += 80) {
        ctx.lineTo(x, yy + Math.sin(x * .015 + i + seed) * (2 + rand() * 4));
      }
      ctx.lineWidth = .8 + rand() * 1.2;
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, y + .5);
    ctx.lineTo(c.width, y + .5);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 18; i++) {
    const x = rand() * c.width, y = rand() * c.height;
    ctx.strokeStyle = `rgba(255,245,220,${.035 + rand() * .07})`;
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    ctx.ellipse(x, y, 30 + rand()*120, 3 + rand()*10, rand()*Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 12; i++) {
    const x = rand() * c.width, y = rand() * c.height, r = 35 + rand() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${.05 + rand()*.08})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x-r, y-r, r*2, r*2);
  }

  return prepTexture(new THREE.CanvasTexture(c));
}

export function makeWallMaterial(baseHex: number, accent: Accent, seed: number, repeatX: number, repeatY: number): THREE.MeshStandardMaterial {
  const map = makeWallTex(baseHex, accent, seed);
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map,
    roughness:.96,
    metalness:0,
    side:THREE.DoubleSide,
  });
}

export function makeFloorMaterial(baseHex: number, seed: number, repeatX: number, repeatY: number): THREE.MeshStandardMaterial {
  const map = makeFloorTex(baseHex, seed);
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map,
    roughness:.82,
    metalness:.05,
  });
}

export const sharedTextures = [
  makeArtTex(40, 30, '序·光'),
  makeArtTex(220, 40, '序·影'),
];

export const frameMatShared = new THREE.MeshStandardMaterial({color:0x8a7040, metalness:.5, roughness:.3});
export const trimMatShared = new THREE.MeshStandardMaterial({color:0x786646, metalness:.12, roughness:.42});
export const metalDarkMat = new THREE.MeshStandardMaterial({color:0x080807, metalness:.55, roughness:.35});
export const warmLightMat = new THREE.MeshStandardMaterial({color:0xfff0c8, emissive:0xffd486, emissiveIntensity:1.6, roughness:.2});
export const glassMat = new THREE.MeshStandardMaterial({color:0xd8ecff, transparent:true, opacity:.2, metalness:0, roughness:.05});
export const pictureGlassMat = new THREE.MeshStandardMaterial({color:0xffffff, transparent:true, opacity:.11, metalness:0, roughness:.02, side:THREE.DoubleSide});
export const woodMat = new THREE.MeshStandardMaterial({color:0x4a3425, roughness:.55, metalness:.08});
export const leafMat = new THREE.MeshStandardMaterial({color:0x244629, roughness:.7, metalness:0});
export const potMat = new THREE.MeshStandardMaterial({color:0x2a2420, roughness:.7, metalness:.1});
