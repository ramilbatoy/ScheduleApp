import { StyleSheet, View } from 'react-native';

import { useTheme } from '../hooks';
import { radius, spacing } from '../theme';
import { AppText } from './primitives';

/**
 * Charts are plain Views so they render identically on Android and web with
 * no native graphics dependency and no network access.
 */

export interface BarDatum {
  key: string;
  label: string;
  /** Full bar height (e.g. scheduled). */
  total: number;
  /** Filled portion (e.g. completed); must be ≤ total. */
  value: number;
  highlight?: boolean;
}

export function BarChart({
  data,
  height = 120,
  accessibilityLabel,
  showValues = false,
}: {
  data: BarDatum[];
  height?: number;
  accessibilityLabel: string;
  showValues?: boolean;
}) {
  const p = useTheme();
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.bars, { height }]}>
        {data.map((d) => {
          const totalH = (d.total / max) * height;
          const valueH = (d.value / max) * height;
          return (
            <View key={d.key} style={styles.barSlot}>
              {showValues && d.value > 0 ? (
                <AppText variant="caption" muted style={styles.barValue}>
                  {d.value}
                </AppText>
              ) : null}
              <View
                style={[
                  styles.barTrack,
                  { height: Math.max(totalH, d.total ? 4 : 2), backgroundColor: d.total ? p.primarySoft : p.border },
                ]}>
                <View style={[styles.barFill, { height: valueH, backgroundColor: d.highlight ? p.success : p.primary }]} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d) => (
          <AppText
            key={d.key}
            variant="caption"
            muted={!d.highlight}
            color={d.highlight ? p.primary : undefined}
            style={styles.barLabel}
            numberOfLines={1}>
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const p = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: p.surfaceVariant, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? p.primary }} />
    </View>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'danger' | 'warning' | 'success' }) {
  const p = useTheme();
  const color = tone === 'danger' ? p.error : tone === 'warning' ? p.warning : tone === 'success' ? p.success : p.text;
  return (
    <View style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
      <AppText variant="caption" muted numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="title" color={color}>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" muted numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: i.color }]} />
          <AppText variant="caption" muted>
            {i.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: '100%', maxWidth: 28, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%' },
  barValue: { marginBottom: 2 },
  labels: { flexDirection: 'row', gap: 4, marginTop: spacing.xs },
  barLabel: { flex: 1, textAlign: 'center', fontSize: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
