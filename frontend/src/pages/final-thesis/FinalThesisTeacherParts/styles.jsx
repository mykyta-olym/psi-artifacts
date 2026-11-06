// src/pages/final-thesis/FinalThesisTeacherParts/styles.jsx
import React from 'react';

export default function PageStyles() {
    return (
        <style>{`
    .thesis-zfix{position:relative;z-index:0}
    .thesis-zfix .z-stack{position:relative;z-index:60}
    .thesis-zfix .z-dropdown{position:relative;z-index:70}
    .thesis-zfix .of-visible{overflow:visible!important}
    .thesis-zfix [data-radix-popper-content-wrapper],
    .thesis-zfix [data-radix-select-content],
    .thesis-zfix [role="listbox"]{z-index:9999!important}
    .hover-lift{transition:transform .18s ease,box-shadow .18s ease}
    .hover-lift:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(0,0,0,.35)}
    .toolbar{display:flex;gap:.5rem;flex-wrap:wrap}
    .kbd{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-size:.72rem}
    .modal-area{border-radius:.75rem;border:1px solid var(--color-border);background:var(--color-card);overscroll-behavior:contain}
    .textarea-modern{width:100%;min-height:140px;padding:.75rem .9rem .75rem .9rem;resize:none;outline:none;border-radius:.75rem;border:1px solid var(--color-border);background:var(--color-background);line-height:1.45}
    .textarea-modern::placeholder{color:color-mix(in srgb,var(--color-muted-foreground) 86%, transparent)}
    .textarea-modern:focus{border-color:color-mix(in srgb,var(--color-primary) 60%, #ffffff 0%);box-shadow:0 0 0 4px color-mix(in srgb,var(--color-primary) 20%, transparent)}
    .textarea-invalid{border-color:color-mix(in srgb,var(--color-error) 62%, #ffffff 0%);box-shadow:0 0 0 4px color-mix(in srgb,var(--color-error) 18%, transparent)}
    .field-label{display:block;font-size:.75rem;color:var(--color-muted-foreground);margin-bottom:.35rem}
    .helper{font-size:.72rem;color:var(--color-muted-foreground)}
    .helper-error{color:var(--color-error)}
    .btn-group{display:flex;gap:.5rem;flex-wrap:wrap}
    .toast{position:fixed;right:1rem;bottom:1rem;z-index:99999;display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem;border-radius:.75rem;border:1px solid var(--color-border);background:var(--color-card);box-shadow:0 10px 30px rgba(0,0,0,.35)}
    @media (max-width:640px){ .modal-area{max-height:calc(100vh - 2rem)} }
    .scroll-y{max-height:70vh;overflow-y:auto;padding-right:.25rem}
    .scroll-y, .thesis-zfix, .thesis-zfix *{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--color-foreground) 28%, transparent) transparent}
    .thesis-zfix ::-webkit-scrollbar{width:10px;height:10px}
    .thesis-zfix ::-webkit-scrollbar-track{background:transparent}
    .thesis-zfix ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--color-foreground) 28%, transparent);border-radius:8px;border:2px solid transparent;background-clip:content-box}
  `}</style>
    );
}