import { Switch } from 'react-native-paper';

import { useTheme } from '@/theme';

export function AppSwitch({
  value,
  onChange,
  disabled,
  testID,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const p = useTheme();
  return (
    <Switch
      testID={testID}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      color={p.primary}
    />
  );
}
