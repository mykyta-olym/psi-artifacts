// src/pages/final-thesis/components/PageStyles.jsx
import React from 'react';

export default function PageStyles() {
    return (
        <style>{`
      .thesis-zfix { position: relative; z-index: 0; }
      .thesis-zfix .z-stack { position: relative; z-index: 60; }
      .thesis-zfix .z-dropdown { position: relative; z-index: 70; }
      .thesis-zfix .of-visible { overflow: visible !important; }
      .thesis-zfix [data-radix-popper-content-wrapper],
      .thesis-zfix [data-radix-select-content],
      .thesis-zfix [role="listbox"]{ z-index:9999 !important; }
      .hover-lift { transition: transform .18s ease, box-shadow .18s ease }
      .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(0,0,0,.35) }
      .toolbar { display:flex; gap:.5rem; flex-wrap:wrap }
      .kbd{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-size:.72rem}
      .modal-area { border-radius: 0.75rem; border: 1px solid var(--color-border); background: var(--color-card); }
      .textarea-modern { width: 100%; min-height: 240px; padding: .75rem .9rem; resize: vertical; outline: none; border-radius: .75rem; border: 1px solid var(--color-border); background: var(--color-background); }
      .textarea-modern:focus { border-color: color-mix(in srgb, var(--color-primary) 60%, #ffffff 0%); box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 20%, transparent); }
      .btn-group { display:flex; gap:.5rem; flex-wrap:wrap }
    `}</style>
    );
}