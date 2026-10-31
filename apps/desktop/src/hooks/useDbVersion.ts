import { useSyncExternalStore } from 'react';
import { sqliteDB } from '../db/sqliteStorage';

/**
 * useDbVersion hook
 *
 * Connects React components to the In-Memory Mirror Storage Engine version counter.
 * Whenever local writes happen or remote PowerSync rows are pulled, the engine increments
 * its internal version and notifies subscribers, causing consumers of this hook to re-render.
 */
export function useDbVersion(): number {
  return useSyncExternalStore(
    (callback) => {
      if ('subscribe' in sqliteDB && typeof sqliteDB.subscribe === 'function') {
        return sqliteDB.subscribe(callback);
      }
      return () => {};
    },
    () => {
      if ('getVersion' in sqliteDB && typeof sqliteDB.getVersion === 'function') {
        return sqliteDB.getVersion();
      }
      return 0;
    }
  );
}
