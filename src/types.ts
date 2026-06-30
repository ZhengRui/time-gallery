export type WallSide = 'front' | 'back' | 'left' | 'right';
export type Axis = 'x' | 'z';
export type Accent = [number, number, number];
export type ExhibitKind = 'photo' | 'poster' | 'data' | 'keyword' | 'timeline' | 'map' | 'qr' | 'slogan' | 'circle-photo';
export type AssetKind = 'photo' | 'poster' | 'graphic' | 'qr' | 'logo';
export type AssetRole =
  | 'toastmasters-scale'
  | 'ordinary-photo'
  | 'network'
  | 'public-speaking'
  | 'leadership'
  | 'soarhigh-history'
  | 'family'
  | 'fun'
  | 'growth'
  | 'final-cta';

export interface PhotoData {
  t: string;
  d: string;
  h: number;
  s: number;
}

export interface LayoutItem {
  wall: WallSide;
  x?: number;
  z?: number;
  y?: number;
  photo: number;
}

export interface RoomData {
  name: string;
  sub: string;
  w: number;
  h: number;
  d: number;
  wallColor: number;
  sideColor: number;
  floorColor: number;
  accent: Accent;
  layout: LayoutItem[];
  photos: PhotoData[];
}

export interface ClubIntroAsset {
  id: string;
  kind: AssetKind;
  title: string;
  role: AssetRole;
  aspect?: number;
  sourceUrl?: string;
  localPath?: string;
  meetingNo?: number;
  meetingTheme?: string;
  caption?: string;
  credit?: string;
}

export interface ExhibitData {
  id: string;
  kind: ExhibitKind;
  roomIdx: number;
  wall: WallSide;
  title: string;
  desc: string;
  x?: number;
  z?: number;
  y?: number;
  width: number;
  height: number;
  rotationZ?: number;
  assetIds?: string[];
  lines?: string[];
  accent?: string;
  showPlaque?: boolean;
}

export interface PresentationGroup {
  id: string;
  title: string;
  roomIdx: number;
  exhibitIds: string[];
}

export interface PresentationCamera {
  position: [number, number, number];
  lookAt: [number, number, number];
  durationMs: number;
}

export interface PresentationCue {
  id: string;
  groupId: string;
  exhibitId: string;
  title: string;
  desc: string;
  descSegments?: PopupTextSegment[];
  spokenCue: string;
  camera: PresentationCamera;
}

export type PopupTextTone = 'strong' | 'stat' | 'accent' | 'warm' | 'italic';

export interface PopupTextSegment {
  text: string;
  tone?: PopupTextTone;
  bullet?: boolean;
  breakAfter?: boolean;
}

export interface PlanPoint {
  x: number;
  z: number;
}

export interface Connection {
  a: number;
  b: number;
  sideA: WallSide;
  sideB: WallSide;
  offsetA: number;
  offsetB: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RoomRect extends Rect {
  roomIdx: number;
}

export interface CorridorRect extends Rect {
  axis: Axis;
}

export interface DoorWorldPoint {
  x: number;
  z: number;
}

export interface FrameUserData {
  id?: string;
  roomIdx?: number;
  photoIdx?: number;
  title: string;
  desc: string;
  descSegments?: PopupTextSegment[];
  h?: number;
  s?: number;
  kind?: ExhibitKind;
  imageSrc?: string;
  imageSrcs?: string[];
  lines?: string[];
  accent?: string;
}
