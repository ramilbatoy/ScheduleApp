import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AppSettings, ThemeCustomColors, ThemeLastUsed, ThemePreference, ThemePresetId } from '@/domain/models';
import { useAppStore, useServices, useSettings } from '@/state/appStore';
import {
  contrastOk,
  contrastRatio,
  CUSTOM_COLOR_KEYS,
  customColorLabel,
  isValidHex,
  normalizeHex,
  spacing,
  THEME_PRESETS,
  useTheme,
  useThemeContext,
  type CustomColorKey,
  type SemanticColors,
  type ThemeSnapshot,
} from '@/theme';
import { AppBadge, AppButton, AppCard, AppCheckbox, AppEmptyState, AppInput, AppLoading, AppSwitch } from '@/ui/components/app';
import { AppText, Field, Screen, Segmented } from '@/ui/components/primitives';
import { errorMessage, useToast } from '@/ui/hooks';

function snapshotFromSettings(s: AppSettings): ThemeSnapshot {
  return {
    appearance: s.theme,
    presetId: s.themePreset,
    customColors: s.themeCustomColors,
  };
}

function lastUsedFromSettings(s: AppSettings): ThemeLastUsed {
  return {
    theme: s.theme,
    themePreset: s.themePreset,
    themeCustomColors: s.themeCustomColors,
  };
}

function colorFromTheme(theme: SemanticColors, key: CustomColorKey): string {
  return theme[key];
}

export function ThemeSettingsScreen() {
  const settings = useSettings();
  const services = useServices();
  const setSettings = useAppStore((s) => s.setSettings);
  const toast = useToast((s) => s.show);
  const p = useTheme();
  const { setPreview, preview } = useThemeContext();

  const [draftAppearance, setDraftAppearance] = useState<ThemePreference>(settings.theme);
  const [draftPreset, setDraftPreset] = useState<ThemePresetId>(settings.themePreset);
  const [draftCustom, setDraftCustom] = useState<ThemeCustomColors>(settings.themeCustomColors ?? {});
  const [editingKey, setEditingKey] = useState<CustomColorKey>('primary');
  const [hexDraft, setHexDraft] = useState(settings.themeCustomColors?.primary ?? p.primary);
  const [demoChecked, setDemoChecked] = useState(true);
  const [demoSwitch, setDemoSwitch] = useState(true);

  useEffect(() => {
    setPreview({
      appearance: draftAppearance,
      presetId: draftPreset,
      customColors: Object.keys(draftCustom).length ? draftCustom : null,
    });
  }, [draftAppearance, draftPreset, draftCustom, setPreview]);

  useEffect(() => () => setPreview(null), [setPreview]);

  const currentHex = draftCustom[editingKey] ?? colorFromTheme(p, editingKey);
  const hexValid = isValidHex(hexDraft);
  const normalized = hexValid ? normalizeHex(hexDraft) : null;
  const textOnBgOk = contrastOk(p.text, p.background);
  const primaryOnSurfaceOk = contrastOk(p.primary, p.surface);
  const contrastPrimary = useMemo(() => contrastRatio(p.primary, p.surface), [p.primary, p.surface]);

  async function persist(partial: Partial<AppSettings>) {
    try {
      let next = settings;
      for (const [key, value] of Object.entries(partial) as [keyof AppSettings, AppSettings[keyof AppSettings]][]) {
        next = await services.settings.set(key, value);
      }
      setSettings(next);
      return next;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return null;
    }
  }

  async function apply() {
    const before = lastUsedFromSettings(settings);
    const custom = Object.keys(draftCustom).length ? draftCustom : null;
    const next = await persist({
      themeLastUsed: before,
      theme: draftAppearance,
      themePreset: draftPreset,
      themeCustomColors: custom,
    });
    if (next) {
      setPreview(null);
      toast('Theme applied', 'success');
    }
  }

  async function resetDefault() {
    setDraftAppearance('system');
    setDraftPreset('classic-light');
    setDraftCustom({});
    setHexDraft(THEME_PRESETS.find((x) => x.id === 'classic-light')!.light.primary);
    const before = lastUsedFromSettings(settings);
    const next = await persist({
      themeLastUsed: before,
      theme: 'system',
      themePreset: 'classic-light',
      themeCustomColors: null,
    });
    if (next) {
      setPreview(null);
      toast('Reset to Classic Light / system', 'success');
    }
  }

  async function restoreLast() {
    const last = settings.themeLastUsed;
    if (!last) {
      toast('No previous theme saved yet', 'info');
      return;
    }
    setDraftAppearance(last.theme);
    setDraftPreset(last.themePreset);
    setDraftCustom(last.themeCustomColors ?? {});
    const next = await persist({
      theme: last.theme,
      themePreset: last.themePreset,
      themeCustomColors: last.themeCustomColors,
    });
    if (next) {
      setPreview(null);
      toast('Restored last used theme', 'success');
    }
  }

  function selectPreset(id: ThemePresetId) {
    setDraftPreset(id);
    setDraftCustom({});
    const preset = THEME_PRESETS.find((x) => x.id === id)!;
    setHexDraft(preset.light.primary);
  }

  function commitHex() {
    const hex = normalizeHex(hexDraft);
    if (!hex) {
      toast('Enter a valid HEX color like #4F46E5', 'error');
      return;
    }
    setDraftCustom((c) => ({ ...c, [editingKey]: hex }));
  }

  function clearCustomKey() {
    setDraftCustom((c) => {
      const next = { ...c };
      delete next[editingKey];
      return next;
    });
  }

  return (
    <Screen title="Theme" subtitle="Appearance & colors">
      <AppText variant="label" muted>
        APPEARANCE
      </AppText>
      <AppCard>
        <Segmented<ThemePreference>
          testID="theme-appearance-segmented"
          value={draftAppearance}
          onChange={setDraftAppearance}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <AppText variant="caption" muted>
          Preview updates instantly. Tap Apply to save.
          {preview ? ' (previewing)' : ''}
        </AppText>
      </AppCard>

      <AppText variant="label" muted>
        PRESETS
      </AppText>
      <AppCard>
        <View style={styles.presetGrid}>
          {THEME_PRESETS.map((preset) => {
            const selected = draftPreset === preset.id && Object.keys(draftCustom).length === 0;
            return (
              <Pressable
                key={preset.id}
                testID={`theme-preset-${preset.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => selectPreset(preset.id)}
                style={[
                  styles.presetChip,
                  {
                    borderColor: selected ? p.primary : p.border,
                    backgroundColor: selected ? p.primarySoft : p.surfaceVariant,
                  },
                ]}>
                <View style={[styles.swatch, { backgroundColor: preset.swatch }]} />
                <AppText variant="caption" numberOfLines={2} style={{ flex: 1 }}>
                  {preset.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppText variant="label" muted>
        CUSTOM COLORS
      </AppText>
      <AppCard>
        <View style={styles.keyRow}>
          {CUSTOM_COLOR_KEYS.map((key) => {
            const selected = editingKey === key;
            const color = draftCustom[key] ?? colorFromTheme(p, key);
            return (
              <Pressable
                key={key}
                testID={`theme-color-key-${key}`}
                onPress={() => {
                  setEditingKey(key);
                  setHexDraft(color);
                }}
                style={[
                  styles.keyChip,
                  {
                    borderColor: selected ? p.primary : p.border,
                    backgroundColor: selected ? p.primarySoft : p.surface,
                  },
                ]}>
                <View style={[styles.miniSwatch, { backgroundColor: color }]} />
                <AppText variant="caption" numberOfLines={1}>
                  {customColorLabel(key)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <Field label={`${customColorLabel(editingKey)} HEX`} error={hexDraft && !hexValid ? 'Invalid HEX' : null}>
          <View style={styles.hexRow}>
            <View style={[styles.hexPreview, { backgroundColor: normalized ?? currentHex, borderColor: p.border }]} />
            <AppInput
              testID="theme-hex-input"
              value={hexDraft}
              onChangeText={setHexDraft}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="#4F46E5"
              style={{ flex: 1 }}
              invalid={!!hexDraft && !hexValid}
            />
          </View>
        </Field>
        <View style={styles.rowActions}>
          <AppButton label="Set color" tone="secondary" onPress={commitHex} testID="theme-set-color" compact />
          <AppButton label="Clear override" tone="ghost" onPress={clearCustomKey} testID="theme-clear-color" compact />
        </View>
        <AppText variant="caption" muted>
          Contrast: text on background {textOnBgOk ? 'OK' : 'low'} · primary on surface {contrastPrimary.toFixed(2)}:1{' '}
          {primaryOnSurfaceOk ? '(OK)' : '(improve)'}.
        </AppText>
      </AppCard>

      <AppText variant="label" muted>
        LIVE PREVIEW
      </AppText>
      <AppCard testID="theme-preview">
        <AppText variant="heading">Sample heading</AppText>
        <AppText muted>Secondary text on the active surface.</AppText>
        <View style={styles.previewRow}>
          <AppButton label="Primary" onPress={() => undefined} compact />
          <AppButton label="Secondary" tone="secondary" onPress={() => undefined} compact />
          <AppButton label="Danger" tone="danger" onPress={() => undefined} compact />
        </View>
        <View style={styles.previewRow}>
          <AppBadge label="Completed" tone="completed" />
          <AppBadge label="Pending" tone="pending" />
          <AppBadge label="Overdue" tone="overdue" />
        </View>
        <View style={styles.previewRow}>
          <AppCheckbox checked={demoChecked} onChange={setDemoChecked} label="Demo checkbox" />
          <AppSwitch value={demoSwitch} onChange={setDemoSwitch} />
        </View>
        <AppInput placeholder="Sample input" editable={false} />
        <AppEmptyState icon="color-palette-outline" title="Empty state" message="Uses theme tokens." />
        <AppLoading label="Loading sample…" />
      </AppCard>

      <View style={styles.actions}>
        <AppButton label="Apply" onPress={apply} testID="theme-apply" />
        <AppButton label="Reset default" tone="secondary" onPress={resetDefault} testID="theme-reset" />
        <AppButton
          label="Restore last used"
          tone="ghost"
          onPress={restoreLast}
          testID="theme-restore"
          disabled={!settings.themeLastUsed}
        />
      </View>
      <AppText variant="caption" muted>
        Starting from {snapshotFromSettings(settings).presetId}
        {settings.themeCustomColors ? ' (customized)' : ''}.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  presetChip: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  swatch: { width: 28, height: 28, borderRadius: 8 },
  keyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  keyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  miniSwatch: { width: 12, height: 12, borderRadius: 6 },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hexPreview: { width: 40, height: 40, borderRadius: 8, borderWidth: 1 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.sm },
});
