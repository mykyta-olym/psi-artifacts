// src/components/ui/PageFooter.jsx
import React from "react";
import { cn } from "../../utils/cn";

const defaultInnerClass =
    "flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground gap-2";

const PageFooter = ({
    left,
    actions = [],
    right = null,
    className,
    containerClassName = "px-6",
    borderClassName = "border-t border-border",
    paddingClassName = "py-4",
    innerClassName = defaultInnerClass,
    actionsWrapperClassName = "flex items-center gap-4",
}) => {
    const leftLines = Array.isArray(left) ? left.filter(Boolean) : left ? [left] : [];
    const hasActions = Array.isArray(actions) && actions.length > 0;

    const now = new Date();

    const resolveLine = (line) => {
        if (!line) return null;
        if (typeof line === "function") {
            try {
                return line(now);
            } catch {
                return "";
            }
        }
        return line;
    };

    const renderedRight =
        right ??
        (hasActions ? (
            <div className={cn(actionsWrapperClassName)}>
                {actions.map((action, idx) => (
                    <React.Fragment key={idx}>{action}</React.Fragment>
                ))}
            </div>
        ) : null);

    if (leftLines.length === 0 && !renderedRight) {
        return null;
    }

    return (
        <footer className={className}>
            <div className={cn(containerClassName)}>
                <div className={cn(borderClassName, paddingClassName)}>
                    <div className={cn(innerClassName)}>
                        {leftLines.length > 0 && (
                            <div>
                                {leftLines.map((line, idx) => {
                                    const resolved = resolveLine(line);
                                    if (!resolved) return null;
                                    return <p key={idx}>{resolved}</p>;
                                })}
                            </div>
                        )}
                        {renderedRight}
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default PageFooter;

