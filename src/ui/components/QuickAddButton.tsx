import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import type { DateKey } from '@/domain/models';

import { useTheme } from '../hooks';

/** Floating quick-add; opens the quick-add sheet pre-set to `date`. */
export function QuickAddButton({ date, kind }: { date?: DateKey; kind?: 'task' | 'event' }) {
  const p = useTheme();
  return (
    <Pressable
      testID="quick-add-fab"
      accessibilityRole="button"
      accessibilityLabel="Quick add"
      onPress={() => router.push({ pathname: '/quick-add', params: { ...(date ? { date } : {}), ...(kind ? { kind } : {}) } })}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: p.primary,
          opacity: pressed ? 0.85 : 1,
          shadowColor: p.scheme === 'dark' ? '#000000' : p.text,
        },
      ]}>
      <Ionicons name="add" size={30} color={p.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
