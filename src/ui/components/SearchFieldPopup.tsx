import { View } from 'react-native';

import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/hooks';

import { IconButton, Input } from './primitives';

/** Compact search field over the list. Typing filters the list behind it. */
export function SearchFieldPopup({
  visible,
  value,
  onChangeText,
  onClose,
  placeholder,
  testID,
}: {
  visible: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  placeholder: string;
  testID: string;
}) {
  const p = useTheme();
  if (!visible) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: spacing.md, left: spacing.lg, right: spacing.lg, zIndex: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'center',
          backgroundColor: p.surface,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.sm,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.16,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}>
        <View style={{ flex: 1 }}>
          <Input testID={testID} value={value} onChangeText={onChangeText} placeholder={placeholder} autoFocus clearButtonMode="while-editing" />
        </View>
        <IconButton icon="close" label="Close search" onPress={onClose} testID={`${testID}-close`} />
      </View>
    </View>
  );
}
