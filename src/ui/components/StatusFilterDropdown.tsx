import { useState } from 'react';
import { View } from 'react-native';

import type { StatusFilter } from '@/domain/services/agendaService';
import { AGENDA_STATUS_OPTIONS } from '@/ui/components/AgendaFilterBar';
import { OptionsModal } from '@/ui/components/Pickers';
import { Chip } from '@/ui/components/primitives';

/** Day-scoped statuses (no “Upcoming”). */
export const DAY_STATUS_OPTIONS = AGENDA_STATUS_OPTIONS.filter((s) => s.value !== 'upcoming');

type Props = {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  testID?: string;
};

/** Compact status filter — opens a modal instead of a permanent chip row. */
export function StatusFilterDropdown({ value, onChange, testID = 'status-filter' }: Props) {
  const [open, setOpen] = useState(false);
  const label = DAY_STATUS_OPTIONS.find((s) => s.value === value)?.label ?? 'All';
  return (
    <View testID={testID}>
      <Chip
        testID={`${testID}-trigger`}
        icon="filter-outline"
        label={`Status: ${label}`}
        selected={value !== 'all'}
        onPress={() => setOpen(true)}
      />
      <OptionsModal<StatusFilter>
        visible={open}
        title="Filter by status"
        value={value}
        options={DAY_STATUS_OPTIONS}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
