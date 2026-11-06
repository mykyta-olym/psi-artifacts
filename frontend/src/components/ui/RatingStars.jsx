// src/components/ui/RatingStars.jsx
import React, { useState } from 'react';
import Icon from '../AppIcon';

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(+v) ? +v : 0));

const RatingStars = ({ value = 0, editable = false, onChange }) => {
    const [hover, setHover] = useState(undefined);
    const v = clamp(value, 0, 5);
    const curr = typeof hover === 'number' ? hover : v;

    return (
        <div className="inline-flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => {
                const score = i + 1;
                const filled = i < Math.round(curr);
                return (
                    <button
                        type="button"
                        key={i}
                        className="p-0.5"
                        onMouseEnter={() => editable && setHover(score)}
                        onMouseLeave={() => editable && setHover(undefined)}
                        onClick={() => editable && onChange?.(score)}
                        aria-label={`Rate ${score}`}
                        disabled={!editable}
                    >
                        <Icon
                            name={filled ? 'Star' : 'StarOff'}
                            size={16}
                            className={filled ? 'text-yellow-500' : 'text-muted-foreground'}
                        />
                    </button>
                );
            })}
        </div>
    );
};

export default RatingStars;