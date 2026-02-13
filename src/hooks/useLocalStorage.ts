import { useState, useEffect } from 'react';
import { saveToStorage, getFromStorage } from '../utils/storage';

/**
 * Custom hook for syncing state with localStorage
 * @param key - localStorage key
 * @param initialValue - Initial value if no stored value exists
 * @returns [value, setValue] tuple similar to useState
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = getFromStorage<T>(key);
    return item !== null ? item : initialValue;
  });

  // Update localStorage when state changes
  useEffect(() => {
    saveToStorage(key, storedValue);
  }, [key, storedValue]);

  // Wrapper function to match useState API
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Match React's functional setState behavior to avoid stale updates.
      setStoredValue((currentValue) =>
        value instanceof Function ? value(currentValue) : value
      );
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
