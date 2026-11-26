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

/**
 * Bumped when existing installs must be forced onto the canonical drawer order.
 * Saves that already carry this revision keep the user's order.
 * Revision 3 re-forces after #33's revision 2 so post-migrate custom orders reset once.
 */
export const DRAWER_ORDER_REVISION = 3;

export interface NavigationPrefs {
  drawerEnabled: boolean;
  /** Visible items, top to bottom. Ids left out are hidden shortcuts. */
  order: NavItemId[];
  /**
   * When missing or older than {@link DRAWER_ORDER_REVISION}, read/migrate forces
   * {@link DEFAULT_DRAWER_ORDER} and persists the revision.
   */
  orderRevision?: number;
}

/**
 * Shortcuts shown until the user customizes the drawer.
 * Day, Calendar, Tasks, and Events stay on the bottom tabs.
 * Statistics and Settings are drawer items, not tabs.
 * The Projects row is the Folders screen (`/projects`); there is no second route.
 */
export const DEFAULT_DRAWER_ORDER: NavItemId[] = ['projects', 'statistics', 'settings', 'about'];

/**
 * Force the NeoPlanner drawer order when the saved prefs have not yet been
 * migrated to {@link DRAWER_ORDER_REVISION}. Any prior custom order is replaced once.
 * After migration, a user reorder (stamped with the current revision) is kept.
 */
export function upgradeDrawerOrder(order: readonly NavItemId[], orderRevision?: number): NavItemId[] {
  if (orderRevision === DRAWER_ORDER_REVISION) return [...order];
  return [...DEFAULT_DRAWER_ORDER];
}

/** Apply the one-time canonical drawer migration. `changed` means the caller should persist. */
export function applyDrawerOrderMigration(prefs: NavigationPrefs): { prefs: NavigationPrefs; changed: boolean } {
  if (prefs.orderRevision === DRAWER_ORDER_REVISION) {
    return { prefs: { ...prefs, order: [...prefs.order], orderRevision: DRAWER_ORDER_REVISION }, changed: false };
  }
  return {
    prefs: {
      drawerEnabled: prefs.drawerEnabled,
      order: [...DEFAULT_DRAWER_ORDER],
      orderRevision: DRAWER_ORDER_REVISION,
    },
    changed: true,
  };
}

export const DEFAULT_NAVIGATION: NavigationPrefs = {
  drawerEnabled: true,
  order: [...DEFAULT_DRAWER_ORDER],
  orderRevision: DRAWER_ORDER_REVISION,
};

const NAV_SET = new Set<string>(NAV_ITEM_IDS);

/** Drop unknown ids and duplicates. Missing ids stay hidden so a saved hide survives reload. */
export function sanitizeNavigation(value: unknown): NavigationPrefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NAVIGATION, order: [...DEFAULT_NAVIGATION.order] };
  }
  const raw = value as { drawerEnabled?: unknown; order?: unknown; orderRevision?: unknown };
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
  const orderRevision = typeof raw.orderRevision === 'number' && Number.isFinite(raw.orderRevision) ? raw.orderRevision : undefined;
  return orderRevision !== undefined ? { drawerEnabled, order, orderRevision } : { drawerEnabled, order };
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
