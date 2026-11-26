import type { ViewStyle } from 'react-native';

/**
 * Folder / planner grid density from **content** width (not a hard “always 2 at ~400px”).
 *
 * | Content width | Columns | Typical devices |
 * | --- | --- | --- |
 * | &lt; 370 | 1 | small phones (~320–360) |
 * | 370–1023 | 2 | larger phones, phablets, tablet portrait |
 * | ≥ 1024 | 3 | tablet landscape / desktop |
 */
export function folderGridColumns(contentWidth: number): 1 | 2 | 3 {
  if (contentWidth < 370) return 1;
  if (contentWidth < 1024) return 2;
  return 3;
}

/** Historical Week helper name — same breakpoints as {@link folderGridColumns}. */
export function weekFolderColumns(width: number): 1 | 2 | 3 {
  return folderGridColumns(width);
}

/** Percent width + padding for a flex-wrap grid cell. */
export function folderGridCellStyle(columns: 1 | 2 | 3, pad = 4): ViewStyle {
  const width = columns === 1 ? '100%' : columns === 2 ? '50%' : '33.333%';
  return { width, paddingHorizontal: pad, paddingBottom: pad * 2, minWidth: 0 };
}

export function folderGridWrapStyle(pad = 4): ViewStyle {
  return { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -pad, alignItems: 'stretch' };
}
