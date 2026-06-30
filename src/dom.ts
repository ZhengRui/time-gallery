export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element #${id}`);
  return el as T;
}

export function canvasContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is unavailable');
  return ctx;
}

export const loader = byId<HTMLDivElement>('loader');
export const overlay = byId<HTMLDivElement>('overlay');
export const hud = byId<HTMLDivElement>('hud');
export const crosshair = byId<HTMLDivElement>('crosshair');
export const fullscreenToggle = byId<HTMLButtonElement>('fullscreen-toggle');
export const roomLabelName = byId<HTMLHeadingElement>('rl-name');
export const roomLabelSub = byId<HTMLParagraphElement>('rl-sub');
export const presentationHud = byId<HTMLDivElement>('presentation-hud');
export const presentationStatus = byId<HTMLSpanElement>('presentation-status');
export const presentationNav = byId<HTMLDivElement>('presentation-nav');
export const presentationPrev = byId<HTMLButtonElement>('presentation-prev');
export const presentationNext = byId<HTMLButtonElement>('presentation-next');
export const photoPopup = byId<HTMLDivElement>('photo-popup');
export const photoPopupCanvas = byId<HTMLCanvasElement>('pp-cv');
export const photoPopupTitle = byId<HTMLHeadingElement>('pp-title');
export const photoPopupDesc = byId<HTMLParagraphElement>('pp-desc');
export const photoPopupClose = byId<HTMLDivElement>('pp-close');
export const minimapCanvas = byId<HTMLCanvasElement>('mm-cv');
export const touchControls = byId<HTMLDivElement>('touch-controls');
export const touchMove = byId<HTMLDivElement>('touch-move');
export const touchStick = byId<HTMLDivElement>('touch-stick');
