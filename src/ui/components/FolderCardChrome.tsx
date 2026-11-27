import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/hooks';

import { AppText, Icon, type IconName } from './primitives';

export type FolderCardChromeProps = {
  name: string;
  color: string;
  icon: string;
  /** 0–100 progress fill. */
  percent: number;
  /** Counts / range line, e.g. "Today 2/5 completed · 40%". */
  summary: string;
  priorityLabel: string;
  priorityColor: string;
  /** Target / due phrase; omit or empty for “No target”. */
  targetText?: string | null;
  targetUrgent?: boolean;
  statusLabel?: string | null;
  /** Slightly tighter chrome when the card sits in a multi-column grid. */
  compact?: boolean;
  /** Title wraps up to this many lines (default 2 — not aggressive 1-line truncation). */
  titleLines?: number;
  testID?: string;
  /**
   * Folder icon + title → details (sibling pressables; not nested under expand).
   * When set with onPressHeader, expand stays on the chevron / summary body.
   */
  onOpen?: () => void;
  /** Expand/collapse or navigate when onOpen is absent. Chevron + summary use this when both are set. */
  onPressHeader?: () => void;
  headerAccessibilityLabel?: string;
  headerExpanded?: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
};

/**
 * Shared 2-row folder card chrome (icon+title | progress+meta).
 * Used by Day/Week/Month folder groups, Folder page, and Tasks Group-by-Folder.
 * Icon/title open and header toggle stay sibling pressables (no nested web buttons).
 */
export function FolderCardChrome({
  name,
  color,
  icon,
  percent,
  summary,
  priorityLabel,
  priorityColor,
  targetText,
  targetUrgent = false,
  statusLabel,
  compact = false,
  titleLines = 2,
  testID,
  onOpen,
  onPressHeader,
  headerAccessibilityLabel,
  headerExpanded,
  trailing,
  children,
}: FolderCardChromeProps) {
  const p = useTheme();
  const iconBox = compact ? 32 : 40;
  const barH = compact ? 4 : 6;
  const gap = compact ? spacing.xs : spacing.sm;
  const rowGap = compact ? spacing.sm : spacing.md;

  const metaParts: { text: string; color: string }[] = [
    { text: priorityLabel, color: priorityColor },
    {
      text: targetText && targetText.length ? targetText : 'No target',
      color: targetUrgent ? p.overdue : p.textSecondary,
    },
  ];
  if (statusLabel) metaParts.push({ text: statusLabel, color: p.textSecondary });

  const iconEl = (
    <View
      style={{
        width: iconBox,
        height: iconBox,
        borderRadius: radius.md,
        backgroundColor: `${color}22`,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      <Icon name={icon as IconName} color={color} size={compact ? 18 : 20} />
    </View>
  );

  const titleBlock = (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText variant={compact ? 'label' : 'title'} numberOfLines={titleLines}>
        {name}
      </AppText>
    </View>
  );

  const summaryBlock = (
    <View style={{ gap: spacing.xs }} testID={testID ? `${testID}-summary` : undefined}>
      <View style={{ height: barH, borderRadius: radius.sm, backgroundColor: p.surfaceVariant, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: barH, backgroundColor: color, borderRadius: radius.sm }} />
      </View>
      <AppText variant="caption" muted numberOfLines={2} testID={testID ? `${testID}-range` : undefined}>
        {summary}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {metaParts.map((m) => (
          <AppText key={`${m.text}-${m.color}`} variant="caption" color={m.color} numberOfLines={1}>
            {m.text}
          </AppText>
        ))}
      </View>
    </View>
  );

  const expandState = headerExpanded === undefined ? undefined : { expanded: headerExpanded };
  /** Icon + name open details; chevron/summary keep expand when both handlers exist. */
  const splitOpenAndExpand = !!(onOpen && onPressHeader);
  const titleOpens = !!onOpen;
  const titleExpands = !onOpen && !!onPressHeader;

  return (
    <View style={{ gap, minWidth: 0 }} testID={testID ? `${testID}-chrome` : undefined}>
      {/* Row 1: icon · title · trailing — siblings, not nested buttons */}
      <View style={{ flexDirection: 'row', gap: rowGap, alignItems: 'center' }}>
        {onOpen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open folder details for ${name}`}
            onPress={onOpen}
            testID={testID ? `${testID}-open` : undefined}
            hitSlop={4}>
            {iconEl}
          </Pressable>
        ) : (
          iconEl
        )}
        {titleOpens ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open folder details for ${name}`}
            onPress={onOpen}
            testID={testID ? `${testID}-title` : undefined}
            style={{ flex: 1, minWidth: 0 }}
            hitSlop={4}>
            {titleBlock}
          </Pressable>
        ) : titleExpands ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={expandState}
            accessibilityLabel={headerAccessibilityLabel ?? name}
            onPress={onPressHeader}
            testID={testID ? `${testID}-toggle` : undefined}
            style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {titleBlock}
            {trailing}
          </Pressable>
        ) : (
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {titleBlock}
            {!splitOpenAndExpand ? trailing : null}
          </View>
        )}
        {splitOpenAndExpand && trailing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={expandState}
            accessibilityLabel={headerAccessibilityLabel ?? `${name} expand`}
            onPress={onPressHeader}
            testID={testID ? `${testID}-toggle` : undefined}
            hitSlop={4}
            style={{ flexShrink: 0 }}>
            {trailing}
          </Pressable>
        ) : titleOpens && trailing ? (
          <View style={{ flexShrink: 0 }}>{trailing}</View>
        ) : null}
      </View>
      {/* Row 2: progress + meta — expand when split; open-only leaves summary static */}
      {onPressHeader ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={expandState}
          accessibilityLabel={headerAccessibilityLabel ?? `${name} summary`}
          onPress={onPressHeader}
          testID={testID ? `${testID}-summary-press` : undefined}>
          {summaryBlock}
        </Pressable>
      ) : (
        summaryBlock
      )}
      {children}
    </View>
  );
}
