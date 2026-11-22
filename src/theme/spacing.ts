export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

/** Minimum touch target per Android accessibility guidance. */
export const TOUCH = 48;

export const sizes = {
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 36,
  tabBar: 64,
  fab: 56,
} as const;

export const elevation = {
  none: 0,
  low: 2,
  mid: 4,
  high: 8,
} as const;

export const durations = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;
