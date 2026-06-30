import {
  CLUB_INTRO_ASSET_MAP,
  CLUB_INTRO_EXHIBIT_MAP,
  CLUB_INTRO_PRESENTATION_CUES,
  CLUB_INTRO_PRESENTATION_GROUPS,
} from './clubIntroData';
import type { FrameUserData, PresentationCue } from './types';

export const PRESENTATION_CUE_SELECTED_EVENT = 'club-intro:presentation-cue-selected';

export interface ResolvedPresentationFrameData {
  data: FrameUserData;
  cueIndex: number | null;
}

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

export function frameDataForPresentationCue(cue: PresentationCue): FrameUserData | null {
  const exhibit = CLUB_INTRO_EXHIBIT_MAP.get(cue.exhibitId);
  if (!exhibit) return null;

  const assets = (exhibit.assetIds || [])
    .map(id => CLUB_INTRO_ASSET_MAP.get(id))
    .filter(asset => !!asset);
  const imageSrcs = assets
    .map(asset => asset?.localPath || asset?.sourceUrl)
    .filter((src): src is string => !!src);

  return {
    id: exhibit.id,
    roomIdx: exhibit.roomIdx,
    title: cue.title,
    desc: cue.desc,
    descSegments: cue.descSegments,
    h: accentHue(exhibit.accent),
    s: 62,
    kind: exhibit.kind,
    imageSrc: imageSrcs[0],
    imageSrcs,
    lines: exhibit.lines,
    accent: exhibit.accent,
  };
}

const cueById = new Map<string, {cue: PresentationCue; index: number}>();
const defaultCueByExhibitId = new Map<string, {cue: PresentationCue; index: number}>();

CLUB_INTRO_PRESENTATION_CUES.forEach((cue, index) => {
  cueById.set(cue.id, {cue, index});
  if (!defaultCueByExhibitId.has(cue.exhibitId)) {
    defaultCueByExhibitId.set(cue.exhibitId, {cue, index});
  }
});

CLUB_INTRO_EXHIBIT_MAP.forEach(exhibit => {
  if (!exhibit.presentationCueId) return;
  const match = cueById.get(exhibit.presentationCueId);
  if (match) defaultCueByExhibitId.set(exhibit.id, match);
});

CLUB_INTRO_PRESENTATION_GROUPS.forEach(group => {
  const firstCueIndex = CLUB_INTRO_PRESENTATION_CUES.findIndex(cue => cue.groupId === group.id);
  if (firstCueIndex < 0) return;
  const firstCue = CLUB_INTRO_PRESENTATION_CUES[firstCueIndex];
  group.exhibitIds.forEach(exhibitId => {
    if (!defaultCueByExhibitId.has(exhibitId)) {
      defaultCueByExhibitId.set(exhibitId, {cue: firstCue, index: firstCueIndex});
    }
  });
});

export function resolvePresentationFrameData(data: FrameUserData): ResolvedPresentationFrameData {
  if (!data.id) return {data, cueIndex: null};

  const match = defaultCueByExhibitId.get(data.id);
  if (!match) return {data, cueIndex: null};

  return {
    data: frameDataForPresentationCue(match.cue) || data,
    cueIndex: match.index,
  };
}
