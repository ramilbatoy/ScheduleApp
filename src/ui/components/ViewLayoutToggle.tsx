import { IconButton } from '@/ui/components/primitives';
import { useTheme } from '@/ui/hooks';

export type ListLayout = 'grid' | 'list';

/**
 * Single icon that toggles grid ↔ list.
 * Shows the *other* mode so the tap target is “switch to …” (list icon while in grid, and vice versa).
 */
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
  const next: ListLayout = layout === 'grid' ? 'list' : 'grid';
  return (
    <IconButton
      testID={testID}
      icon={next === 'list' ? 'list-outline' : 'grid-outline'}
      label={next === 'list' ? 'Switch to list view' : 'Switch to grid view'}
      color={p.textSecondary}
      onPress={() => onChange(next)}
    />
  );
}
