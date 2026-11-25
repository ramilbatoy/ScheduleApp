import { View } from 'react-native';

import { IconButton } from '@/ui/components/primitives';
import { useTheme } from '@/ui/hooks';
import { spacing } from '@/ui/theme';

export type ListLayout = 'grid' | 'list';

/** Icons-only grid / list switch. Selected icon uses the primary color. */
export function ViewLayoutToggle({
  layout,
  onChange,
  testID = 'layout',
}: {
  layout: ListLayout;
  onChange: (next: ListLayout) => void;
  testID?: string;
}) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID={testID}>
      <IconButton
        testID={`${testID}-grid`}
        icon="grid-outline"
        label="Grid view"
        color={layout === 'grid' ? p.primary : p.textSecondary}
        onPress={() => onChange('grid')}
      />
      <IconButton
        testID={`${testID}-list`}
        icon="list-outline"
        label="List view"
        color={layout === 'list' ? p.primary : p.textSecondary}
        onPress={() => onChange('list')}
      />
    </View>
  );
}
