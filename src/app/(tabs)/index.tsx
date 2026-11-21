import { EmptyState, Screen } from '@/ui/components/primitives';

export default function TodayScreen() {
  return (
    <Screen title="Today">
      <EmptyState icon="sunny-outline" title="Today" message="This view is being built in the next phase." />
    </Screen>
  );
}
