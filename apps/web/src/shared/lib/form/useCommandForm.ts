import type {
  ChangeEvent,
  FocusEvent,
  SyntheticEvent,
} from 'react';
import type {
  FieldErrors,
  FieldValues,
  Path,
} from 'react-hook-form';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { isFormFieldRequired } from '@skladburg/contracts/forms';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';

import type { CommandValue } from '@/shared/api';

import {
  getFieldViolations,
  useCommand,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { useAnnounce } from '@/shared/ui';

import type {
  CommandFormOptionsValue,
  CommandFormValue,
  FormFieldBindingValue,
} from './commandFormTypes';

import { areFormValuesEqual } from './areFormValuesEqual';
import { createContractResolver } from './createContractResolver';
import { focusTopmostField } from './focusTopmostField';
import { mapServerViolations } from './mapServerViolations';
import { translateFieldViolation } from './translateFieldViolation';

type FieldElementValue = HTMLInputElement | HTMLSelectElement;

export const useCommandForm = <TValues extends FieldValues, TResult>(
  options: CommandFormOptionsValue<TValues, TResult>,
): CommandFormValue<TValues> => {
  const {
    defaultValues,
    execute,
    method,
    onSuccess,
    rules,
  } = options;
  const { t } = useI18n();
  const announce = useAnnounce();
  const [fieldNames] = useState(() => Object.keys(defaultValues));
  const [resolver] = useState(() => createContractResolver<TValues>(rules, fieldNames));
  const {
    formState,
    getFieldState,
    handleSubmit: handleFormSubmit,
    register,
    setError,
    subscribe,
  } = useForm<TValues>({
    defaultValues,
    mode: 'onSubmit',
    resolver,
    reValidateMode: 'onChange',
    shouldFocusError: false,
  });
  const submittedValuesRef = useRef<TValues | undefined>(undefined);
  const handledServerErrorRef = useRef<Error | null>(null);
  const fieldElementsRef = useRef(new Map<string, FieldElementValue>());
  const [unplacedError, setUnplacedError] = useState<Error | null>(null);

  const command = useCommand<TResult>({
    execute: (idempotencyKey) => {
      const values = submittedValuesRef.current;

      return values === undefined
        ? Promise.reject(new Error('The form was not submitted'))
        : execute(values, idempotencyKey);
    },
    method,
    onSuccess,
  });
  const {
    apiError,
    error,
    isPending,
    reset,
  } = command;

  const serverMapping = useMemo(
    () => (apiError?.code === ErrorCode.VALIDATION_FAILED
      ? mapServerViolations(rules, getFieldViolations(apiError), fieldNames)
      : undefined),
    [apiError, fieldNames, rules],
  );
  const hasCommandError = apiError !== undefined;
  const isMappedToFields = serverMapping !== undefined
    && serverMapping.fieldIssues.length > 0
    && serverMapping.unmatched.length === 0;
  const isErrorShownOnFields = isMappedToFields && unplacedError !== error;
  const visibleCommand: CommandValue = isErrorShownOnFields
    ? {
        ...command,
        apiError: undefined,
        error: null,
        failedAt: 0,
      }
    : command;

  const handleValidSubmit = (values: TValues): void => {
    console.log('> useCommandForm -> handleValidSubmit:', { isPending, method: method?.name });

    if (isPending) {
      return;
    }

    const submittedValues = submittedValuesRef.current;

    if (submittedValues !== undefined && !areFormValuesEqual(values, submittedValues)) {
      reset();
    }

    submittedValuesRef.current = values;
    command.run();
  };

  const handleInvalidSubmit = (errors: FieldErrors<TValues>): void => {
    const invalidFields = Object.keys(errors);

    console.log('> useCommandForm -> handleInvalidSubmit:', { invalidCount: invalidFields.length, method: method?.name });
    focusTopmostField(fieldElementsRef.current, invalidFields);
    announce(t('error.validation_failed'));
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    void handleFormSubmit(handleValidSubmit, handleInvalidSubmit)(event);
  };

  const isRequired = (name: Path<TValues>): boolean => isFormFieldRequired(rules, name);

  const getFieldProps = (name: Path<TValues>): FormFieldBindingValue => {
    const registration = register(name);
    const errorType = getFieldState(name, formState).error?.type;

    const handleBlur = (event: FocusEvent<FieldElementValue>): void => {
      void registration.onBlur(event);
    };

    const handleChange = (event: ChangeEvent<FieldElementValue>): void => {
      void registration.onChange(event);
    };

    const handleRef = (instance: FieldElementValue | null): void => {
      registration.ref(instance);

      if (instance === null) {
        fieldElementsRef.current.delete(name);
      }
      else {
        fieldElementsRef.current.set(name, instance);
      }
    };

    return {
      error: errorType === undefined ? undefined : translateFieldViolation(t, errorType),
      isOptional: !isRequired(name),
      isReadOnly: isPending,
      name: registration.name,
      onBlur: handleBlur,
      onChange: handleChange,
      ref: handleRef,
    };
  };

  useEffect(() => {
    if (!hasCommandError || isPending) {
      return undefined;
    }

    return subscribe({
      callback: () => {
        console.log('> useCommandForm -> handleFieldEdit:', { method: method?.name });
        reset();
      },
      formState: { values: true },
    });
  }, [hasCommandError, isPending, method?.name, reset, subscribe]);

  useEffect(() => {
    if (serverMapping === undefined || error === handledServerErrorRef.current) {
      return;
    }

    const isFieldPath = (candidate: string): candidate is Path<TValues> => fieldNames.includes(candidate);
    const issueFields = serverMapping.fieldIssues.map(issue => issue.field);
    const isEveryFieldMounted = issueFields.every(field => fieldElementsRef.current.has(field));

    handledServerErrorRef.current = error;
    console.log('> useCommandForm -> showServerViolations:', {
      fieldIssueCount: serverMapping.fieldIssues.length,
      isEveryFieldMounted,
      method: method?.name,
      unmatchedCount: serverMapping.unmatched.length,
    });

    for (const { field, ruleId } of serverMapping.fieldIssues) {
      if (isFieldPath(field)) {
        setError(field, { type: ruleId });
      }
    }

    focusTopmostField(fieldElementsRef.current, issueFields);

    if (!isEveryFieldMounted) {
      setUnplacedError(error);
    }
    else if (isMappedToFields) {
      announce(t('error.validation_failed'));
    }
  }, [announce, error, fieldNames, isMappedToFields, method?.name, serverMapping, setError, t]);

  return {
    command: visibleCommand,
    getFieldProps,
    handleSubmit,
    isRequired,
  };
};
