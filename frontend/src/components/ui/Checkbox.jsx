// src/components/ui/Checkbox.jsx
import React, { useEffect, useId, useRef } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "../../utils/cn";

const Checkbox = React.forwardRef(({
                                       className,
                                       id,
                                       checked,
                                       indeterminate = false,
                                       disabled = false,
                                       required = false,
                                       label,
                                       description,
                                       error,
                                       size = "default",
                                       ...props
                                   }, ref) => {
    const reactId = useId();
    const checkboxId = id ?? `checkbox-${reactId}`;

    const innerRef = useRef(null);
    const setRefs = (node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
    };

    useEffect(() => {
        if (innerRef.current) {
            innerRef.current.indeterminate = !!indeterminate && !checked;
        }
    }, [indeterminate, checked]);

    const sizeBox = {
        sm: "h-4 w-4",
        default: "h-4 w-4",
        lg: "h-5 w-5"
    }[size] || "h-4 w-4";

    const iconSize = size === "lg" ? "h-4 w-4" : "h-3 w-3";

    return (
        <div className={cn("flex items-start space-x-2", className)}>
            <div className="relative flex items-center">
                <input
                    type="checkbox"
                    ref={setRefs}
                    id={checkboxId}
                    checked={checked}
                    disabled={disabled}
                    required={required}
                    aria-invalid={!!error || undefined}
                    className="sr-only"
                    {...props}
                />

                <label
                    htmlFor={checkboxId}
                    className={cn(
                        "grid place-items-center shrink-0 rounded-sm border ring-offset-background transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "cursor-pointer",
                        sizeBox,
                        (checked || indeterminate) && "bg-primary text-primary-foreground border-primary",
                        !checked && !indeterminate && "bg-background border-primary/40",
                        error && "border-destructive",
                        disabled && "cursor-not-allowed opacity-50"
                    )}
                >
                    {checked && !indeterminate && (
                        <Check className={cn(iconSize, "text-current")} aria-hidden="true" />
                    )}
                    {indeterminate && (
                        <Minus className={cn(iconSize, "text-current")} aria-hidden="true" />
                    )}
                </label>
            </div>

            {(label || description || error) && (
                <div className="flex-1 space-y-1">
                    {label && (
                        <label
                            htmlFor={checkboxId}
                            className={cn(
                                "text-sm font-medium leading-none cursor-pointer",
                                disabled && "cursor-not-allowed opacity-70",
                                error ? "text-destructive" : "text-foreground"
                            )}
                        >
                            {label}
                            {required && <span className="text-destructive ml-1">*</span>}
                        </label>
                    )}

                    {description && !error && (
                        <p className="text-sm text-muted-foreground">{description}</p>
                    )}

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>
            )}
        </div>
    );
});
Checkbox.displayName = "Checkbox";

const CheckboxGroup = React.forwardRef(({
                                            className,
                                            children,
                                            label,
                                            description,
                                            error,
                                            required = false,
                                            disabled = false,
                                            ...props
                                        }, ref) => {
    return (
        <fieldset
            ref={ref}
            disabled={disabled}
            className={cn("space-y-3", className)}
            aria-invalid={!!error || undefined}
            {...props}
        >
            {label && (
                <legend className={cn(
                    "text-sm font-medium",
                    error ? "text-destructive" : "text-foreground"
                )}>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </legend>
            )}

            {description && !error && (
                <p className="text-sm text-muted-foreground">{description}</p>
            )}

            <div className="space-y-2">{children}</div>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </fieldset>
    );
});
CheckboxGroup.displayName = "CheckboxGroup";

export { Checkbox, CheckboxGroup };