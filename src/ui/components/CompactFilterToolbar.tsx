import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';

import { Sheet } from '@/ui/components/Pickers';
import { ViewLayoutToggle, type ListLayout } from '@/ui/components/ViewLayoutToggle';
import { IconButton, Input, ListRow } from '@/ui/components/primitives';
import { useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

export type FilterRow = {
  testID?: string;
  icon?: ComponentProps<typeof ListRow>['icon'];
  label: string;
  value: string;
  onPress: () => void;
};

/**
 * Optional leading title + today icon, then search → filter → listing.
 * Search expands inline under the icon row at full width.
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
  leading,
  beforeSearch,
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
  /** Left-side heading / week title (inline with the icon row). */
  leading?: ReactNode;
  /** Controls immediately before search (e.g. Today icon). */
  beforeSearch?: ReactNode;
  /** Extra controls after the filter/search icons (before layout). */
  trailing?: ReactNode;
}) {
  const p = useTheme();

  function toggleSearch() {
    onSearchOpenChange(!searchOpen);
  }

  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
        {leading ? <View style={{ flex: 1, minWidth: 0, marginRight: spacing.xs }}>{leading}</View> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: leading ? undefined : 'auto' }}>
          {beforeSearch}
          <IconButton
            testID={`${testID}-search-open`}
            icon="search"
            label={searchOpen ? 'Hide search' : 'Search'}
            onPress={toggleSearch}
            color={searchOpen ? p.primary : undefined}
          />
          <IconButton testID={`${testID}-filters`} icon="filter-outline" label="Filters" onPress={() => onFiltersOpenChange(true)} />
          {trailing}
          {layout && onLayoutChange ? <ViewLayoutToggle testID={`${testID}-layout`} layout={layout} onChange={onLayoutChange} /> : null}
        </View>
      </View>
      {searchOpen ? (
        <View
          testID={`${testID}-search-inline`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            width: '100%',
            borderWidth: 1,
            borderColor: p.border,
            borderRadius: radius.lg,
            backgroundColor: p.surface,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
          }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Input
              testID={`${testID}-search`}
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              autoFocus
              clearButtonMode="never"
            />
          </View>
          <IconButton
            icon="close-circle"
            label="Clear search"
            onPress={() => onSearchChange('')}
            testID={`${testID}-search-clear`}
            color={searchValue ? p.textSecondary : p.border}
          />
          <IconButton
            icon="close"
            label="Close search"
            onPress={() => onSearchOpenChange(false)}
            testID={`${testID}-search-close`}
            color={p.textSecondary}
          />
        </View>
      ) : null}
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
