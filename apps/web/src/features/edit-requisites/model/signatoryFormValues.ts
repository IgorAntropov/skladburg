import type { Signatory } from '@skladburg/contracts/organization/v1/requisites';

import { create } from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import {
  SignatoryBasis,
  SignatorySchema,
} from '@skladburg/contracts/organization/v1/requisites';

import {
  formatIsoCalendarDate,
  parseIsoCalendarDate,
} from '../lib/calendarDateIso';

export interface SignatoryFormValues {
  signatory: SignatoryFieldsValue<string>;
}

export interface SignatoryUpdateValue {
  signatory: SignatoryFieldsValue<SignatoryBasis>;
}

interface SignatoryFieldsValue<TBasis> {
  basis: TBasis;
  fullName: string;
  position: string;
  powerOfAttorneyDate: string;
  powerOfAttorneyNumber: string;
}

export const toSignatoryFormValues = (signatory: Signatory | undefined): SignatoryFormValues => {
  if (signatory === undefined) {
    return {
      signatory: {
        basis: String(SignatoryBasis.CHARTER),
        fullName: '',
        position: '',
        powerOfAttorneyDate: '',
        powerOfAttorneyNumber: '',
      },
    };
  }

  const { powerOfAttorneyDate } = signatory;

  return {
    signatory: {
      basis: String(signatory.basis),
      fullName: signatory.fullName,
      position: signatory.position,
      powerOfAttorneyDate: powerOfAttorneyDate === undefined ? '' : formatIsoCalendarDate(powerOfAttorneyDate),
      powerOfAttorneyNumber: signatory.powerOfAttorneyNumber,
    },
  };
};

export const toSignatoryInput = (values: SignatoryUpdateValue, id: string, isDefault: boolean): Signatory => {
  const { signatory } = values;
  const isPowerOfAttorney = signatory.basis === SignatoryBasis.POWER_OF_ATTORNEY;
  const parsedDate = isPowerOfAttorney ? parseIsoCalendarDate(signatory.powerOfAttorneyDate) : undefined;

  return create(SignatorySchema, {
    basis: signatory.basis,
    fullName: signatory.fullName.trim(),
    id,
    isDefault,
    position: signatory.position.trim(),
    powerOfAttorneyDate: parsedDate === undefined ? undefined : create(CalendarDateSchema, parsedDate),
    powerOfAttorneyNumber: isPowerOfAttorney ? signatory.powerOfAttorneyNumber.trim() : '',
  });
};
