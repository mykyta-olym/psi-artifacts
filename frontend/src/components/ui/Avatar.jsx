// src/components/ui/Avatar.jsx
import React, { useMemo } from 'react';
import { getInitials, nameFromEmail } from '../../utils/displayName';

function hash(s = '') {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function bgFromName(name = '') {
    const h = hash(name) % 360;
    return `hsl(${h} 70% 45%)`;
}

const Avatar = ({
                    name = '',
                    email = '',
                    src = null,
                    size = 64,
                    rounded = true,
                    privacy = false,
                    className = '',
                    alt = 'Avatar',
                }) => {
    const initials = useMemo(() => {
        // Use getInitials which handles emails properly
        return getInitials({ name, email }, '∎');
    }, [name, email]);
    
    // For background color, use the readable name (extract from email if needed)
    const displayName = useMemo(() => {
        if (name && !name.includes('@')) return name;
        return nameFromEmail(email || name) || name || 'user';
    }, [name, email]);
    
    const bg = useMemo(() => bgFromName(displayName), [displayName]);

    const commonCls = `grid place-items-center border border-border overflow-hidden ${
        rounded ? 'rounded-full' : 'rounded-md'
    } ${className}`;

    if (src) {
        return (
            <div className={commonCls} style={{ width: size, height: size }}>
                <img
                    src={src}
                    alt={alt}
                    className={`w-full h-full object-cover ${privacy ? 'blur-[2px]' : ''}`}
                    draggable={false}
                />
            </div>
        );
    }

    return (
        <div
            className={commonCls}
            style={{ width: size, height: size, background: bg, color: 'white', fontWeight: 700 }}
            aria-label={alt}
            title={name}
        >
            <span className={`text-xl select-none ${privacy ? 'blur-[2px]' : ''}`}>{initials}</span>
        </div>
    );
};

export default Avatar;