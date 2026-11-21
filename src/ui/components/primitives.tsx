import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks';
import { radius, spacing, TOUCH, type } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TextVariant = keyof typeof type;

export function AppText({
  variant = 'body',
  color,
  muted,
  style,
  children,
  numberOfLines,
  testID,
}: {
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  testID?: string;
}) {
  const p = useTheme();
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[type[variant], { color: color ?? (muted ? p.textMuted : p.text) }, style]}>
      {children}
    </Text>
  );
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const p = useTheme();
  return <Ionicons name={name} size={size} color={color ?? p.text} />;
}

/** Screen container with safe-area top padding and an optional large title row. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <AppText variant="label" muted>
            {subtitle}
          </AppText>
        ) : null}
        <AppText variant="display" numberOfLines={1}>
          {title}
        </AppText>
      </View>
      {right}
    </View>
  ) : null;
  return (
    <View style={{ flex: 1, backgroundColor: p.background, paddingTop: insets.top }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>
          <View style={{ paddingHorizontal: spacing.lg }}>{header}</View>
          {children}
        </View>
      )}
    </View>
  );
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const p = useTheme();
  const base = [styles.card, { backgroundColor: p.surface, borderColor: p.border }, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, count, right }: { title: string; count?: number; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading">
        {title}
        {count !== undefined ? <AppText variant="heading" muted>{`  ${count}`}</AppText> : null}
      </AppText>
      {right}
    </View>
  );
}

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  tone = 'primary',
  icon,
  disabled,
  loading,
  style,
  testID,
  compact,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  compact?: boolean;
}) {
  const p = useTheme();
  const bg = { primary: p.primary, secondary: p.surfaceAlt, danger: p.danger, ghost: 'transparent' }[tone];
  const fg = { primary: p.onPrimary, secondary: p.text, danger: '#FFFFFF', ghost: p.primary }[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 22,
  testID,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: p.surfaceAlt }, style]}>
      <Ionicons name={icon} size={size} color={color ?? p.text} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IconName;
  testID?: string;
}) {
  const p = useTheme();
  const accent = color ?? p.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? accent : p.border,
          backgroundColor: selected ? `${accent}22` : p.surface,
        },
      ]}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? accent : p.textMuted} /> : null}
      {color && !icon ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <AppText variant="label" color={selected ? accent : p.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Badge({ label, color, background, icon }: { label: string; color: string; background: string; icon?: IconName }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={[type.caption, { color, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  const p = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={p.textMuted} />
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const p = useTheme();
  return (
    <View style={styles.empty} accessibilityLabel={label}>
      <ActivityIndicator color={p.primary} />
      <AppText muted>{label}</AppText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const p = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name="alert-circle-outline" size={36} color={p.danger} />
      <AppText variant="heading">Something went wrong</AppText>
      <AppText muted style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {onRetry ? <Button label="Try again" tone="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  const p = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      {children}
      {error ? (
        <AppText variant="caption" color={p.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const p = useTheme();
  const { invalid, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={p.textMuted}
      {...rest}
      style={[
        styles.input,
        { color: p.text, backgroundColor: p.surface, borderColor: invalid ? p.danger : p.border },
        rest.multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md },
        style,
      ]}
    />
  );
}

export function SelectButton({ value, placeholder, icon, onPress, onClear, testID }: { value: string | null; placeholder: string; icon: IconName; onPress: () => void; onClear?: () => void; testID?: string }) {
  const p = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ?? placeholder}
      onPress={onPress}
      style={[styles.input, styles.select, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Ionicons name={icon} size={18} color={p.textMuted} />
      <AppText style={{ flex: 1 }} color={value ? p.text : p.textMuted}>
        {value ?? placeholder}
      </AppText>
      {value && onClear ? <IconButton icon="close-circle" label={`Clear ${placeholder}`} size={18} color={p.textMuted} onPress={onClear} /> : null}
    </Pressable>
  );
}

export function SwitchRow({ label, description, value, onChange, testID }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const p = useTheme();
  return (
    <Pressable style={styles.row} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} testID={testID}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText>{label}</AppText>
        {description ? (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: p.primary, false: p.border }} thumbColor="#FFFFFF" />
    </Pressable>
  );
}

export function ListRow({ icon, label, value, onPress, danger, testID }: { icon?: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean; testID?: string }) {
  const p = useTheme();
  return (
    <Pressable testID={testID} style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.7 }]} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      {icon ? <Ionicons name={icon} size={20} color={danger ? p.danger : p.textMuted} /> : null}
      <AppText style={{ flex: 1 }} color={danger ? p.danger : undefined}>
        {label}
      </AppText>
      {value ? <AppText muted>{value}</AppText> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={p.textMuted} /> : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const p = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: p.surfaceAlt }]} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: p.surface, borderColor: p.border }]}>
            <AppText variant="label" color={active ? p.primary : p.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider() {
  const p = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }} />;
}

const styles = StyleSheet.create({
  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.md },
  screenContent: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  button: { minHeight: TOUCH, paddingHorizontal: spacing.lg, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  buttonCompact: { minHeight: 36, paddingHorizontal: spacing.md },
  iconButton: { minWidth: 40, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, minHeight: 36, borderRadius: radius.pill, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  input: { minHeight: TOUCH, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15 },
  select: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { minHeight: TOUCH + 4, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent' },
});
