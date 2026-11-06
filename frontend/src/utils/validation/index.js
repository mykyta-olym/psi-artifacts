import { useCallback, useMemo, useRef, useState } from 'react';
import { createLogger } from '../../utils/logger';
const logger = createLogger('index');

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_REGEX =
  /^\+?[0-9\s().-]{6,}$/;

const NUMBER_REGEX =
  /^-?\d+(\.\d+)?$/;

const isEmpty = (value) => {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

const makeRule = (name, validate) => {
  const fn = (message, options = {}) => ({
    name,
    message,
    validate: (value, values, context) =>
      validate({ value, values, context, message, options }),
  });
  fn.rule = name;
  return fn;
};

export const required = makeRule('required', ({ value, message }) => {
  if (isEmpty(value)) {
    return message || 'This field is required';
  }
  return null;
});

export const email = makeRule('email', ({ value, message }) => {
  if (isEmpty(value)) return null;
  if (!EMAIL_REGEX.test(String(value).trim())) {
    return message || 'Enter a valid email';
  }
  return null;
});

export const phone = makeRule('phone', ({ value, message }) => {
  if (isEmpty(value)) return null;
  if (!PHONE_REGEX.test(String(value).trim())) {
    return message || 'Enter a valid phone number';
  }
  return null;
});

export const minLength = makeRule('minLength', ({ value, message, options }) => {
  if (isEmpty(value)) return null;
  const len = options?.length ?? 0;
  if (String(value).trim().length < len) {
    return message || `Must be at least ${len} characters`;
  }
  return null;
});

export const maxLength = makeRule('maxLength', ({ value, message, options }) => {
  if (isEmpty(value)) return null;
  const len = options?.length ?? Infinity;
  if (String(value).trim().length > len) {
    return message || `Cannot exceed ${len} characters`;
  }
  return null;
});

export const pattern = makeRule('pattern', ({ value, message, options }) => {
  if (isEmpty(value)) return null;
  const regex = options?.pattern;
  if (!regex) return null;
  if (!regex.test(String(value))) {
    return message || 'Invalid format';
  }
  return null;
});

export const number = makeRule('number', ({ value, message }) => {
  if (isEmpty(value)) return null;
  if (!NUMBER_REGEX.test(String(value).trim())) {
    return message || 'Enter a valid number';
  }
  return null;
});

export const min = makeRule('min', ({ value, message, options }) => {
  if (isEmpty(value)) return null;
  const boundary = options?.value ?? 0;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric) || numeric < boundary) {
    return message || `Must be at least ${boundary}`;
  }
  return null;
});

export const max = makeRule('max', ({ value, message, options }) => {
  if (isEmpty(value)) return null;
  const boundary = options?.value ?? 0;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric) || numeric > boundary) {
    return message || `Must be no more than ${boundary}`;
  }
  return null;
});

export const date = makeRule('date', ({ value, message }) => {
  if (isEmpty(value)) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return message || 'Enter a valid date';
  }
  return null;
});

const resolveOptionValue = (source, payload) => {
  if (typeof source === 'function') {
    try {
      return source(payload);
    } catch (error) {
      logger.warn('[validation] resolver failed', error);
      return undefined;
    }
  }
  return source;
};

export const before = makeRule('before', ({ value, values, message, options, context }) => {
  if (isEmpty(value)) return null;
  const cmpField = options?.field;
  const cmpValue = cmpField
    ? values?.[cmpField]
    : resolveOptionValue(options?.value, { value, values, context, rule: 'before' });
  if (!cmpValue) return null;
  const d1 = new Date(value);
  const d2 = new Date(cmpValue);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  if (d1.getTime() >= d2.getTime()) {
    return (
      message ||
      (cmpField
        ? `Must be before ${options?.label || cmpField}`
        : 'Date is too late')
    );
  }
  return null;
});

export const after = makeRule('after', ({ value, values, message, options, context }) => {
  if (isEmpty(value)) return null;
  const cmpField = options?.field;
  const cmpValue = cmpField
    ? values?.[cmpField]
    : resolveOptionValue(options?.value, { value, values, context, rule: 'after' });
  if (!cmpValue) return null;
  const d1 = new Date(value);
  const d2 = new Date(cmpValue);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  if (d1.getTime() <= d2.getTime()) {
    return (
      message ||
      (cmpField
        ? `Must be after ${options?.label || cmpField}`
        : 'Date is too early')
    );
  }
  return null;
});

export const custom = makeRule('custom', ({ value, values, message, options }) => {
  if (typeof options?.validate !== 'function') return null;
  const result = options.validate(value, values);
  if (typeof result === 'string') return result;
  if (result === false) return message || 'Invalid value';
  return null;
});

const runRuleChain = (value, values, rules, context) => {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  for (const rule of rules) {
    if (!rule) continue;
    const error = rule.validate(value, values, context);
    if (typeof error === 'string' && error.trim()) return error;
  }
  return null;
};

export const createValidator = (schema = {}) => {
  const validateField = (field, value, values, context = {}) => {
    const rules = schema?.[field];
    if (!rules) return null;
    return runRuleChain(value, values, Array.isArray(rules) ? rules : [rules], {
      field,
      ...context,
    });
  };

  const validateMany = (fields, values, context = {}) => {
    const errors = {};
    const names = fields || Object.keys(schema || {});
    names.forEach((field) => {
      const val = values?.[field];
      const message = validateField(field, val, values, context);
      if (message) errors[field] = message;
    });
    return errors;
  };

  return {
    schema,
    validateField,
    validateMany,
  };
};

export const useFormValidator = (
  schema = {},
  {
    validateOnChange = false,
    validateOnBlur = true,
    debounceMs = 0,
  } = {},
) => {
  const validator = useMemo(() => createValidator(schema), [schema]);
  const [errors, setErrors] = useState({});
  const changeTimers = useRef({});

  const clearTimer = useCallback((field) => {
    const timer = changeTimers.current[field];
    if (timer) {
      clearTimeout(timer);
      delete changeTimers.current[field];
    }
  }, []);

  const setFieldError = useCallback((field, message) => {
    setErrors((prev) => {
      if (!message && !prev?.[field]) return prev;
      if (!message) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      if (prev?.[field] === message) return prev;
      return { ...prev, [field]: message };
    });
  }, []);

  const validateField = useCallback(
    (field, value, values, context = {}) => {
      const message = validator.validateField(field, value, values, context);
      setFieldError(field, message);
      return !message;
    },
    [setFieldError, validator],
  );

  const validateFields = useCallback(
    (fields, values, context = {}) => {
      const targeted = Array.isArray(fields) ? fields : [fields];
      const messages = validator.validateMany(targeted, values, context);
      setErrors((prev) => {
        const next = { ...prev };
        targeted.forEach((field) => {
          if (messages[field]) {
            next[field] = messages[field];
          } else {
            delete next[field];
          }
        });
        return next;
      });
      return Object.keys(messages).length === 0;
    },
    [validator],
  );

  const validateAll = useCallback(
    (values, context = {}) => {
      const messages = validator.validateMany(Object.keys(schema), values, context);
      setErrors(messages);
      return Object.keys(messages).length === 0;
    },
    [schema, validator],
  );

  const register = useCallback(
    (field, { values, onChange, onBlur }) => {
      const handleChange = (valueOrEvent) => {
        const nextValue =
          valueOrEvent && valueOrEvent.target
            ? valueOrEvent.target.value
            : valueOrEvent;
        onChange?.(nextValue);
        if (validateOnChange) {
          if (debounceMs > 0) {
            clearTimer(field);
            changeTimers.current[field] = setTimeout(() => {
              validateField(field, nextValue, { ...values.current, [field]: nextValue });
            }, debounceMs);
          } else {
            validateField(field, nextValue, { ...values.current, [field]: nextValue });
          }
        } else if (errors[field]) {
          setFieldError(field, null);
        }
      };

      const handleBlur = (event) => {
        onBlur?.(event);
        if (!validateOnBlur) return;
        const nextValue =
          event && event.target ? event.target.value : values.current?.[field];
        validateField(field, nextValue, values.current);
      };

      return {
        onChange: handleChange,
        onBlur: handleBlur,
        error: errors[field],
        'aria-invalid': Boolean(errors[field]),
      };
    },
    [
      clearTimer,
      debounceMs,
      errors,
      setFieldError,
      validateField,
      validateOnBlur,
      validateOnChange,
    ],
  );

  const resetErrors = useCallback(() => {
    Object.values(changeTimers.current).forEach((timer) => clearTimeout(timer));
    changeTimers.current = {};
    setErrors({});
  }, []);

  return {
    errors,
    setErrors,
    setFieldError,
    validateField,
    validateFields,
    validateAll,
    register,
    resetErrors,
  };
};


