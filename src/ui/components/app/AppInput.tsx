import { TextInput, StyleSheet, type TextInputProps } from 'react-native';

import { radius, spacing, TOUCH, useTheme } from '@/theme';

export function AppInput(props: TextInputProps & { invalid?: boolean }) {
  const p = useTheme();
  const { invalid, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={p.textSecondary}
      {...rest}
      style={[
        styles.input,
        { color: p.text, backgroundColor: p.surface, borderColor: invalid ? p.error : p.border },
        rest.multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: { minHeight: TOUCH, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15 },
});
