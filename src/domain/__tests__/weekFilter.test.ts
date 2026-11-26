import { weekFilterToListFilter, type WeekFilterState } from '@/ui/components/WeekFilterBar';
import { folderGridColumns, weekFolderColumns } from '@/ui/layout/folderGrid';

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

describe('folderGridColumns / weekFolderColumns', () => {
  it('uses content-width breakpoints: 1 under 370, 2 through tablet, 3 at desktop', () => {
    expect(folderGridColumns(320)).toBe(1);
    expect(folderGridColumns(360)).toBe(1);
    expect(folderGridColumns(375)).toBe(2);
    expect(weekFolderColumns(390)).toBe(2);
    expect(folderGridColumns(430)).toBe(2);
    expect(folderGridColumns(768)).toBe(2);
    expect(folderGridColumns(1024)).toBe(3);
    expect(weekFolderColumns(1280)).toBe(3);
  });
});
