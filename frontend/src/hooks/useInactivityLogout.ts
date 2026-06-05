import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore.js';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS     = 60 * 1000;        // show warning 60 s before logout
const TICK_INTERVAL_MS      = 1_000;            // check every second

export interface InactivityState {
  showWarning: boolean;
  secondsLeft: number;
  resetTimer: () => void;
}

export function useInactivityLogout(): InactivityState {
  const logout        = useAuthStore((s) => s.logout);
  const isAuth        = useAuthStore((s) => s.isAuthenticated);
  const lastActivity  = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const resetTimer = useCallback((): void => {
    lastActivity.current = Date.now();
    setShowWarning(false);
    setSecondsLeft(0);
  }, []);

  // Listen to mouse movement only
  useEffect(() => {
    if (!isAuth) return;
    const onMove = (): void => { lastActivity.current = Date.now(); };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isAuth]);

  // Tick: evaluate inactivity every second
  useEffect(() => {
    if (!isAuth) return;

    const id = setInterval((): void => {
      const idleMs = Date.now() - lastActivity.current;
      const remaining = INACTIVITY_TIMEOUT_MS - idleMs;

      if (remaining <= 0) {
        clearInterval(id);
        logout();
        return;
      }

      if (remaining <= WARNING_BEFORE_MS) {
        setShowWarning(true);
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        setShowWarning(false);
        setSecondsLeft(0);
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isAuth, logout]);

  return { showWarning, secondsLeft, resetTimer };
}
