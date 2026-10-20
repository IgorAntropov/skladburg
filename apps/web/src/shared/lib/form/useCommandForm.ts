import type {
  ChangeEvent,
  FocusEvent,
  SyntheticEvent,
} from 'react';
import type {
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

import type {
  CommandFormOptionsValue,
  CommandFormValue,
  FormFieldBindingValue,
} from './commandFormTypes';

import { createContractResolver } from './createContractResolver';
import { findTopmostField } from './findTopmostField';
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
    shouldFocusError: true,
  });
  const submittedValuesRef = useRef<TValues | undefined>(undefined);
  const handledServerErrorRef = useRef<Error | null>(null);
  const fieldElementsRef = useRef(new Map<string, FieldElementValue>());

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
  const isErrorShownOnFields = serverMapping !== undefined
    && serverMapping.fieldIssues.length > 0
    && serverMapping.unmatched.length === 0;
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

    submittedValuesRef.current = values;
    command.run();
  };

  const handleInvalidSubmit = (): void => {
    console.log('> useCommandForm -> handleInvalidSubmit:', { method: method?.name });
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

    handledServerErrorRef.current = error;
    console.log('> useCommandForm -> showServerViolations:', {
      fieldIssueCount: serverMapping.fieldIssues.length,
      method: method?.name,
      unmatchedCount: serverMapping.unmatched.length,
    });

    for (const { field, ruleId } of serverMapping.fieldIssues) {
      if (isFieldPath(field)) {
        setError(field, { type: ruleId });
      }
    }

    const topmostField = findTopmostField(
      fieldElementsRef.current,
      serverMapping.fieldIssues.map(issue => issue.field),
    );

    if (topmostField !== undefined) {
      fieldElementsRef.current.get(topmostField)?.focus();
    }
  }, [error, fieldNames, method?.name, serverMapping, setError]);

  return {
    command: visibleCommand,
    getFieldProps,
    handleSubmit,
    isRequired,
  };
};
