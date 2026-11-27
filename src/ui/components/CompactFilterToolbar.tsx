import type { ComponentProps, ComponentRef, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { View, type LayoutRectangle } from 'react-native';

import { Sheet } from '@/ui/components/Pickers';
import { SearchFieldPopup } from '@/ui/components/SearchFieldPopup';
import { ViewLayoutToggle, type ListLayout } from '@/ui/components/ViewLayoutToggle';
import { IconButton, ListRow } from '@/ui/components/primitives';
import { spacing } from '@/ui/theme';

export type FilterRow = {
  testID?: string;
  icon?: ComponentProps<typeof ListRow>['icon'];
  label: string;
  value: string;
  onPress: () => void;
};

/**
 * Search → filter → listing toggle (Day / Week / Month, folder detail, etc.).
 * Search opens an inline field anchored to the search icon.
 */
export function CompactFilterToolbar({
  testID,
  searchValue,
  searchOpen,
  onSearchOpenChange,
  onSearchChange,
  searchPlaceholder,
  filtersOpen,
  onFiltersOpenChange,
  filterRows,
  layout,
  onLayoutChange,
  trailing,
}: {
  testID: string;
  searchValue: string;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  onSearchChange: (text: string) => void;
  searchPlaceholder: string;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  filterRows: FilterRow[];
  layout?: ListLayout;
  onLayoutChange?: (next: ListLayout) => void;
  /** Extra controls after the filter/search icons (before layout). */
  trailing?: ReactNode;
}) {
  const searchBtnRef = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);

  function openSearch() {
    const node = searchBtnRef.current as (ComponentRef<typeof View> & { measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void }) | null;
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        onSearchOpenChange(true);
      });
      return;
    }
    setAnchor(null);
    onSearchOpenChange(true);
  }

  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, flexWrap: 'wrap' }}>
        <View ref={searchBtnRef} collapsable={false}>
          <IconButton testID={`${testID}-search-open`} icon="search" label="Search" onPress={openSearch} />
        </View>
        <IconButton testID={`${testID}-filters`} icon="filter-outline" label="Filters" onPress={() => onFiltersOpenChange(true)} />
        {trailing}
        {layout && onLayoutChange ? <ViewLayoutToggle testID={`${testID}-layout`} layout={layout} onChange={onLayoutChange} /> : null}
      </View>
      <SearchFieldPopup
        visible={searchOpen}
        value={searchValue}
        onChangeText={onSearchChange}
        onClose={() => onSearchOpenChange(false)}
        placeholder={searchPlaceholder}
        testID={`${testID}-search`}
        anchor={anchor}
      />
      <Sheet visible={filtersOpen} title="Filters" onClose={() => onFiltersOpenChange(false)}>
        {filterRows.map((row) => (
          <ListRow
            key={row.label}
            testID={row.testID}
            icon={row.icon}
            label={row.label}
            value={row.value}
            onPress={() => {
              onFiltersOpenChange(false);
              row.onPress();
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}
