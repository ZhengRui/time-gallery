export type WallSide = 'front' | 'back' | 'left' | 'right';
export type Axis = 'x' | 'z';
export type Accent = [number, number, number];

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
  roomIdx: number;
  photoIdx: number;
  title: string;
  desc: string;
  h: number;
  s: number;
}
