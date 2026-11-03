const SCOPE_KEY_INDEX = 2;

interface PreviousQueryValue {
  queryKey: readonly unknown[];
}

export const keepScopedPlaceholder = <TData>(
  scope: string,
): ((previousData: TData | undefined, previousQuery: PreviousQueryValue | undefined) => TData | undefined) => (
  previousData,
  previousQuery,
) => (previousQuery?.queryKey[SCOPE_KEY_INDEX] === scope ? previousData : undefined);
