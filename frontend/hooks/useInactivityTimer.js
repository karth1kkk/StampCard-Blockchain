import { useEffect, useRef } from 'react';

const DEFAULT_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export function useInactivityTimer({ timeoutMs, onTimeout, isEnabled = true }) {
  const timerRef = useRef(null);
  const timeoutRef = useRef(timeoutMs);
  const callbackRef = useRef(onTimeout);

  useEffect(() => {
    timeoutRef.current = timeoutMs;
  }, [timeoutMs]);

  useEffect(() => {
    callbackRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') {
      return () => {};
    }

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        if (typeof callbackRef.current === 'function') {
          callbackRef.current();
        }
      }, timeoutRef.current);
    };

    // Start the timer immediately
    resetTimer();

    // Listen to user activity events to reset the timer
    DEFAULT_EVENTS.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      // Cleanup: clear timer and remove event listeners
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      DEFAULT_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isEnabled]);
}


