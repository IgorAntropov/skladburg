import type { RefObject } from 'react';

import {
  useLayoutEffect,
  useState,
} from 'react';

import type { SceneInsetsValue } from '@/shared/lib/viewport';

import {
  areSceneInsetsEqual,
  measureSceneInsets,
  offsetRectByScroll,
  ZERO_SCENE_INSETS,
} from '@/shared/lib/viewport';

export const useSceneInsetsMeasure = (
  sceneRef: RefObject<HTMLElement | null>,
  scrollRootRef: RefObject<HTMLElement | null>,
  freeAreaElement: HTMLElement | null,
): SceneInsetsValue => {
  const [measuredInsets, setMeasuredInsets] = useState<SceneInsetsValue>(ZERO_SCENE_INSETS);

  useLayoutEffect(() => {
    const sceneElement = sceneRef.current;

    if (sceneElement === null || freeAreaElement === null) {
      return undefined;
    }

    const measure = (): void => {
      const scrollRoot = scrollRootRef.current;
      const scrollLeft = window.scrollX + (scrollRoot?.scrollLeft ?? 0);
      const scrollTop = window.scrollY + (scrollRoot?.scrollTop ?? 0);
      const nextInsets = measureSceneInsets(
        sceneElement.getBoundingClientRect(),
        offsetRectByScroll(freeAreaElement.getBoundingClientRect(), scrollLeft, scrollTop),
      );

      setMeasuredInsets(currentInsets => (areSceneInsetsEqual(currentInsets, nextInsets) ? currentInsets : nextInsets));
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(sceneElement);
    observer.observe(freeAreaElement);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sceneRef, scrollRootRef, freeAreaElement]);

  return freeAreaElement === null ? ZERO_SCENE_INSETS : measuredInsets;
};
