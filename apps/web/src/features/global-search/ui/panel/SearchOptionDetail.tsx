import type { ReactElement } from 'react';

import { PublicationBadge } from '@/entities/listing';
import {
  SIDE_BADGES,
  SideShape,
} from '@/entities/organization';
import { useI18n } from '@/shared/i18n';

import type { GlobalSearchTranslate } from '../../i18n/globalSearchSection';
import type { SearchOptionValue } from '../../model/searchResultTypes';

import { HighlightedText } from './HighlightedText';

const DETAIL_CLASS_NAME = 'text-sm leading-5 text-on-panel-muted';
const TRUNCATED_DETAIL_CLASS_NAME = `${DETAIL_CLASS_NAME} truncate`;
const CITY_SLOT = '\u001F';

interface SearchOptionDetailProps {
  option: SearchOptionValue;
  t: GlobalSearchTranslate;
}

export const SearchOptionDetail = ({ option, t }: SearchOptionDetailProps): ReactElement | undefined => {
  const { t: mainT } = useI18n();
  const { detail, detailMatches } = option;

  switch (detail.kind) {
    case 'city':
      return undefined;
    case 'organization':
      return (
        <div className={`${DETAIL_CLASS_NAME} flex flex-wrap items-center gap-x-3`}>
          <span className="sr-only">{t('globalSearch.sr.sides')}</span>
          {detail.sides.map(side => (
            <span className="inline-flex items-center gap-1" key={side}>
              <SideShape side={side} />
              {mainT(SIDE_BADGES[side].labelKey)}
            </span>
          ))}
        </div>
      );
    case 'own-listing':
      return (
        <div className="flex items-center">
          <span className="sr-only">{t('globalSearch.sr.status')}</span>
          <PublicationBadge isPublished={detail.isPublished} />
        </div>
      );
    case 'showcase-listing':
      return (
        <div className={TRUNCATED_DETAIL_CLASS_NAME}>
          <span className="sr-only">{t('globalSearch.sr.supplier')}</span>
          <HighlightedText matches={detailMatches} text={detail.supplierName} />
        </div>
      );
    case 'site': {
      const template = t(detail.isOwn ? 'globalSearch.detail.siteOwn' : 'globalSearch.detail.siteForeign', {
        cityName: CITY_SLOT,
      });
      const [before = '', after = ''] = template.split(CITY_SLOT);

      return (
        <div className={TRUNCATED_DETAIL_CLASS_NAME}>
          {before}
          <HighlightedText matches={detailMatches} text={detail.cityName} />
          {after}
        </div>
      );
    }
  }
};
