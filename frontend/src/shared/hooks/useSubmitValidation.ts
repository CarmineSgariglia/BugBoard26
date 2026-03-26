import { useCallback, useState } from "react";

type InvalidFields<T extends string> = Partial<Record<T, boolean>>;

export function useSubmitValidation<T extends string>() {
  const [invalidFields, setInvalidFields] = useState<InvalidFields<T>>({});
  const [hasValidated, setHasValidated] = useState(false);

  const validate = useCallback((validators: Record<T, boolean>) => {
    const nextInvalidFields = Object.fromEntries(
      Object.entries(validators).map(([field, isValid]) => [field, !isValid]),
    ) as InvalidFields<T>;

    setHasValidated(true);
    setInvalidFields(nextInvalidFields);

    return Object.values(nextInvalidFields).every((isInvalid) => !isInvalid);
  }, []);

  const updateFieldValidity = useCallback(
    (field: T, isValid: boolean) => {
      setInvalidFields((current) => {
        if (!hasValidated && current[field] === undefined) {
          return current;
        }

        const nextInvalid = !isValid;
        if (current[field] === nextInvalid) {
          return current;
        }

        return {
          ...current,
          [field]: nextInvalid,
        };
      });
    },
    [hasValidated],
  );

  const resetValidation = useCallback(() => {
    setHasValidated(false);
    setInvalidFields({});
  }, []);

  const hasFieldError = useCallback(
    (field: T) => Boolean(invalidFields[field]),
    [invalidFields],
  );

  return {
    validate,
    updateFieldValidity,
    resetValidation,
    hasFieldError,
  };
}
