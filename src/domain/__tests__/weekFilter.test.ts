import { weekFilterToListFilter, type WeekFilterState } from '@/ui/components/WeekFilterBar';
import { weekFolderColumns } from '@/ui/components/PlannerFolderGroups';

describe('weekFilterToListFilter', () => {
  const base: WeekFilterState = {
    text: '',
    status: 'all',
    priority: null,
    categoryId: null,
    folder: null,
  };

  it('maps compact week filters onto ListFilter, including folder and unassigned', () => {
    expect(weekFilterToListFilter(base)).toEqual({
      text: '',
      status: 'all',
      priorities: undefined,
      categoryIds: undefined,
      sort: 'date',
    });
    expect(weekFilterToListFilter({ ...base, folder: 'folder-1', priority: 'high', text: 'report' })).toMatchObject({
      folderId: 'folder-1',
      priorities: ['high'],
      text: 'report',
    });
    expect(weekFilterToListFilter({ ...base, folder: 'unassigned' }).folderAssignment).toBe('unassigned');
  });
});

describe('weekFolderColumns', () => {
  it('keeps 2 columns on phone width and allows 3 on very wide web', () => {
    expect(weekFolderColumns(390)).toBe(2);
    expect(weekFolderColumns(800)).toBe(2);
    expect(weekFolderColumns(1200)).toBe(3);
  });
});
