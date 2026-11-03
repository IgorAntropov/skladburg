import type { SyntheticEvent } from 'react';
import type {
  FieldErrors,
  FieldValues,
  Path,
  PathValue,
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
  FormFieldOptionsValue,
} from './commandFormTypes';

import { areFormValuesEqual } from './areFormValuesEqual';
import { collectErrorPaths } from './collectErrorPaths';
import { collectFieldNames } from './collectFieldNames';
import { createContractResolver } from './createContractResolver';
import { focusTopmostField } from './focusTopmostField';
import { mapServerViolations } from './mapServerViolations';
import { translateFieldViolation } from './translateFieldViolation';

type FieldElementValue = HTMLInputElement | HTMLSelectElement;

export const useCommandForm = <TInput extends FieldValues, TResult, TOutput = TInput>(
  options: CommandFormOptionsValue<TInput, TResult, TOutput>,
): CommandFormValue<TInput> => {
  const {
    defaultValues,
    execute,
    mapViolationPath,
    method,
    onSuccess,
    rules,
    runCheck,
    translateViolation,
    validateValues,
    watchedFields,
  } = options;
  const { t } = useI18n();
  const announce = useAnnounce();
  const [fieldNames] = useState(() => collectFieldNames(defaultValues));
  const resolver = useMemo(
    () => createContractResolver<TInput, TOutput>(rules, fieldNames, { runCheck, validateValues }),
    [fieldNames, rules, runCheck, validateValues],
  );
  const {
    clearErrors,
    formState,
    getFieldState,
    getValues,
    handleSubmit: handleFormSubmit,
    register,
    reset: resetForm,
    setError,
    setValue,
    subscribe,
  } = useForm<TInput, unknown, TOutput>({
    defaultValues,
    mode: 'onSubmit',
    resolver,
    reValidateMode: 'onChange',
    shouldFocusError: false,
  });
  const [, setValuesRevision] = useState(0);

  const submittedValuesRef = useRef<TOutput | undefined>(undefined);
  const [submittedValues, setSubmittedValues] = useState<TOutput | undefined>(undefined);
  const handledServerErrorRef = useRef<Error | null>(null);
  const fieldElementsRef = useRef(new Map<string, FieldElementValue>());
  const [unplacedError, setUnplacedError] = useState<Error | null>(null);

  const handleCommandSuccess = (result: TResult): void => {
    console.log('> useCommandForm -> handleCommandSuccess:', { method: method?.name });
    resetForm(getValues(), { keepValues: true });
    onSuccess?.(result);
  };

  const command = useCommand<TResult>({
    execute: (idempotencyKey) => {
      const values = submittedValuesRef.current;

      return values === undefined
        ? Promise.reject(new Error('The form was not submitted'))
        : execute(values, idempotencyKey);
    },
    method,
    onSuccess: handleCommandSuccess,
  });
  const {
    apiError,
    error,
    isPending,
    reset,
  } = command;

  const serverMapping = useMemo(
    () => (apiError?.code === ErrorCode.VALIDATION_FAILED
      ? mapServerViolations(
          rules,
          getFieldViolations(apiError),
          fieldNames,
          submittedValues === undefined ? undefined : fieldPath => mapViolationPath?.(fieldPath, submittedValues) ?? fieldPath,
        )
      : undefined),
    [apiError, fieldNames, mapViolationPath, rules, submittedValues],
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

  const handleValidSubmit = (values: TOutput): void => {
    console.log('> useCommandForm -> handleValidSubmit:', { isPending, method: method?.name });

    if (isPending) {
      return;
    }

    const previousValues = submittedValuesRef.current;

    if (previousValues !== undefined && !areFormValuesEqual(values, previousValues)) {
      reset();
    }

    submittedValuesRef.current = values;
    setSubmittedValues(values);
    command.run();
  };

  const handleInvalidSubmit = (errors: FieldErrors<TInput>): void => {
    const invalidFields = collectErrorPaths(errors);

    console.log('> useCommandForm -> handleInvalidSubmit:', { invalidCount: invalidFields.length, method: method?.name });
    focusTopmostField(fieldElementsRef.current, invalidFields);
    announce(t('error.validation_failed'));
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    void handleFormSubmit(handleValidSubmit, handleInvalidSubmit)(event);
  };

  const isRequired = (name: Path<TInput>): boolean => isFormFieldRequired(rules, name);

  const watchField = <TName extends Path<TInput>>(name: TName): PathValue<TInput, TName> => getValues(name);

  const setFieldValue = <TName extends Path<TInput>>(name: TName, value: PathValue<TInput, TName>): void => {
    setValue(name, value, { shouldDirty: true });
    clearErrors(name);
  };

  const getFieldProps = (name: Path<TInput>, fieldOptions?: FormFieldOptionsValue): FormFieldBindingValue => {
    const mask = fieldOptions?.mask;
    const registration = register(name);
    const errorType = getFieldState(name, formState).error?.type;
    const errorText = errorType === undefined
      ? undefined
      : (translateViolation?.(errorType) ?? translateFieldViolation(t, errorType));

    const handleEvent = (event: SyntheticEvent<FieldElementValue>): void => {
      void registration.onChange(
        mask === undefined ? event : { target: { name, value: mask.unmask(event.currentTarget.value) }, type: event.type },
      );
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
      error: errorText,
      isOptional: !isRequired(name),
      isReadOnly: isPending,
      ...(mask === undefined ? {} : { mask, onInput: handleEvent }),
      name: registration.name,
      onBlur: handleEvent,
      onChange: handleEvent,
      ref: handleRef,
    };
  };

  useEffect(() => {
    if (watchedFields === undefined || watchedFields.length === 0) {
      return undefined;
    }

    return subscribe({
      callback: () => {
        setValuesRevision(revision => revision + 1);
      },
      formState: { values: true },
      name: watchedFields,
    });
  }, [subscribe, watchedFields]);

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

    const isFieldPath = (candidate: string): candidate is Path<TInput> => fieldNames.includes(candidate);
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
    isDirty: formState.isDirty,
    isRequired,
    setFieldValue,
    watchField,
  };
};
