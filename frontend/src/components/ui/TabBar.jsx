import React from 'react';
import Button from './Button';
import { cn } from '../../utils/cn';

export default function TabBar({
    items = [],
    value,
    onChange,
    size = 'sm',
    className = '',
    buttonClassName = '',
    gapClassName = 'gap-2',
    ariaLabel,
    activeVariant = 'default',
    inactiveVariant = 'outline',
}) {
    return (
        <div
            className={cn('flex flex-wrap items-center', gapClassName, className)}
            role="tablist"
            aria-label={ariaLabel}
        >
            {items.map((item) => {
                const isActive = item.value === value;
                const iconName = item.icon ?? item.iconName;
                const chosenVariant = isActive
                    ? (item.activeVariant ?? activeVariant)
                    : (item.inactiveVariant ?? inactiveVariant);
                return (
                    <Button
                        key={item.value}
                        type="button"
                        size={item.size || size}
                        variant={item.variant || chosenVariant}
                        iconName={iconName}
                        disabled={item.disabled}
                        onClick={() => onChange?.(item.value, item)}
                        className={cn(
                            'tab-btn',
                            buttonClassName,
                            item.className,
                            isActive && 'tab-active'
                        )}
                        aria-current={isActive ? 'page' : undefined}
                        role="tab"
                        aria-selected={isActive}
                    >
                        {item.renderLabel ? item.renderLabel(item, isActive) : item.label}
                    </Button>
                );
            })}
        </div>
    );
}
