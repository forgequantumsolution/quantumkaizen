import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ROUTE_MAP: Record<string, string> = {
  'g d': '/dashboard',
  'g a': '/qms/audits',
  'g c': '/qms/capa',
  'g r': '/qms/risks',
  'g n': '/qms/non-conformances',
  'g s': '/qms/suppliers',
  'g f': '/qms/fmea',
  'g t': '/lms/training',
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let buffer = '';
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      // N = new record (navigate to /new of current path)
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const current = window.location.pathname;
        // Only if we're on a list page (no /new or /:id)
        if (!current.endsWith('/new') && !/\/[a-z0-9-]{8,}$/.test(current)) {
          navigate(`${current}/new`);
        }
        return;
      }

      // Esc = go back if on detail/create page
      if (e.key === 'Escape') {
        const current = window.location.pathname;
        if (current.includes('/new') || /\/[a-z0-9-]{8,}$/.test(current)) {
          navigate(-1);
        }
        return;
      }

      // g + letter sequences
      if (e.key === 'g' || (buffer === 'g' && e.key.length === 1)) {
        buffer += (buffer ? ' ' : '') + e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buffer = ''; }, 1000);
        const route = ROUTE_MAP[buffer];
        if (route) {
          navigate(route);
          buffer = '';
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(timer);
    };
  }, [navigate]);
}
