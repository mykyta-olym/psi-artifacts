// src/pages/profile/components/VariableSymbolsPanel.jsx
import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';

const Tag = ({ value, onRemove, canEdit }) => (
    <span className="inline-flex items-center text-xs px-2 py-1 rounded-full border border-border bg-muted mr-2 mb-2">
    {value}
        {canEdit && (
            <button className="ml-1 opacity-70 hover:opacity-100" onClick={onRemove} aria-label="Remove">
                <Icon name="X" size={12} />
            </button>
        )}
  </span>
);

const Section = ({ title, items, onAdd, onRemove, canEdit }) => {
    const [val, setVal] = useState('');
    const add = () => {
        const clean = String(val || '').trim();
        if (!clean) return;
        onAdd(clean);
        setVal('');
    };
    return (
        <div>
            <div className="text-sm font-medium mb-2">{title}</div>
            <div className="mb-2">
                {items.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No symbols.</div>
                ) : (
                    items.map((v, i) => <Tag key={`${v}-${i}`} value={v} onRemove={() => onRemove(i)} canEdit={canEdit} />)
                )}
            </div>
            {canEdit && (
                <div className="flex gap-2">
                    <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. 2022003310" />
                    <Button onClick={add}>Add</Button>
                </div>
            )}
        </div>
    );
};

const VariableSymbolsPanel = ({
                                  isEditing,
                                  symbols = { accommodation: [], study: [], other: [] },
                                  onChange,
                                  canEdit,
                              }) => {
    const add = (k, v) => onChange({ ...symbols, [k]: [...(symbols[k] || []), v] });
    const remove = (k, idx) => onChange({ ...symbols, [k]: (symbols[k] || []).filter((_, i) => i !== idx) });

    return (
        <section className="bg-card rounded-lg border border-border p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="ListChecks" size={18} className="text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Variable Symbols</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded border border-border bg-muted/40">Payments</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Section
                    title="Accommodation"
                    items={symbols.accommodation || []}
                    onAdd={(v) => add('accommodation', v)}
                    onRemove={(i) => remove('accommodation', i)}
                    canEdit={!!canEdit && !!isEditing}
                />
                <Section
                    title="Tuition"
                    items={symbols.study || []}
                    onAdd={(v) => add('study', v)}
                    onRemove={(i) => remove('study', i)}
                    canEdit={!!canEdit && !!isEditing}
                />
                <Section
                    title="Other"
                    items={symbols.other || []}
                    onAdd={(v) => add('other', v)}
                    onRemove={(i) => remove('other', i)}
                    canEdit={!!canEdit && !!isEditing}
                />
            </div>
        </section>
    );
};

export default VariableSymbolsPanel;