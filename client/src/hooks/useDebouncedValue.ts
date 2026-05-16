import { useEffect, useState } from 'react';

/**
 * Returns `value` after it's been stable for `delayMs` milliseconds.
 *
 * Use to debounce keystroke input that triggers a network query — e.g. wiring
 * an antd `Select`'s `onSearch` to a React-Query hook without firing a request
 * on every character.
 */
export const useDebouncedValue = <T>(value: T, delayMs = 250): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
};
