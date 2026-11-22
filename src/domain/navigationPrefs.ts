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

export const DEFAULT_NAVIGATION: NavigationPrefs = {
  drawerEnabled: true,
  order: [...NAV_ITEM_IDS],
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
