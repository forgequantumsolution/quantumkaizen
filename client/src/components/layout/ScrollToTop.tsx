import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * React Router preserves the window scroll position across route changes, so
 * navigating from one page to another (e.g. switching a module's dashboard
 * tabs) leaves the new page scrolled wherever the previous one was. This resets
 * the scroll to the top whenever the path changes — but NOT when only the query
 * string changes, so in-page filters/tabs that use `?tab=` don't jank the scroll.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
}
