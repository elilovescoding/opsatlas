/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api, getCsrf } from './api';
import type { User } from './types';
const Context = createContext<{
  user: User | null;
  setUser: (u: User | null) => void;
  loading: boolean;
  revision: number;
  refresh: () => void;
}>({ user: null, setUser: () => {}, loading: true, revision: 0, refresh: () => {} });
export function Provider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void getCsrf()
      .then(() => api<User>('/auth/me'))
      .then((member) => {
        if (active) setUser(member);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const expire = () => setUser(null);
    window.addEventListener('session-expired', expire);
    return () => {
      active = false;
      window.removeEventListener('session-expired', expire);
    };
  }, []);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  return (
    <Context.Provider value={{ user, setUser, loading, revision, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
export function useData<T>(path: string, poll = false) {
  const { revision } = useSession();
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<T>(path, { signal: controller.signal })
      .then((value) => {
        setData(value);
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Request failed.');
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [path, revision, tick]);
  useEffect(() => {
    if (!poll) return;
    const id = setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(id);
  }, [poll]);
  return { data, error, loading, retry: () => setTick((t) => t + 1) };
}
