// src/components/ui/Textarea.jsx
import React from "react";
import { cn } from "../../utils/cn";

const sizeTokens = {
    sm: { padY: "py-2", text: "text-sm", radius: "rounded-md" },
    md: { padY: "py-2.5", text: "text-sm", radius: "rounded-lg" },
    lg: { padY: "py-3", text: "text-base", radius: "rounded-lg" },
};

const Textarea = React.forwardRef(function Textarea(
    {
        id,
        label,
        description,
        error,
        size = "md",
        className = "",
        textareaClassName = "",
        required = false,
        disabled = false,
        minRows = 4,
        maxRows,
        resize = "y",
        style,
        ...props
    },
    ref
) {
    const S = sizeTokens[size] ?? sizeTokens.md;

    const resizeClass =
        resize === "none" ? "resize-none" : resize === "x" ? "resize-x" : resize === "y" ? "resize-y" : "resize";

    return (
        <div className={cn("w-full", className)}>
            {!!label && (
                <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
                    {label}
                    {required && <span className="ml-1 text-error">*</span>}
                </label>
            )}

            <div
                className={cn(
                    "relative border bg-[var(--color-input)]",
                    S.radius,
                    disabled ? "opacity-60 cursor-not-allowed" : "cursor-text",
                    error ? "border-error/60 ring-1 ring-error/30" : "border-border focus-within:ring-2 focus-within:ring-ring/50",
                    "transition-shadow"
                )}
            >
                <textarea
                    id={id}
                    ref={ref}
                    disabled={disabled}
                    rows={minRows}
                    style={maxRows ? { ...style, maxHeight: `${Number(maxRows) * 24}px` } : style}
                    {...props}
                    className={cn(
                        "w-full bg-transparent outline-none placeholder:text-muted-foreground",
                        "px-3",
                        S.padY,
                        S.text,
                        resizeClass,
                        textareaClassName
                    )}
                />
            </div>

            {!!description && !error && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
            {!!error && <div className="mt-1 text-xs text-error">{error}</div>}
        </div>
    );
});

export default Textarea;

