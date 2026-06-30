import * as THREE from 'three';
import { canvasContext2d } from './dom';
import { renderer } from './scene';
import type { ClubIntroAsset, ExhibitData } from './types';

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

function prepTexture<T extends THREE.Texture>(tex: T): T {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function parseAccent(accent?: string): { r: number; g: number; b: number } {
  const hex = (accent || '#c9a96e').replace('#', '');
  const n = Number.parseInt(hex.length === 3
    ? hex.split('').map(ch => ch + ch).join('')
    : hex, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function rgba(accent: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${accent.r},${accent.g},${accent.b},${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((ln, i) => {
    const rendered = i === maxLines - 1 && lines.length > maxLines ? `${ln}...` : ln;
    ctx.fillText(rendered, x, y + i * lineHeight);
  });

  return y + Math.min(lines.length, maxLines) * lineHeight;
}

function fillPanelBackground(ctx: CanvasRenderingContext2D, w: number, h: number, accentHex?: string): void {
  const accent = parseAccent(accentHex);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#06161d');
  bg.addColorStop(0.52, '#082731');
  bg.addColorStop(1, '#101318');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 20, w * 0.5, h * 0.45, w * 0.72);
  glow.addColorStop(0, rgba(accent, 0.22));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 2;
  for (let x = 56; x < w; x += 94) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 88, h);
    ctx.stroke();
  }

  ctx.strokeStyle = rgba(accent, 0.7);
  ctx.lineWidth = 5;
  ctx.strokeRect(30, 30, w - 60, h - 60);
  ctx.strokeStyle = 'rgba(255,255,255,.13)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(48, 48, w - 96, h - 96);
}

function drawBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, accentHex?: string): void {
  const accent = parseAccent(accentHex);
  ctx.font = '700 34px sans-serif';
  const textW = ctx.measureText(text).width;
  roundRect(ctx, x, y, textW + 42, 62, 30);
  ctx.fillStyle = rgba(accent, 0.95);
  ctx.fill();
  ctx.fillStyle = '#08131a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 21, y + 31);
}

function drawStatGrid(ctx: CanvasRenderingContext2D, exhibit: ExhibitData, w: number, h: number): void {
  const lines = exhibit.lines || [];
  const accent = parseAccent(exhibit.accent);
  const cols = Math.min(5, lines.length);
  const blockW = (w - 170) / cols;
  const startX = 85;
  const baselineY = Math.min(h * 0.7, h - 135);
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, baselineY - 106);
  ctx.lineTo(w - startX, baselineY - 106);
  ctx.moveTo(startX, baselineY + 52);
  ctx.lineTo(w - startX, baselineY + 52);
  ctx.stroke();
  lines.forEach((line, i) => {
    const x = startX + i * blockW;
    const [num, ...labelParts] = line.split(' ');
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, baselineY - 82);
      ctx.lineTo(x, baselineY + 30);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(num, x + blockW / 2, baselineY - 34);
    ctx.fillStyle = rgba(accent, 0.96);
    ctx.font = '800 22px sans-serif';
    ctx.fillText(labelParts.join(' '), x + blockW / 2, baselineY + 22);
  });
}

function drawTimeline(ctx: CanvasRenderingContext2D, exhibit: ExhibitData, w: number, h: number): void {
  const accent = parseAccent(exhibit.accent);
  const entries = [
    { year: '2014', label: 'Shenzhen Airline Corporate Club' },
    { year: '2016', label: 'Public Club' },
    { year: '2024', label: '100% English Speaking Club' },
  ];

  ctx.strokeStyle = rgba(accent, 0.86);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(130, h * 0.62);
  ctx.bezierCurveTo(w * 0.35, h * 0.35, w * 0.62, h * 0.84, w - 130, h * 0.45);
  ctx.stroke();

  entries.forEach((entry, i) => {
    const x = 160 + i * ((w - 320) / 2);
    const y = i === 1 ? h * 0.48 : h * 0.67;
    roundRect(ctx, x - 145, y - 86, 290, 146, 24);
    ctx.fillStyle = i === 1 ? 'rgba(155,89,182,.88)' : 'rgba(255,255,255,.12)';
    ctx.fill();
    ctx.strokeStyle = rgba(accent, 0.55);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = i === 2 ? '#fff45a' : '#ff9d36';
    ctx.font = '900 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.year, x, y - 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px sans-serif';
    drawWrappedText(ctx, entry.label, x, y + 20, 250, 32, 2);
  });
}

function drawQrPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, accentHex?: string): void {
  const accent = parseAccent(accentHex);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, size, size, 12);
  ctx.fill();
  const cells = 17;
  const cell = size / cells;
  ctx.fillStyle = '#07131a';
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const finder =
        (row < 5 && col < 5) ||
        (row < 5 && col > cells - 6) ||
        (row > cells - 6 && col < 5);
      const bit = finder || ((row * 7 + col * 11 + row * col) % 5 < 2);
      if (!bit) continue;
      ctx.fillRect(x + col * cell + 1, y + row * cell + 1, cell - 2, cell - 2);
    }
  }
  ctx.fillStyle = rgba(accent, 0.95);
  ctx.font = '900 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SOAR', x + size / 2, y + size / 2);
}

function drawKeywordPanel(ctx: CanvasRenderingContext2D, exhibit: ExhibitData, w: number, h: number): void {
  const lines = exhibit.lines || [];
  const startY = h * 0.58;
  lines.forEach((line, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawBadge(ctx, line, 92 + col * (w * 0.42), startY + row * 82, exhibit.accent);
  });
}

export function makeExhibitTexture(exhibit: ExhibitData): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = Math.max(640, Math.round(1200 * (exhibit.height / exhibit.width)));
  const ctx = canvasContext2d(canvas);
  const w = canvas.width;
  const h = canvas.height;

  fillPanelBackground(ctx, w, h, exhibit.accent);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = exhibit.kind === 'slogan' ? '900 96px sans-serif' : '900 64px sans-serif';
  drawWrappedText(ctx, exhibit.title, w / 2, h * 0.18, w - 180, exhibit.kind === 'slogan' ? 105 : 72, 2);

  ctx.fillStyle = 'rgba(245,240,232,.86)';
  ctx.font = '600 30px sans-serif';
  drawWrappedText(ctx, exhibit.desc, w / 2, h * 0.35, w - 200, 42, 3);

  if (exhibit.kind === 'map' || exhibit.kind === 'data') {
    drawStatGrid(ctx, exhibit, w, h);
  } else if (exhibit.kind === 'timeline') {
    drawTimeline(ctx, exhibit, w, h);
  } else if (exhibit.kind === 'keyword') {
    drawKeywordPanel(ctx, exhibit, w, h);
  } else if (exhibit.kind === 'qr') {
    drawQrPattern(ctx, 110, h - 340, 250, exhibit.accent);
    drawQrPattern(ctx, w - 360, h - 340, 250, exhibit.accent);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('www.soarhigh.top', w / 2, h - 214);
    ctx.font = '700 34px sans-serif';
    ctx.fillText('Mini app: 搜嗨头马', w / 2, h - 145);
  } else if (exhibit.kind === 'slogan') {
    ctx.fillStyle = '#ffe58a';
    ctx.font = '900 84px sans-serif';
    ctx.fillText('Take Me Fly', w / 2, h * 0.72);
  }

  return prepTexture(new THREE.CanvasTexture(canvas));
}

export function makeAssetFallbackTexture(asset: ClubIntroAsset, accentHex?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = asset.kind === 'poster' ? 1200 : 680;
  const ctx = canvasContext2d(canvas);
  const w = canvas.width;
  const h = canvas.height;
  fillPanelBackground(ctx, w, h, accentHex);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawWrappedText(ctx, asset.title, w / 2, h * 0.38, w - 120, 68, 3);

  if (asset.caption) {
    ctx.fillStyle = 'rgba(245,240,232,.82)';
    ctx.font = '600 30px sans-serif';
    drawWrappedText(ctx, asset.caption, w / 2, h * 0.62, w - 150, 40, 4);
  }

  if (asset.meetingNo) {
    drawBadge(ctx, `#${asset.meetingNo}`, 48, 48, accentHex);
  }

  return prepTexture(new THREE.CanvasTexture(canvas));
}

export function makeAssetMaterial(asset: ClubIntroAsset, accentHex?: string): THREE.MeshStandardMaterial {
  const fallback = makeAssetFallbackTexture(asset, accentHex);
  const material = new THREE.MeshStandardMaterial({
    map: fallback,
    roughness: 0.56,
    metalness: 0,
  });
  const url = asset.localPath || asset.sourceUrl;
  if (!url) return material;

  textureLoader.load(
    url,
    texture => {
      prepTexture(texture);
      material.map = texture;
      material.needsUpdate = true;
    },
    undefined,
    () => {
      material.map = fallback;
      material.needsUpdate = true;
    },
  );

  return material;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
): void {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
}

function makeCircleAssetFallbackTexture(accentHex?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvasContext2d(canvas);
  const accent = parseAccent(accentHex);
  const glow = ctx.createRadialGradient(512, 430, 80, 512, 512, 620);
  glow.addColorStop(0, rgba(accent, 0.55));
  glow.addColorStop(0.42, '#123642');
  glow.addColorStop(1, '#061015');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,.1)';
  ctx.lineWidth = 3;
  for (let x = 72; x < canvas.width; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 180, canvas.height);
    ctx.stroke();
  }
  return prepTexture(new THREE.CanvasTexture(canvas));
}

function makeCircleTextureFromImage(image: HTMLImageElement): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvasContext2d(canvas);
  drawImageCover(ctx, image, canvas.width, canvas.height);
  return prepTexture(new THREE.CanvasTexture(canvas));
}

export function makeCircleAssetMaterial(asset: ClubIntroAsset, accentHex?: string): THREE.MeshStandardMaterial {
  const fallback = makeCircleAssetFallbackTexture(accentHex);
  const material = new THREE.MeshStandardMaterial({
    map: fallback,
    roughness: 0.52,
    metalness: 0,
  });
  const url = asset.localPath || asset.sourceUrl;
  if (!url) return material;

  textureLoader.load(
    url,
    texture => {
      const image = texture.image as HTMLImageElement;
      if (!image) return;
      material.map = makeCircleTextureFromImage(image);
      material.needsUpdate = true;
      texture.dispose();
    },
    undefined,
    () => {
      material.map = fallback;
      material.needsUpdate = true;
    },
  );

  return material;
}
