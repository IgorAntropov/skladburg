import type { ReactElement } from 'react';

import { LayoutGrid } from 'lucide-react';

interface ScenePlaceholderProps {
  label: string;
}

const ROOT_CLASS_NAME = 'relative flex size-full items-center justify-center overflow-hidden bg-canvas p-4 text-center';

const BOARD_CLASS_NAME = [
  'pointer-events-none absolute inset-0',
  '[mask-image:radial-gradient(ellipse_at_center,transparent_0,black_70%)]',
].join(' ');

const RISING_LINES_CLASS_NAME = [
  'absolute inset-0',
  'bg-[repeating-linear-gradient(60deg,transparent_0_95px,color-mix(in_srgb,var(--color-line)_55%,transparent)_96px,transparent_97px)]',
].join(' ');

const FALLING_LINES_CLASS_NAME = [
  'absolute inset-0',
  'bg-[repeating-linear-gradient(120deg,transparent_0_95px,color-mix(in_srgb,var(--color-line)_55%,transparent)_96px,transparent_97px)]',
].join(' ');

const LABEL_CLASS_NAME = [
  'relative inline-flex max-w-sm items-center gap-3 rounded-panel border border-line bg-canvas px-5 py-3',
  'text-left text-base text-on-canvas-muted',
].join(' ');

export const ScenePlaceholder = ({ label }: ScenePlaceholderProps): ReactElement => {
  return (
    <div aria-hidden className={ROOT_CLASS_NAME}>
      <span className={BOARD_CLASS_NAME}>
        <span className={RISING_LINES_CLASS_NAME} />
        <span className={FALLING_LINES_CLASS_NAME} />
      </span>
      <p className={LABEL_CLASS_NAME}>
        <LayoutGrid aria-hidden className="size-5 shrink-0" />
        {label}
      </p>
    </div>
  );
};
