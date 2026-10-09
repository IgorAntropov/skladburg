import type {
  Ref,
  RefCallback,
} from 'react';

export const mergeRefs = <TElement>(...refs: readonly (Ref<TElement> | undefined)[]): RefCallback<TElement> => {
  return (element) => {
    const cleanups: (() => void)[] = [];

    for (const ref of refs) {
      if (typeof ref === 'function') {
        const cleanup = ref(element);

        cleanups.push(typeof cleanup === 'function' ? cleanup : () => ref(null));
      }
      else if (ref !== null && ref !== undefined) {
        ref.current = element;
        cleanups.push(() => {
          ref.current = null;
        });
      }
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  };
};
