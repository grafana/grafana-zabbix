import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

type FunctionReturningPromise = (...args: any[]) => Promise<any>;

interface AsyncState<T> {
  loading: boolean;
  error?: Error;
  value?: T;
}

type AsyncFnReturn<T extends FunctionReturningPromise> = [AsyncState<Awaited<ReturnType<T>>>, T];

/**
 * Minimal replacement for react-use's `useAsyncFn`. Returns the latest async
 * state ({ loading, value, error }) together with a memoized callback that runs
 * the async function and updates that state. Stale and post-unmount updates are
 * ignored so only the most recent invocation can set the result.
 */
export function useAsyncFn<T extends FunctionReturningPromise>(
  fn: T,
  deps: DependencyList = [],
  initialState: AsyncState<Awaited<ReturnType<T>>> = { loading: false }
): AsyncFnReturn<T> {
  const lastCallId = useRef(0);
  const isMounted = useRef(true);
  const [state, setState] = useState<AsyncState<Awaited<ReturnType<T>>>>(initialState);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const callback = useCallback((...args: Parameters<T>) => {
    const callId = ++lastCallId.current;

    setState((prevState) => (prevState.loading ? prevState : { ...prevState, loading: true }));

    return fn(...args).then(
      (value) => {
        if (isMounted.current && callId === lastCallId.current) {
          setState({ value, loading: false });
        }
        return value;
      },
      (error) => {
        if (isMounted.current && callId === lastCallId.current) {
          setState({ error, loading: false });
        }
        return error;
      }
    );
    // The deps are forwarded from the caller, so they cannot be a static array literal here.
    // eslint-disable-next-line react-hooks/use-memo
  }, deps) as T;

  return [state, callback];
}
