import { useEffect, useState, useRef, useCallback } from "react"

/**
 * useDebounce hook that returns the debounced value after a given delay.
 * @param {any} value - The input value to debounce.
 * @param {number} delay - The delay in milliseconds (default: 350ms).
 * @returns {any} The debounced value.
 */
export function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * useDebouncedCallback hook that wraps a function call in a debounce timer.
 * @param {Function} callback - The function to call after the delay.
 * @param {number} delay - The delay in milliseconds (default: 350ms).
 * @returns {Function} The debounced function.
 */
export function useDebouncedCallback(callback, delay = 350) {
  const callbackRef = useRef(callback)
  const timerRef = useRef(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const debouncedFn = useCallback(
    (...args) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay]
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return debouncedFn
}
