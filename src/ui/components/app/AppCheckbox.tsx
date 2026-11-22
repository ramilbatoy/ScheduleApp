import { Checkbox } from 'react-native-paper';

import { useTheme } from '@/theme';

export function AppCheckbox({
  checked,
  onChange,
  disabled,
  testID,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
  label?: string;
}) {
  const p = useTheme();
  return (
    <Checkbox
      testID={testID}
      status={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      color={p.primary}
      uncheckedColor={p.outline}
      {...(label ? { 'aria-label': label } : {})}
    />
  );
}
