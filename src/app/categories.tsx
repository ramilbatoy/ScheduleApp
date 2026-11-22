import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Category } from '@/domain/models';
import { CATEGORY_PALETTE } from '@/domain/services/categoryService';
import { Sheet } from '@/ui/components/Pickers';
import { AppText, Button, Card, Divider, EmptyState, ErrorState, Field, Icon, IconButton, Input, LoadingState } from '@/ui/components/primitives';
import { useAppStore, useServices } from '@/state/appStore';
import { errorMessage, useAction, useQuery, useTheme, useToast } from '@/ui/hooks';
import { useSafeAndroidBack } from '@/ui/navigation';
import { radius, spacing } from '@/ui/theme';

type Editing = { category: Category | null } | null;

export default function CategoriesScreen() {
  const p = useTheme();
  useSafeAndroidBack();
  const list = useQuery(async (s) => ({ categories: await s.categories.list(), usage: await s.categories.usage() }), []);
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Categories',
          headerRight: () => <IconButton icon="add" label="Add category" testID="category-add" onPress={() => setEditing({ category: null })} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: p.background }}>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingState />
        ) : list.data.categories.length === 0 ? (
          <EmptyState
            icon="pricetags-outline"
            title="No categories"
            message="Categories color-code your schedule and power the statistics breakdown."
            action={<Button label="Add category" icon="add" onPress={() => setEditing({ category: null })} />}
          />
        ) : (
          <Card>
            {list.data.categories.map((c, idx) => {
              const n = list.data!.usage[c.id] ?? 0;
              return (
                <View key={c.id}>
                  {idx > 0 ? <Divider /> : null}
                  <Pressable
                    testID={`category-${c.name}`}
                    onPress={() => setEditing({ category: c })}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${c.name}, ${n} items`}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                    <View style={[styles.swatch, { backgroundColor: c.color }]} />
                    <View style={{ flex: 1 }}>
                      <AppText>{c.name}</AppText>
                      <AppText variant="caption" muted>
                        {`${n} item${n === 1 ? '' : 's'}${c.isDefault ? ' · default' : ''}`}
                      </AppText>
                    </View>
                    <Icon name="create-outline" size={18} color={p.textMuted} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
        <AppText variant="caption" muted>
          Deleting a category never deletes its tasks or events — they become uncategorized.
        </AppText>
      </ScrollView>
      {editing ? (
        <CategoryEditor
          category={editing.category}
          usage={editing.category ? (list.data?.usage[editing.category.id] ?? 0) : 0}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function CategoryEditor({ category, usage, onClose }: { category: Category | null; usage: number; onClose: () => void }) {
  const p = useTheme();
  const run = useAction();
  const services = useServices();
  const invalidate = useAppStore((st) => st.invalidate);
  const toast = useToast((st) => st.show);
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? CATEGORY_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (category) await services.categories.update(category.id, name, color);
      else await services.categories.create(name, color);
      invalidate();
      toast(category ? 'Category updated' : 'Category added', 'success');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!category) return;
    const n = await run((s) => s.categories.delete(category.id), 'Category deleted');
    if (n !== undefined) onClose();
  }

  return (
    <Sheet visible onClose={onClose} title={category ? 'Edit category' : 'New category'}>
      <Field label="Name" error={error}>
        <Input
          testID="category-name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder="e.g. Errands"
          maxLength={40}
          autoFocus={!category}
          invalid={!!error}
          onSubmitEditing={save}
        />
      </Field>
      <Field label="Color">
        <View style={styles.palette} accessibilityRole="radiogroup">
          {CATEGORY_PALETTE.map((c) => (
            <Pressable
              key={c}
              testID={`color-${c}`}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityState={{ checked: c === color }}
              accessibilityLabel={`Color ${c}`}
              style={[styles.colorDot, { backgroundColor: c, borderColor: c === color ? p.text : 'transparent' }]}>
              {c === color ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
            </Pressable>
          ))}
        </View>
      </Field>
      {confirmingDelete && category ? (
        <View style={[styles.confirm, { backgroundColor: p.dangerSoft }]} testID="category-delete-confirm">
          <AppText color={p.danger}>
            {usage
              ? `Delete "${category.name}"? ${usage} item${usage === 1 ? '' : 's'} will become uncategorized. They will not be deleted.`
              : `Delete "${category.name}"? No items use it.`}
          </AppText>
          <View style={styles.actions}>
            <View style={{ flex: 1 }} />
            <Button label="Keep" tone="ghost" compact onPress={() => setConfirmingDelete(false)} />
            <Button label="Delete category" tone="danger" compact onPress={remove} testID="category-delete-yes" />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {category ? (
            <Button label="Delete" tone="danger" icon="trash-outline" compact onPress={() => setConfirmingDelete(true)} testID="category-delete" />
          ) : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" tone="ghost" compact onPress={onClose} />
          <Button label="Save" compact loading={busy} onPress={save} testID="category-save" />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorDot: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  confirm: { borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
