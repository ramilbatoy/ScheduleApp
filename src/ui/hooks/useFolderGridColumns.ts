import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { folderGridColumns } from '@/ui/layout/folderGrid';

/**
 * Tracks content width (via onLayout) with window width as the first paint fallback.
 * List layout always reports 1 column.
 */
export function useFolderGridColumns(layout: 'grid' | 'list' = 'grid') {
  const { width: windowWidth } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(windowWidth);

  useEffect(() => {
    // Window resize (web / foldables): re-seed until the next onLayout measurement.
    setContentWidth(windowWidth);
  }, [windowWidth]);

  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContentWidth(w);
  }, []);

  const columns = layout === 'list' ? 1 : folderGridColumns(contentWidth);
  /** Multi-column grids use compact chrome; single-column grid/list stay full. */
  const compact = layout === 'grid' && columns >= 2;
  return { columns: columns as 1 | 2 | 3, contentWidth, onGridLayout, compact };
}
