import { EmptyState, Screen } from '@/ui/components/primitives';

export default function CalendarScreen() {
  return (
    <Screen title="Calendar">
      <EmptyState icon="calendar-outline" title="Calendar" message="This view is being built in the next phase." />
    </Screen>
  );
}
