import React from 'react';
import * as LucideIcons from 'lucide-react';
import { HelpCircle } from 'lucide-react';

const EXTERNAL_ICON_MAP = {
    GraduationCap: 'https://api.iconify.design/mdi/owl.svg',
    GradeRibbon: 'https://api.iconify.design/ph/certificate-bold.svg'
};

function toPx(v){ return typeof v === 'number' ? `${v}px` : v; }

function Icon({
                  name,
                  size = 24,
                  color = 'currentColor',
                  className = '',
                  strokeWidth = 2,
                  iconName, // Extract to prevent passing to DOM
                  ...props
              }) {
    const external = EXTERNAL_ICON_MAP[name];

    if (external) {
        return (
            <span
                aria-label={name}
                className={className}
                style={{
                    display: 'inline-block',
                    width: toPx(size),
                    height: toPx(size),
                    backgroundColor: color,                 // під темний фон ідеально
                    WebkitMaskImage: `url(${external})`,
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskImage: `url(${external})`,
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    maskSize: 'contain',
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.35))' // легка глибина
                }}
                role="img"
            />
        );
    }

    const IconComponent = LucideIcons?.[name];
    if (!IconComponent) {
        return (
            <HelpCircle
                size={size}
                color="rgba(255,255,255,.6)"
                strokeWidth={strokeWidth}
                className={className}
                {...props}
            />
        );
    }

    return (
        <IconComponent
            size={size}
            color={color}
            strokeWidth={strokeWidth}
            className={`drop-shadow-[0_2px_8px_rgba(0,0,0,.35)] ${className || ''}`}
            {...props}
        />
    );
}

export default Icon;