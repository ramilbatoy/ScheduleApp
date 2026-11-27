import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { folderGridColumns } from '@/ui/layout/folderGrid';

/**
 * Tracks content width (via onLayout) with window width as the first paint fallback.
 * List layout always reports 1 column.
 * Ignores sub-pixel / keyboard noise so column count does not thrash on Android.
 */
export function useFolderGridColumns(layout: 'grid' | 'list' = 'grid') {
  const { width: windowWidth } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(windowWidth);
  const measured = useRef(false);

  useEffect(() => {
    // Window resize (web / foldables): re-seed until the next onLayout measurement.
    measured.current = false;
    setContentWidth(windowWidth);
  }, [windowWidth]);

  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setContentWidth((prev) => {
      // Ignore tiny width jitter (Android keyboard / system bars) that would flip 1↔2 columns.
      if (measured.current && Math.abs(prev - w) < 8) return prev;
      measured.current = true;
      return w;
    });
  }, []);

  const columns = layout === 'list' ? 1 : folderGridColumns(contentWidth);
  /** Multi-column grids use compact chrome; single-column grid/list stay full. */
  const compact = layout === 'grid' && columns >= 2;
  return { columns: columns as 1 | 2 | 3, contentWidth, onGridLayout, compact };
}
