import type { ReactElement } from 'react';

import { Fragment } from 'react';

import type { MatchRangeValue } from '../../model/searchResultTypes';

import { splitHighlightedText } from './splitHighlightedText';

const MARK_CLASS_NAME = 'rounded-xs bg-skeleton font-bold text-on-panel box-decoration-clone';

interface HighlightedTextProps {
  matches: readonly MatchRangeValue[];
  text: string;
}

export const HighlightedText = ({ matches, text }: HighlightedTextProps): ReactElement => (
  <>
    {splitHighlightedText(text, matches).map(segment => (
      segment.isMatch
        ? <mark className={MARK_CLASS_NAME} key={segment.start}>{segment.text}</mark>
        : <Fragment key={segment.start}>{segment.text}</Fragment>
    ))}
  </>
);
