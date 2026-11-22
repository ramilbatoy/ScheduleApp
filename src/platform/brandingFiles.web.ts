import * as DocumentPicker from 'expo-document-picker';

import { logoFromBase64, type StoredLogo } from '@/domain/branding';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Browser: read the chosen file into bytes. The blob URL is not stored. */
export async function pickBrandingLogo(): Promise<StoredLogo | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: IMAGE_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const response = await fetch(result.assets[0].uri);
  if (!response.ok) throw new Error('Could not read that image.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  return logoFromBase64(bytesToBase64(bytes));
}
