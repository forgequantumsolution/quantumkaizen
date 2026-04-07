import { useEffect } from 'react';
import { useRecentItemsStore } from '@/stores/recentItemsStore';

export function useTrackRecent(
  label: string | undefined,
  path: string,
  type: string,
) {
  const addItem = useRecentItemsStore((s) => s.addItem);
  useEffect(() => {
    if (label) {
      addItem({ id: path, label, path, type });
    }
  }, [label, path, type, addItem]);
}
