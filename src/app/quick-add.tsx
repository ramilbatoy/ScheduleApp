import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDaysKey, formatDateKey, formatTime, todayKey } from '@/domain/dates';
import type { DateKey, ItemKind, Priority, TimeOfDay } from '@/domain/models';
import { parseQuickAdd } from '@/domain/quickParse';
import { useAppStore, useServices, useSettings } from '@/state/appStore';
import { FolderForm } from '@/ui/components/FolderForm';
import { DatePickerModal, OptionsModal, TimePickerModal } from '@/ui/components/Pickers';
import { FolderSelectDropdown } from '@/ui/components/FolderSelectDropdown';
import { PrioritySelectDropdown } from '@/ui/components/PrioritySelectDropdown';
import { AppText, Badge, Button, Chip, Input, Segmented } from '@/ui/components/primitives';
import { errorMessage, useQuery, useTheme, useToast } from '@/ui/hooks';
import { goBackOrDashboard, useSafeAndroidBack } from '@/ui/navigation';
import { radius, spacing } from '@/ui/theme';

type WhenChoice = 'today' | 'tomorrow' | 'pick-date' | 'add-time';

export default function QuickAddScreen() {
  const params = useLocalSearchParams<{ date?: DateKey; kind?: ItemKind; folderId?: string }>();
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const services = useServices();
  const settings = useSettings();
  const invalidate = useAppStore((s) => s.invalidate);
  const toast = useToast((s) => s.show);
  useSafeAndroidBack();
  const today = todayKey(services.clock);
  const categories = useQuery((s) => s.categories.list(), []);
  const folders = useQuery((s) => s.folders.list(), []);

  /** When opened from Tasks / Events / folder FAB, kind is locked and the Task/Event tab is hidden. */
  const lockedKind = params.kind === 'task' || params.kind === 'event' ? params.kind : null;
  const [kind, setKind] = useState<ItemKind>(lockedKind ?? 'task');
  const [text, setText] = useState('');
  const [date, setDate] = useState<DateKey | null>(null);
  const [time, setTime] = useState<TimeOfDay | null>(null);
  /** Explicit priority from the dropdown; null means inherit folder (or default medium). */
  const [priority, setPriority] = useState<Priority | null>(null);
  const [folderId, setFolderId] = useState<string | null>(typeof params.folderId === 'string' ? params.folderId : null);
  const [picker, setPicker] = useState<null | 'date' | 'time' | 'when'>(null);
  const [makingFolder, setMakingFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today]);
  const effectiveDate = date ?? parsed.date ?? params.date ?? today;
  const effectiveTime = time ?? parsed.time;
  const nlPriority = parsed.priority;
  const chosenPriority = priority ?? nlPriority;
  const selectedFolder = folders.data?.find((f) => f.id === folderId) ?? null;
  const inheriting = !!selectedFolder && chosenPriority == null;
  const effectivePriority = chosenPriority ?? selectedFolder?.priority ?? 'medium';
  const category = parsed.categoryName
    ? (categories.data?.find((c) => c.name.toLowerCase() === parsed.categoryName!.toLowerCase()) ?? null)
    : null;
  const title = parsed.title || text.trim();
  const tomorrow = addDaysKey(today, 1);

  const whenLabel = (() => {
    const parts: string[] = [];
    if (effectiveDate === today) parts.push('Today');
    else if (effectiveDate === tomorrow) parts.push('Tomorrow');
    else parts.push(formatDateKey(effectiveDate, 'EEE, MMM d'));
    if (effectiveTime) parts.push(formatTime(effectiveTime));
    return parts.join(' · ');
  })();

  async function add() {
    if (!title) return;
    setSaving(true);
    setError(null);
    try {
      const reminderOffsetMinutes = effectiveTime ? settings.defaultReminderOffsetMinutes : null;
      if (reminderOffsetMinutes !== null && settings.notificationsEnabled) {
        const perm = await services.reminders.permission();
        if (perm !== 'granted' && perm !== 'unsupported') {
          const next = await services.reminders.requestPermission();
          if (next === 'denied') toast('Item saved, but notification permission is blocked.', 'error');
        }
      }
      await services.tasks.create({
        kind,
        title,
        notes: '',
        categoryId: category?.id ?? null,
        folderId,
        priority: effectivePriority,
        priorityExplicit: !inheriting,
        date: effectiveDate,
        allDay: false,
        startTime: effectiveTime,
        endTime: null,
        deadlineAt: null,
        // Timed items (task or event) get the Settings default reminder offset so alarms schedule immediately.
        reminderOffsetMinutes,
        deadlineReminderOffsetMinutes: null,
        recurrence: null,
      });
      invalidate();
      toast(`${kind === 'event' ? 'Event' : 'Task'} added for ${effectiveDate === today ? 'today' : formatDateKey(effectiveDate, 'EEE, MMM d')}`, 'success');
      goBackOrDashboard();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function moreOptions() {
    router.replace({ pathname: '/item/edit', params: { kind, date: effectiveDate, title, ...(folderId ? { folderId } : {}) } });
  }

  function onFolderChange(nextId: string | null) {
    setFolderId(nextId);
  }

  function onWhenChoice(choice: WhenChoice) {
    setPicker(null);
    if (choice === 'today') setDate(today);
    else if (choice === 'tomorrow') setDate(tomorrow);
    else if (choice === 'pick-date') setPicker('date');
    else setPicker('time');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={goBackOrDashboard} accessibilityLabel="Close quick add" />
      <View style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={[styles.grabber, { backgroundColor: p.border }]} />
        {lockedKind ? null : (
          <Segmented<ItemKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'task', label: 'Task' },
              { value: 'event', label: 'Event' },
            ]}
          />
        )}
        <Input
          testID="quick-title"
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder={kind === 'event' ? 'Add Event here' : 'Add task here'}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        {parsed.matched.length ? (
          <View style={styles.wrap}>
            {parsed.matched.map((m) => (
              <Badge key={m} label={m} color={p.primary} background={p.primarySoft} icon="sparkles" />
            ))}
            {parsed.categoryName && !category ? <Badge label={`No category "${parsed.categoryName}"`} color={p.warning} background={p.warningSoft} /> : null}
          </View>
        ) : null}
        <View style={styles.wrap}>
          <Chip
            testID="quick-when"
            label={whenLabel}
            icon="calendar-outline"
            selected
            onPress={() => setPicker('when')}
          />
          {category ? <Chip label={category.name} color={category.color} selected /> : null}
        </View>

        <View style={styles.folderPriorityRow} testID="quick-folder-priority">
          <View style={styles.folderPriorityCell}>
            <FolderSelectDropdown
              testID="quick-folder"
              folders={folders.data ?? []}
              value={folderId}
              onChange={onFolderChange}
              onAddNewFolder={() => setMakingFolder(true)}
            />
          </View>
          {kind === 'task' ? (
            <View style={styles.folderPriorityCell}>
              <PrioritySelectDropdown
                testID="quick-priority"
                compact
                value={effectivePriority}
                priorityExplicit={!inheriting}
                folderId={folderId}
                folderPriority={selectedFolder?.priority ?? null}
                onChange={({ priority: next }) => setPriority(next)}
              />
            </View>
          ) : null}
        </View>

        {error ? <AppText color={p.error}>{error}</AppText> : null}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button label="More options" tone="secondary" icon="options-outline" onPress={moreOptions} style={{ flex: 1 }} />
          <Button testID="quick-save" label="Add" icon="add" onPress={add} loading={saving} disabled={!title} style={{ flex: 1 }} />
        </View>
      </View>
      <FolderForm
        visible={makingFolder}
        onClose={() => setMakingFolder(false)}
        onSaved={(created) => {
          folders.reload();
          setFolderId(created.id);
          setPriority(null);
        }}
      />
      <OptionsModal<WhenChoice>
        visible={picker === 'when'}
        title={kind === 'event' ? 'When' : 'When'}
        value={
          effectiveDate === today && !effectiveTime
            ? 'today'
            : effectiveDate === tomorrow && !effectiveTime
              ? 'tomorrow'
              : effectiveTime
                ? 'add-time'
                : 'pick-date'
        }
        options={[
          { value: 'today', label: 'Today' },
          { value: 'tomorrow', label: 'Tomorrow' },
          {
            value: 'pick-date',
            label:
              effectiveDate !== today && effectiveDate !== tomorrow
                ? formatDateKey(effectiveDate, 'EEE, MMM d')
                : 'Pick date',
          },
          { value: 'add-time', label: effectiveTime ? formatTime(effectiveTime) : 'Add time' },
        ]}
        onChange={onWhenChoice}
        onClose={() => setPicker(null)}
      />
      <DatePickerModal
        visible={picker === 'date'}
        value={effectiveDate}
        today={today}
        onChange={(d) => {
          setDate(d);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <TimePickerModal
        visible={picker === 'time'}
        value={effectiveTime}
        onChange={(t) => {
          setTime(t);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  folderPriorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  folderPriorityCell: { flexGrow: 1, flexBasis: 160, minWidth: 140 },
});
