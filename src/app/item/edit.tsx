import { useLocalSearchParams } from 'expo-router';

import type { DateKey, ItemKind } from '@/domain/models';
import type { EditScope } from '@/domain/services/taskService';
import { ItemForm } from '@/ui/screens/ItemForm';

export default function EditItemScreen() {
  const params = useLocalSearchParams<{ id?: string; scope?: EditScope; date?: DateKey; kind?: ItemKind; title?: string; folderId?: string }>();
  return <ItemForm params={params} />;
}
