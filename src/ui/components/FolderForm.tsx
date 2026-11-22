import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateKey, todayKey } from '@/domain/dates';
import { PRIORITIES, type DateKey, type Folder, type Priority } from '@/domain/models';
import type { FolderInput } from '@/domain/services/folderService';
import { FOLDER_COLORS, FOLDER_ICONS } from '@/domain/services/folderService';
import { useServices } from '@/state/appStore';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { DatePickerModal } from '@/ui/components/Pickers';
import { AppText, Button, Chip, Field, Icon, Input, type IconName } from '@/ui/components/primitives';
import { errorMessage, useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

const EMPTY: FolderInput = {
  name: '',
  description: '',
  color: FOLDER_COLORS[6] ?? '#6366F1',
  icon: 'folder-outline',
  targetDate: null,
  priority: 'medium',
};

export function FolderForm(props: {
  visible: boolean;
  folder?: Folder | null;
  onClose: () => void;
  onSaved: (folder: Folder) => void;
}) {
  return <FolderFormBody key={`${props.visible ? '1' : '0'}:${props.folder?.id ?? 'new'}:${props.folder?.updatedAt ?? ''}`} {...props} />;
}

function FolderFormBody({
  visible,
  folder,
  onClose,
  onSaved,
}: {
  visible: boolean;
  folder?: Folder | null;
  onClose: () => void;
  onSaved: (folder: Folder) => void;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const services = useServices();
  const today = todayKey(services.clock);
  const [value, setValue] = useState<FolderInput>(() =>
    folder
      ? { name: folder.name, description: folder.description, color: folder.color, icon: folder.icon, targetDate: folder.targetDate, priority: folder.priority }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = folder ? await services.folders.update(folder.id, value) : await services.folders.create(value);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={onClose} accessibilityLabel="Close folder editor" />
      <View style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + spacing.lg, maxHeight: '92%' }]}>
        <AppText variant="title">{folder ? 'Edit folder' : 'New folder'}</AppText>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
          <Field label="Name">
            <Input testID="folder-name" value={value.name} onChangeText={(name) => setValue((v) => ({ ...v, name }))} placeholder="e.g. Website launch" maxLength={60} />
          </Field>
          <Field label="Description">
            <Input testID="folder-description" value={value.description ?? ''} onChangeText={(description) => setValue((v) => ({ ...v, description }))} placeholder="Optional" multiline maxLength={500} />
          </Field>
          <Field label="Color">
            <View style={styles.wrap}>
              {FOLDER_COLORS.map((color) => (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${color}`}
                  onPress={() => setValue((v) => ({ ...v, color }))}
                  style={[styles.swatch, { backgroundColor: color }, value.color === color && { borderColor: p.text, borderWidth: 2 }]}
                />
              ))}
            </View>
          </Field>
          <Field label="Icon">
            <View style={styles.wrap}>
              {FOLDER_ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  accessibilityRole="button"
                  accessibilityLabel={icon}
                  onPress={() => setValue((v) => ({ ...v, icon }))}
                  style={[styles.iconPick, { backgroundColor: value.icon === icon ? p.primarySoft : p.surfaceVariant }]}>
                  <Icon name={icon as IconName} color={value.icon === icon ? p.primary : p.textSecondary} />
                </Pressable>
              ))}
            </View>
          </Field>
          <Field label="Priority" hint="Tasks without their own priority use this.">
            <View style={styles.wrap}>
              {PRIORITIES.map((pr) => (
                <Chip key={pr} label={PRIORITY_LABEL[pr]} color={p.priority[pr]} selected={value.priority === pr} onPress={() => setValue((v) => ({ ...v, priority: pr as Priority }))} />
              ))}
            </View>
          </Field>
          <Field label="Target date" hint="A project deadline. It does not move task dates.">
            <View style={styles.wrap}>
              <Chip
                testID="folder-target"
                icon="flag-outline"
                label={value.targetDate ? formatDateKey(value.targetDate, 'MMM d, yyyy') : 'No target'}
                selected={!!value.targetDate}
                onPress={() => setPickingDate(true)}
              />
              {value.targetDate ? <Chip label="Clear" onPress={() => setValue((v) => ({ ...v, targetDate: null }))} /> : null}
            </View>
          </Field>
          {error ? <AppText color={p.error}>{error}</AppText> : null}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button label="Cancel" tone="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button testID="folder-save" label={folder ? 'Save' : 'Create'} onPress={save} loading={saving} disabled={!value.name.trim()} style={{ flex: 1 }} />
        </View>
      </View>
      <DatePickerModal
        visible={pickingDate}
        value={value.targetDate ?? null}
        today={today}
        title="Target date"
        onChange={(targetDate: DateKey) => setValue((v) => ({ ...v, targetDate }))}
        onClose={() => setPickingDate(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  iconPick: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
