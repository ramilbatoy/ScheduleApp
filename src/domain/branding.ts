/** Header wordmark. Not the Android launcher name. */
export const APP_HEADER_NAME = 'NeoOrganizer';

export const LOGO_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type LogoMime = (typeof LOGO_MIMES)[number];

/** Bytes copied into the database. Never a picker cache URI. */
export interface StoredLogo {
  mime: LogoMime;
  /** Standard base64, no `data:` prefix. */
  base64: string;
}

export interface AppBranding {
  /** `logo` still falls back to the name when the stored image is missing or invalid. */
  mode: 'name' | 'logo';
  logo: StoredLogo | null;
}

export const DEFAULT_BRANDING: AppBranding = { mode: 'name', logo: null };

/** Decoded logo cap. A header image does not need more than this. */
export const MAX_LOGO_BYTES = 1_500_000;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function sanitizeBranding(value: unknown): AppBranding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { mode: 'name', logo: null };
  const raw = value as { mode?: unknown; logo?: unknown };
  const mode = raw.mode === 'logo' ? 'logo' : 'name';
  return { mode, logo: parseStoredLogo(raw.logo) };
}

/** Logo to paint. Null means the header must show {@link APP_HEADER_NAME} and nothing else. */
export function displayLogo(branding: AppBranding | null | undefined): StoredLogo | null {
  if (!branding || branding.mode !== 'logo') return null;
  return parseStoredLogo(branding.logo);
}

export function logoDataUri(logo: StoredLogo): string {
  return `data:${logo.mime};base64,${logo.base64}`;
}

/**
 * Accept PNG, JPEG, or WebP bytes already copied off the picker.
 * The mime is taken from the file header, not the filename.
 */
export function logoFromBase64(input: string): StoredLogo {
  let raw = input.trim();
  const dataUrl = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(raw);
  if (dataUrl) raw = dataUrl[2];
  const clean = raw.replace(/\s/g, '');
  if (!clean || /[^A-Za-z0-9+/=]/.test(clean)) {
    throw new Error('Choose a PNG, JPG, JPEG, or WebP image.');
  }
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  if (clean.length % 4 === 1 || (padding && clean.slice(0, -padding).includes('='))) {
    throw new Error('Choose a PNG, JPG, JPEG, or WebP image.');
  }
  const bytes = (clean.length * 3) / 4 - padding;
  if (bytes > MAX_LOGO_BYTES) {
    throw new Error('That image is too large for the header. Choose one under 1.5 MB.');
  }
  const header = decodePrefix(clean, 12);
  const mime = header ? sniffMime(header) : null;
  if (!mime) throw new Error('Choose a PNG, JPG, JPEG, or WebP image.');
  return { mime, base64: clean };
}

function parseStoredLogo(value: unknown): StoredLogo | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as { mime?: unknown; base64?: unknown };
  if (typeof raw.base64 !== 'string') return null;
  try {
    const logo = logoFromBase64(raw.base64);
    if (raw.mime !== logo.mime) return null;
    return logo;
  } catch {
    return null;
  }
}

function decodePrefix(clean: string, byteCount: number): Uint8Array | null {
  const out = new Uint8Array(byteCount);
  let bits = 0;
  let val = 0;
  let written = 0;
  for (const ch of clean) {
    if (ch === '=') break;
    const n = B64.indexOf(ch);
    if (n < 0) return null;
    val = (val << 6) | n;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[written] = (val >> bits) & 0xff;
      written += 1;
      if (written >= byteCount) return out;
    }
  }
  return written > 0 ? out : null;
}

function sniffMime(bytes: Uint8Array): LogoMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}
