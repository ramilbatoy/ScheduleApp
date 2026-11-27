import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Folder } from '@/domain/models';
import { useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

import { AppText, Icon, Input, type IconName } from './primitives';

type Props = {
  folders: Folder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  /** Include archived folders that match the current value. */
  includeArchivedId?: string | null;
  /** Shown after “None” — opens create-folder flow in the parent. */
  onAddNewFolder?: () => void;
  testID?: string;
};

/**
 * Searchable folder picker for task/event forms.
 * Trigger looks like "Folder: Name ▼". Selecting an option closes the sheet and
 * does not submit the surrounding form (Pressable, not a submit control).
 */
export function FolderSelectDropdown({ folders, value, onChange, includeArchivedId, onAddNewFolder, testID = 'folder-select' }: Props) {
  const p = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const visible = useMemo(() => {
    return folders.filter((f) => f.status !== 'archived' || f.id === includeArchivedId || f.id === value);
  }, [folders, includeArchivedId, value]);

  const selected = visible.find((f) => f.id === value) ?? null;
  const needle = query.trim().toLowerCase();
  const matches = needle ? visible.filter((f) => f.name.toLowerCase().includes(needle) || f.description.toLowerCase().includes(needle)) : visible;

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <View testID={testID}>
      <Pressable
        testID={`${testID}-trigger`}
        accessibilityRole="button"
        accessibilityLabel={selected ? `Folder: ${selected.name}` : 'Folder: None'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: p.surface, borderColor: p.border }]}>
        {selected ? (
          <View style={[styles.swatch, { backgroundColor: `${selected.color}22` }]}>
            <Icon name={selected.icon as IconName} size={16} color={selected.color} />
          </View>
        ) : (
          <Icon name="folder-outline" size={18} color={p.textSecondary} />
        )}
        <AppText style={{ flex: 1 }} numberOfLines={1} color={selected ? p.text : p.textSecondary}>
          Folder: {selected ? (selected.status === 'archived' ? `${selected.name} (archived)` : selected.name) : 'None'}
        </AppText>
        <Icon name="chevron-down" size={18} color={p.textSecondary} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={() => setOpen(false)} accessibilityLabel="Close folder picker" />
          <View style={[styles.sheet, { backgroundColor: p.surface }]} accessibilityViewIsModal>
            <AppText variant="title">Folder</AppText>
            <View style={styles.searchWrap}>
              <View style={styles.searchIcon}>
                <Icon name="search" size={18} color={p.textSecondary} />
              </View>
              <Input
                testID={`${testID}-search`}
                value={query}
                onChangeText={setQuery}
                placeholder="Search folders"
                autoFocus
                style={{ paddingLeft: 40 }}
                returnKeyType="search"
                blurOnSubmit={false}
                // Prevent Enter from acting like a form submit on web.
                onSubmitEditing={() => undefined}
              />
            </View>
            <ScrollView
              style={{ maxHeight: 320 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 4, paddingBottom: spacing.sm }}>
              <Pressable
                testID={`${testID}-none`}
                accessibilityRole="button"
                onPress={() => pick(null)}
                style={[styles.option, !value && { backgroundColor: p.primarySoft }]}>
                <Icon name="folder-outline" size={18} color={p.textSecondary} />
                <AppText color={!value ? p.primary : p.text}>None</AppText>
              </Pressable>
              {onAddNewFolder ? (
                <Pressable
                  testID={`${testID}-add-new`}
                  accessibilityRole="button"
                  accessibilityLabel="Add New Folder"
                  onPress={() => {
                    setOpen(false);
                    onAddNewFolder();
                  }}
                  style={styles.option}>
                  <Icon name="add-circle-outline" size={18} color={p.primary} />
                  <AppText color={p.primary}>Add New Folder</AppText>
                </Pressable>
              ) : null}
              {matches.map((f) => {
                const selectedRow = f.id === value;
                return (
                  <Pressable
                    key={f.id}
                    testID={`${testID}-option-${f.id}`}
                    accessibilityRole="button"
                    onPress={() => pick(f.id)}
                    style={[styles.option, selectedRow && { backgroundColor: p.primarySoft }]}>
                    <View style={[styles.swatch, { backgroundColor: `${f.color}22` }]}>
                      <Icon name={f.icon as IconName} size={16} color={f.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText color={selectedRow ? p.primary : p.text} numberOfLines={1}>
                        {f.status === 'archived' ? `${f.name} (archived)` : f.name}
                      </AppText>
                      {f.description ? (
                        <AppText variant="caption" muted numberOfLines={1}>
                          {f.description}
                        </AppText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              {!matches.length ? (
                <AppText muted testID={`${testID}-empty`} style={{ padding: spacing.md }}>
                  No folders match “{query.trim()}”.
                </AppText>
              ) : null}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.cancel}>
              <AppText color={p.primary}>Cancel</AppText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    zIndex: 1,
  },
  trigger: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchWrap: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  option: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  swatch: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
