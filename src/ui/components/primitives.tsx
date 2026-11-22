import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
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
      // Android can mis-measure bold label width and clip content-sized buttons (e.g. "Add a task" → "Add a").
      {...(Platform.OS === 'android' ? { textBreakStrategy: 'simple' as const, android_hyphenationFrequency: 'none' as const } : {})}
      style={[type[variant], { color: color ?? (muted ? p.textSecondary : p.text) }, style]}>
      {children}
    </Text>
  );
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const p = useTheme();
  return <Ionicons name={name} size={size} color={color ?? p.text} />;
}

/** Screen body under the shared app header, with an optional large title row. */
export function Screen({
  title,
  subtitle,
  right,
  leading,
  children,
  scroll = true,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  leading?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const p = useTheme();
  const header = title ? (
    <View style={styles.screenHeader}>
      {leading}
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
    <View style={{ flex: 1, backgroundColor: p.background }}>
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
  const bg = { primary: p.primary, secondary: p.surfaceVariant, danger: p.error, ghost: 'transparent' }[tone];
  const fg = { primary: p.onPrimary, secondary: p.text, danger: p.onPrimary, ghost: p.primary }[tone];
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
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} style={styles.buttonIcon} /> : null}
      <AppText variant="label" color={fg} numberOfLines={1} style={styles.buttonLabel}>
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
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: p.surfaceVariant }, style]}>
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
      {icon ? <Ionicons name={icon} size={14} color={selected ? accent : p.textSecondary} /> : null}
      {color && !icon ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <AppText variant="label" color={selected ? accent : p.text} numberOfLines={1} style={styles.chipLabel}>
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
      <Ionicons name={icon} size={36} color={p.textSecondary} />
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
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
      <Ionicons name="alert-circle-outline" size={36} color={p.error} />
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
        <AppText variant="caption" color={p.error}>
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

export function SelectButton({ value, placeholder, icon, onPress, onClear, testID }: { value: string | null; placeholder: string; icon: IconName; onPress: () => void; onClear?: () => void; testID?: string }) {
  const p = useTheme();
  return (
    <View style={[styles.input, styles.select, { backgroundColor: p.surface, borderColor: p.border, paddingHorizontal: 0 }]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={value ?? placeholder}
        onPress={onPress}
        style={[styles.select, { flex: 1, alignSelf: 'stretch', paddingLeft: spacing.md }]}>
        <Ionicons name={icon} size={18} color={p.textSecondary} />
        <AppText style={{ flex: 1 }} color={value ? p.text : p.textSecondary} numberOfLines={1}>
          {value ?? placeholder}
        </AppText>
      </Pressable>
      {value && onClear ? <IconButton icon="close-circle" label={`Clear ${placeholder}`} size={18} color={p.textSecondary} onPress={onClear} /> : null}
    </View>
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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: p.primary, false: p.border }}
        thumbColor={p.onPrimary}
        {...({ activeThumbColor: p.onPrimary } as object)}
      />
    </Pressable>
  );
}

export function ListRow({ icon, label, value, onPress, danger, testID }: { icon?: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean; testID?: string }) {
  const p = useTheme();
  return (
    <Pressable testID={testID} style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.7 }]} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      {icon ? <Ionicons name={icon} size={20} color={danger ? p.error : p.textSecondary} /> : null}
      <AppText style={{ flex: 1 }} color={danger ? p.error : undefined}>
        {label}
      </AppText>
      {value ? <AppText muted>{value}</AppText> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={p.textSecondary} /> : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const p = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: p.surfaceVariant }]} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: p.surface, borderColor: p.border }]}>
            <AppText variant="label" color={active ? p.primary : p.textSecondary} numberOfLines={1} style={styles.segmentLabel}>
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
  button: {
    minHeight: TOUCH,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'visible',
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  buttonIcon: { flexShrink: 0 },
  // flexShrink: 0 — prior EmptyState bug clipped "Add a task" to "Add a" when the label could shrink beside the icon.
  buttonLabel: { flexShrink: 0, textAlign: 'center' },
  iconButton: { minWidth: 40, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: 'visible',
  },
  chipLabel: { flexShrink: 0 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, width: '100%' },
  emptyAction: { alignSelf: 'center', maxWidth: '100%' },
  input: { minHeight: TOUCH, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15 },
  select: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { minHeight: TOUCH + 4, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'visible',
  },
  // Segments share a fixed row width — allow label shrink with ellipsis rather than overflow clip.
  segmentLabel: { flexShrink: 1, textAlign: 'center' },
});
