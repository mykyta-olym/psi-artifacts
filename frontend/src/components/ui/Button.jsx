// src/components/ui/Button.jsx
import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import Icon from '../AppIcon';

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 active:translate-y-[1px]',
    {
        variants: {
            variant: {
                default:
                    'bg-gradient-to-r from-sky-500/90 to-indigo-500/90 text-white shadow-[0_0_0_1px_rgba(255,255,255,.06)_inset,0_8px_20px_rgba(2,132,199,.35)] hover:from-sky-500 hover:to-indigo-500 hover:shadow-[0_0_0_1px_rgba(255,255,255,.14)_inset,0_16px_32px_rgba(2,132,199,.45)]',
                destructive:
                    'text-white bg-gradient-to-r from-rose-500/95 to-red-600/95 shadow-[0_0_0_1px_rgba(255,255,255,.06)_inset,0_8px_20px_rgba(225,29,72,.35)] hover:from-rose-500 hover:to-red-600',
                outline:
                    'border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,.08)]',
                secondary:
                    'border border-white/10 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_4px_16px_rgba(0,0,0,.25)]',
                ghost: 'bg-transparent text-white/90 hover:bg-white/10 shadow-none',
                link: 'text-sky-300 hover:text-sky-200 underline-offset-4 hover:underline',
                success:
                    'text-white bg-gradient-to-r from-emerald-500/95 to-emerald-600/95 shadow-[0_0_0_1px_rgba(255,255,255,.06)_inset,0_8px_20px_rgba(16,185,129,.35)] hover:from-emerald-500 hover:to-emerald-600',
                warning:
                    'text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_0_1px_rgba(255,255,255,.06)_inset,0_8px_20px_rgba(245,158,11,.35)] hover:from-amber-400 hover:to-amber-500',
                danger:
                    'text-white bg-gradient-to-r from-red-500/95 to-red-600/95 shadow-[0_0_0_1px_rgba(255,255,255,.06)_inset,0_8px_20px_rgba(220,38,38,.35)] hover:from-red-500 hover:to-red-600',
            },
            size: {
                default: 'h-11 px-4',
                sm: 'h-9 rounded-lg px-3',
                lg: 'h-12 rounded-xl px-6 text-base',
                icon: 'h-11 w-11',
                xs: 'h-8 rounded-lg px-2.5 text-xs',
                xl: 'h-14 rounded-2xl px-8 text-base',
            },
        },
        defaultVariants: { variant: 'default', size: 'default' },
    }
);

const Button = React.forwardRef(function Button(
    {
        className,
        variant,
        size,
        asChild = false,
        children,
        loading = false,
        iconName = null,
        iconPosition = 'left',
        iconSize = null,
        fullWidth = false,
        disabled = false,
        ...props
    },
    ref
) {
    const iconSizeMap = { xs: 12, sm: 14, default: 16, lg: 18, xl: 20, icon: 16 };
    const calculatedIconSize = iconSize || iconSizeMap?.[size] || 16;

    const LoadingSpinner = () => (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );

    const renderIcon = () =>
        iconName ? (
            <Icon
                name={iconName}
                size={calculatedIconSize}
                className={cn(children && iconPosition === 'left' && 'mr-2', children && iconPosition === 'right' && 'ml-2')}
            />
        ) : null;

    const content = (
        <>
            {loading && <LoadingSpinner />}
            {iconName && iconPosition === 'left' && renderIcon()}
            {children}
            {iconName && iconPosition === 'right' && renderIcon()}
        </>
    );

    if (asChild) {
        const only = React.Children.only(children);
        if (!React.isValidElement(only)) {
            // фолбек, якщо передали неелемент
            return (
                <button
                    className={cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full')}
                    ref={ref}
                    disabled={disabled || loading}
                    aria-busy={loading ? 'true' : 'false'}
                    {...props}
                >
                    {content}
                </button>
            );
        }

        // повертаємо САМ клон як елемент — без Slot і без зайвих обгорток
        return React.cloneElement(only, {
            className: cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full', only.props?.className),
            disabled: disabled || loading || only.props?.disabled,
            ref,
            children: content,
            ...props,
        });
    }

    return (
        <button
            className={cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full')}
            ref={ref}
            disabled={disabled || loading}
            aria-busy={loading ? 'true' : 'false'}
            {...props}
        >
            {content}
        </button>
    );
});

Button.displayName = 'Button';
export default Button;