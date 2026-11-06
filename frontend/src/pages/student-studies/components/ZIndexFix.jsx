// src/pages/student-studies/components/ZIndexFix.jsx
import React from 'react';

export default function ZIndexFix() {
    return (
        <style>{`
      .student-studies-zfix { position: relative; z-index: 0; }
      .student-studies-zfix .z-stack { position: relative; z-index: 60; }
      .student-studies-zfix .z-dropdown { position: relative; z-index: 70; }
      .student-studies-zfix .of-visible { overflow: visible !important; }
      .student-studies-zfix [data-radix-popper-content-wrapper],
      .student-studies-zfix [data-radix-select-content],
      .student-studies-zfix [role="listbox"],
      .student-studies-zfix .Select__menu,
      .student-studies-zfix .select-menu,
      .student-studies-zfix .dropdown-menu,
      .student-studies-zfix .popover,
      .student-studies-zfix .menu { z-index: 9999 !important; }
    `}</style>
    );
}