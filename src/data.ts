import type { Connection, PlanPoint, RoomData } from './types';

export const ROOMS: RoomData[] = [
  {
    name: 'Toastmasters International',
    sub: 'Global Communication Network',
    w: 17,
    h: 5.2,
    d: 12,
    wallColor: 0x072f3b,
    sideColor: 0x062633,
    floorColor: 0x101815,
    accent: [0.1, 0.56, 0.82],
    layout: [],
    photos: [],
  },
  {
    name: 'SoarHigh Toastmasters Club',
    sub: 'Family, Fun, Growth',
    w: 17,
    h: 5.2,
    d: 13,
    wallColor: 0x103443,
    sideColor: 0x1f2939,
    floorColor: 0x161310,
    accent: [0.92, 0.48, 0.22],
    layout: [],
    photos: [],
  },
];

export const ROOM_PLAN: PlanPoint[] = [
  { x: 0, z: -5 },
  { x: 0, z: -22 },
];

export const CONNECTIONS: Connection[] = [
  { a: 0, b: 1, sideA: 'back', sideB: 'front', offsetA: 0, offsetB: 0 },
];
