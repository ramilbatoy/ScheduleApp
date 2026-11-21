import { EmptyState, Screen } from '@/ui/components/primitives';

export default function TasksScreen() {
  return (
    <Screen title="Tasks">
      <EmptyState icon="checkbox-outline" title="Tasks" message="This view is being built in the next phase." />
    </Screen>
  );
}
