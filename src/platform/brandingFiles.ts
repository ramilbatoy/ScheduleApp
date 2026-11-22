import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { logoFromBase64, type StoredLogo } from '@/domain/branding';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];

/**
 * Copy a picked image into memory and return bytes for the database.
 * The cache URI is not returned.
 */
export async function pickBrandingLogo(): Promise<StoredLogo | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: IMAGE_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const base64 = await new File(result.assets[0].uri).base64();
  return logoFromBase64(base64);
}
