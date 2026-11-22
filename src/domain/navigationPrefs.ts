/** Drawer destinations. Hiding one does not remove the underlying screen. */
export const NAV_ITEM_IDS = [
  'today',
  'calendar',
  'tasks',
  'projects',
  'statistics',
  'categories',
  'theme',
  'backup',
  'settings',
  'about',
] as const;

export type NavItemId = (typeof NAV_ITEM_IDS)[number];

export interface NavigationPrefs {
  drawerEnabled: boolean;
  /** Visible items, top to bottom. Ids left out are hidden shortcuts. */
  order: NavItemId[];
}

/**
 * Shortcuts shown until the user customizes the drawer.
 * Categories, Theme, and Backup stay in the full id list so they can be shown again.
 * The Projects row is the Folders screen (`/projects`); there is no second route.
 */
export const DEFAULT_DRAWER_ORDER: NavItemId[] = ['today', 'calendar', 'tasks', 'projects', 'statistics', 'settings', 'about'];

export const DEFAULT_NAVIGATION: NavigationPrefs = {
  drawerEnabled: true,
  order: [...DEFAULT_DRAWER_ORDER],
};

const NAV_SET = new Set<string>(NAV_ITEM_IDS);

/** Drop unknown ids and duplicates. Missing ids stay hidden so a saved hide survives reload. */
export function sanitizeNavigation(value: unknown): NavigationPrefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_NAVIGATION, order: [...DEFAULT_NAVIGATION.order] };
  const raw = value as { drawerEnabled?: unknown; order?: unknown };
  const drawerEnabled = typeof raw.drawerEnabled === 'boolean' ? raw.drawerEnabled : DEFAULT_NAVIGATION.drawerEnabled;
  const order: NavItemId[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.order)) {
    for (const id of raw.order) {
      if (typeof id !== 'string' || !NAV_SET.has(id) || seen.has(id)) continue;
      seen.add(id);
      order.push(id as NavItemId);
    }
  }
  return { drawerEnabled, order };
}

/**
 * Which drawer row matches the current URL. Folder detail counts as Folders.
 * Task detail does not highlight a row. Backup shares Settings' screen, so only Settings highlights there.
 */
export function activeDrawerItem(pathname: string): NavItemId | null {
  const path = (pathname.split('?')[0].replace(/\/+$/, '') || '/').replace('/(tabs)', '') || '/';
  if (path === '/' || path === '/index') return 'today';
  if (path === '/calendar' || path.startsWith('/calendar/')) return 'calendar';
  if (path === '/tasks' || path.startsWith('/tasks/')) return 'tasks';
  if (path === '/projects' || path.startsWith('/projects/') || path === '/folder' || path.startsWith('/folder/')) return 'projects';
  if (path === '/stats' || path.startsWith('/stats/')) return 'statistics';
  if (path === '/categories' || path.startsWith('/categories/')) return 'categories';
  if (path === '/theme-settings' || path.startsWith('/theme-settings/')) return 'theme';
  if (path === '/settings' || path.startsWith('/settings/')) return 'settings';
  if (path === '/about' || path.startsWith('/about/')) return 'about';
  return null;
}
