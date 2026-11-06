// src/pages/anketa/parts/styles.jsx
import React from 'react';

export default function AnketaStyles() {
    return (
        <style>{`
      .anketa-zfix{position:relative;z-index:0}
      .anketa-zfix .z-stack{position:relative;z-index:60}
      .anketa-zfix .z-dropdown{position:relative;z-index:70}
      .anketa-zfix .of-visible{overflow:visible!important}
      .anketa-zfix [data-radix-popper-content-wrapper],
      .anketa-zfix [data-radix-select-content],
      .anketa-zfix [role="listbox"]{z-index:9999!important}
      .tab-active{background:var(--color-primary);color:var(--color-primary-foreground);box-shadow:0 0 0 1px inset color-mix(in srgb,var(--color-primary) 35%, transparent)}
    `}</style>
    );
}