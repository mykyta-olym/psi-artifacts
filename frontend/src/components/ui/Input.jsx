import React from "react";
import Icon from "../AppIcon";

import { createLogger } from '../../utils/logger';
const logger = createLogger('Input');

const cx = (...a) => a.filter(Boolean).join(" ");

const sizes = {
    sm: { padY: "py-2", text: "text-sm", icon: 14, radius: "rounded-md" },
    md: { padY: "py-2.5", text: "text-sm", icon: 16, radius: "rounded-lg" },
    lg: { padY: "py-3", text: "text-base", icon: 18, radius: "rounded-lg" },
};

const Input = React.forwardRef(function Input(
    {
        id,
        label,
        description,
        error,
        leadingIcon,
        trailingIcon,
        prefix,
        suffix,
        size = "md",
        className = "",
        inputClassName = "",
        type = "text",
        disabled = false,
        required = false,
        inputRef,
        iconName, // Extract to prevent passing to DOM
        ...inputProps
    },
    ref
) {
    const S = sizes[size] ?? sizes.md;

    const renderIcon = (node, iconSize) => {
        if (!node) return null;
        if (typeof node === "string") {
            return <Icon name={node} size={iconSize} className="opacity-80" />;
        }
        return node;
    };

    const hasLeading = !!leadingIcon || !!prefix;
    const hasTrailing = !!trailingIcon || !!suffix;

    const mergedRef = React.useCallback(
        (node) => {
            if (typeof ref === "function") ref(node);
            else if (ref && "current" in (ref || {})) ref.current = node;
            if (typeof inputRef === "function") inputRef(node);
            else if (inputRef && "current" in (inputRef || {})) inputRef.current = node;
        },
        [ref, inputRef]
    );

    if (type === "checkbox" || type === "radio") {
        logger.warn("[Input] `type` is checkbox/radio — use dedicated <Checkbox /> instead.");
    }

    return (
        <div className={cx("w-full", className)}>
            {!!label && (
                <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
                    {label}
                    {required && <span className="ml-1 text-error">*</span>}
                </label>
            )}

            <div
                className={cx(
                    "relative flex items-stretch border bg-[var(--color-input)]",
                    S.radius,
                    disabled ? "opacity-60 cursor-not-allowed" : "cursor-text",
                    error ? "border-error/60 ring-1 ring-error/30" : "border-border focus-within:ring-2 focus-within:ring-ring/50",
                    "transition-shadow"
                )}
            >
                {(prefix || leadingIcon) && (
                    <div className={cx("pl-2 pr-1 grid place-items-center text-muted-foreground")}>
                        {prefix ?? renderIcon(leadingIcon, S.icon)}
                    </div>
                )}

                <input
                    id={id}
                    ref={mergedRef}
                    type={type}
                    required={required}
                    disabled={disabled}
                    {...inputProps}
                    className={cx(
                        "w-full bg-transparent outline-none placeholder:text-muted-foreground",
                        "px-3",
                        S.padY,
                        S.text,
                        hasLeading ? "pl-1.5" : "",
                        hasTrailing ? "pr-1.5" : "",
                        inputClassName
                    )}
                />

                {(suffix || trailingIcon) && (
                    <div className="pr-2 pl-1 grid place-items-center text-muted-foreground">
                        {suffix ?? renderIcon(trailingIcon, S.icon)}
                    </div>
                )}
            </div>

            {!!description && !error && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
            {!!error && <div className="mt-1 text-xs text-error">{error}</div>}
        </div>
    );
});

export default Input;