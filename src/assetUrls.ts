import type { ClubIntroAsset } from './types';

const CLUB_INTRO_LOCAL_PREFIX = '/assets/club-intro/';
const DEFAULT_GALLERY_IMAGE_BASE_URL = 'https://soarhigh.oss-cn-shenzhen.aliyuncs.com/public/gallery/images';

function galleryImageBaseUrl(): string {
  const configured = import.meta.env.VITE_GALLERY_IMAGE_BASE_URL?.trim();
  return (configured || DEFAULT_GALLERY_IMAGE_BASE_URL).replace(/\/+$/, '');
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export function resolveClubIntroAssetUrl(
  asset: Pick<ClubIntroAsset, 'localPath' | 'sourceUrl'> | null | undefined,
): string | undefined {
  const localPath = asset?.localPath?.trim();
  if (localPath?.startsWith(CLUB_INTRO_LOCAL_PREFIX)) {
    const filename = localPath.slice(CLUB_INTRO_LOCAL_PREFIX.length);
    return `${galleryImageBaseUrl()}/${encodePath(filename)}`;
  }

  return localPath || asset?.sourceUrl;
}
