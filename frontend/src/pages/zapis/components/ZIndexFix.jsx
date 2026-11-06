// src/pages/zapis/components/ZIndexFix.jsx
import React from 'react';

const ZIndexFix = () => (
    <style>{`
    .zapis-zfix { position: relative; z-index: 0; }
    .zapis-zfix .z-stack { position: relative; z-index: 60; }
    .zapis-zfix .z-dropdown { position: relative; z-index: 999; }
    .zapis-zfix .of-visible { overflow: visible !important; }
    .zapis-zfix [data-radix-popper-content-wrapper],
    .zapis-zfix [data-radix-select-content],
    .zapis-zfix [role="listbox"],
    .zapis-zfix .Select__menu,
    .zapis-zfix .select-menu,
    .zapis-zfix .dropdown-menu,
    .zapis-zfix .popover,
    .zapis-zfix .menu { z-index: 2147483000 !important; }
  `}</style>
);

export default ZIndexFix;