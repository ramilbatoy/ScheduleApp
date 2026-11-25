import { displayLogo, logoDataUri, logoFromBase64, MAX_LOGO_BYTES, sanitizeBranding } from '../branding';
import type { AppServices } from '../services/container';
import { DRIVERS } from '../../test/databases';
import { makeApp } from '../../test/fixtures';

function b64(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

const png = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
const jpeg = b64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);
const webp = b64([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

describe('logo bytes', () => {
  it('accepts png, jpeg, and webp and rejects other files', () => {
    expect(logoFromBase64(png)).toEqual({ mime: 'image/png', base64: png });
    expect(logoFromBase64(`data:image/jpeg;base64,${jpeg}`).mime).toBe('image/jpeg');
    expect(logoFromBase64(webp).mime).toBe('image/webp');
    expect(() => logoFromBase64(b64([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toThrow(/PNG, JPG, JPEG, or WebP/);
    expect(() => logoFromBase64('not an image')).toThrow(/PNG, JPG, JPEG, or WebP/);
    expect(() => logoFromBase64('A'.repeat(Math.ceil((MAX_LOGO_BYTES + 10) / 3) * 4))).toThrow(/too large/);
  });

  it('falls back when the logo is missing or the bytes are not an image', () => {
    expect(displayLogo(sanitizeBranding(null))).toBeNull();
    expect(displayLogo(sanitizeBranding({ mode: 'name', logo: { mime: 'image/png', base64: png } }))).toBeNull();
    const bad = sanitizeBranding({ mode: 'logo', logo: { mime: 'image/png', base64: 'AAAA' } });
    expect(bad.logo).toBeNull();
    expect(displayLogo(bad)).toBeNull();
    const good = sanitizeBranding({ mode: 'logo', logo: { mime: 'image/png', base64: png } });
    expect(logoDataUri(displayLogo(good)!)).toBe(`data:image/png;base64,${png}`);
    expect(displayLogo(sanitizeBranding({ mode: 'logo', logo: { mime: 'image/jpeg', base64: png } }))).toBeNull();
  });
});

describe.each(DRIVERS)('branding settings (%s)', (_name, open) => {
  let app: AppServices;
  beforeEach(async () => {
    ({ app } = await makeApp(open));
  });

  it('stores logo bytes in the database and keeps them offline of any file URI', async () => {
    expect((await app.settings.get()).branding).toEqual({ mode: 'name', logo: null });
    expect((await app.settings.get()).showEmptyFoldersOnTasks).toBe(false);
    expect((await app.settings.get()).collapseFoldersByDefault).toBe(true);
    expect((await app.settings.get()).showFolderPriority).toBe(false);
    expect((await app.settings.get()).showFolderTargetDate).toBe(false);
    expect((await app.settings.get()).defaultFolderListView).toBe('grid');
    expect((await app.settings.get()).showFolderQuickAdd).toBe(false);
    expect((await app.settings.get()).navigation.order).toEqual(['projects', 'statistics', 'settings', 'about']);
    const logo = logoFromBase64(png);
    await app.settings.set('branding', { mode: 'logo', logo });
    await app.settings.set('showEmptyFoldersOnTasks', true);
    await app.settings.set('collapseFoldersByDefault', false);
    await app.settings.set('showFolderPriority', true);
    await app.settings.set('showFolderTargetDate', true);
    await app.settings.set('defaultFolderListView', 'list');
    await app.settings.set('showFolderQuickAdd', true);
    await app.settings.set('navigation', { drawerEnabled: true, order: ['tasks', 'projects', 'about'] });
    const saved = await app.settings.get();
    expect(saved.branding).toEqual({ mode: 'logo', logo });
    expect(saved.showEmptyFoldersOnTasks).toBe(true);
    expect(saved.collapseFoldersByDefault).toBe(false);
    expect(saved.showFolderPriority).toBe(true);
    expect(saved.showFolderTargetDate).toBe(true);
    expect(saved.defaultFolderListView).toBe('list');
    expect(saved.showFolderQuickAdd).toBe(true);
    expect(saved.navigation.order).toEqual(['projects', 'statistics', 'settings', 'about']);
    expect(JSON.stringify(saved.branding)).not.toMatch(/file:|content:|blob:/);

    const named = await app.settings.set('branding', { mode: 'name', logo });
    expect(displayLogo(named.branding)).toBeNull();
    expect(named.branding.logo).toEqual(logo);

    const file = await app.backup.export();
    const validated = app.backup.validate(JSON.stringify(file));
    expect(validated.warnings.join('\n')).not.toMatch(
      /branding|show_empty_folders|collapse_folders|show_folder_priority|show_folder_target|default_folder_list|show_folder_quick_add/,
    );
    expect(validated.backup.data.app_settings?.some((row) => row.id === 'branding')).toBe(true);
    expect(validated.backup.data.app_settings?.some((row) => row.id === 'show_empty_folders_on_tasks')).toBe(true);
    expect(validated.backup.data.app_settings?.some((row) => row.id === 'collapse_folders_by_default')).toBe(true);
    expect(validated.backup.data.app_settings?.some((row) => row.id === 'show_folder_priority')).toBe(true);
    expect(validated.backup.data.app_settings?.some((row) => row.id === 'show_folder_target_date')).toBe(true);
    expect(validated.backup.data.app_settings?.some((row) => row.id === 'default_folder_list_view')).toBe(true);
    expect(validated.backup.data.app_settings?.some((row) => row.id === 'show_folder_quick_add')).toBe(true);
  });
});
