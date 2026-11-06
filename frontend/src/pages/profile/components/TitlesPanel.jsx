import React from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';

const SUGGEST_PREFIX = ['Ing.', 'Mgr.', 'Bc.', 'RNDr.', 'PaedDr.', 'Mgr. art.', 'doc.', 'prof.'];
const SUGGEST_SUFFIX = ['PhD.', 'CSc.', 'Dr. h. c.', 'ThDr.'];

const Chip = ({ text, onRemove, onUp, onDown, disabled }) => (
    <div className="inline-flex items-center bg-muted rounded-md px-2 py-1 text-sm mr-2 mb-2">
        <span className="mr-2">{text}</span>
        <div className="flex items-center gap-1">
            <button type="button" onClick={onUp} disabled={disabled} className="opacity-70 hover:opacity-100">
                <Icon name="ChevronUp" size={14} />
            </button>
            <button type="button" onClick={onDown} disabled={disabled} className="opacity-70 hover:opacity-100">
                <Icon name="ChevronDown" size={14} />
            </button>
            <button type="button" onClick={onRemove} disabled={disabled} className="opacity-70 hover:opacity-100">
                <Icon name="X" size={14} />
            </button>
        </div>
    </div>
);

const TitlesPanel = ({
                         editable = false,
                         prefixes = [],
                         suffixes = [],
                         baseName = '',
                         onChange
                     }) => {
    const commit = (nextPrefixes, nextSuffixes) => onChange?.({ prefixes: nextPrefixes, suffixes: nextSuffixes });

    const addPrefix = (val) => {
        const v = String(val || '').trim();
        if (!v || prefixes.includes(v)) return;
        commit([...prefixes, v], suffixes);
    };
    const addSuffix = (val) => {
        const v = String(val || '').trim();
        if (!v || suffixes.includes(v)) return;
        commit(prefixes, [...suffixes, v]);
    };

    const removePrefix = (idx) => commit(prefixes.filter((_, i) => i !== idx), suffixes);
    const removeSuffix = (idx) => commit(prefixes, suffixes.filter((_, i) => i !== idx));

    const move = (arr, from, to) => {
        const x = arr.slice();
        const item = x.splice(from, 1)[0];
        x.splice(to, 0, item);
        return x;
    };
    const upPrefix = (idx) => { if (idx <= 0) return; commit(move(prefixes, idx, idx - 1), suffixes); };
    const downPrefix = (idx) => { if (idx >= prefixes.length - 1) return; commit(move(prefixes, idx, idx + 1), suffixes); };
    const upSuffix = (idx) => { if (idx <= 0) return; commit(prefixes, move(suffixes, idx, idx - 1)); };
    const downSuffix = (idx) => { if (idx >= suffixes.length - 1) return; commit(prefixes, move(suffixes, idx, idx + 1)); };

    let preview = baseName || '—';
    if (prefixes.length) preview = `${prefixes.join(' ')} ${preview}`.trim();
    if (suffixes.length) preview = `${preview}, ${suffixes.join(', ')}`.trim();

    let _prefInput, _sufInput;

    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Academic / Professional Titles</h3>
            </div>

            <div className="mb-4 p-3 bg-muted/40 border border-border rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Preview</div>
                <div className="text-base font-medium">{preview}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Prefixes (before name)</h4>
                        {!editable && <span className="text-xs text-muted-foreground">read-only</span>}
                    </div>

                    <div className="mb-2 min-h-10">
                        {prefixes.length ? (
                            prefixes.map((p, idx) => (
                                <Chip
                                    key={`${p}-${idx}`}
                                    text={p}
                                    disabled={!editable}
                                    onRemove={() => removePrefix(idx)}
                                    onUp={() => upPrefix(idx)}
                                    onDown={() => downPrefix(idx)}
                                />
                            ))
                        ) : (
                            <div className="text-sm text-muted-foreground leading-10">No prefixes</div>
                        )}
                    </div>

                    {editable && (
                        <>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 mb-2">
                                <Input
                                    placeholder="e.g. Ing."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            addPrefix(e.currentTarget.value);
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                    inputRef={(r) => (_prefInput = r)}
                                />
                                <Button size="sm" onClick={() => { addPrefix(_prefInput?.value); if (_prefInput) _prefInput.value = ''; }}>
                                    Add
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {SUGGEST_PREFIX.map((s) => (
                                    <button
                                        type="button"
                                        key={s}
                                        onClick={() => addPrefix(s)}
                                        className="text-xs px-2 py-1 rounded-full border border-border hover:bg-muted"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Suffixes (after name)</h4>
                        {!editable && <span className="text-xs text-muted-foreground">read-only</span>}
                    </div>

                    <div className="mb-2 min-h-10">
                        {suffixes.length ? (
                            suffixes.map((s, idx) => (
                                <Chip
                                    key={`${s}-${idx}`}
                                    text={s}
                                    disabled={!editable}
                                    onRemove={() => removeSuffix(idx)}
                                    onUp={() => upSuffix(idx)}
                                    onDown={() => downSuffix(idx)}
                                />
                            ))
                        ) : (
                            <div className="text-sm text-muted-foreground leading-10">No suffixes</div>
                        )}
                    </div>

                    {editable && (
                        <>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 mb-2">
                                <Input
                                    placeholder="e.g. PhD."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            addSuffix(e.currentTarget.value);
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                    inputRef={(r) => (_sufInput = r)}
                                />
                                <Button size="sm" onClick={() => { addSuffix(_sufInput?.value); if (_sufInput) _sufInput.value = ''; }}>
                                    Add
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {SUGGEST_SUFFIX.map((s) => (
                                    <button
                                        type="button"
                                        key={s}
                                        onClick={() => addSuffix(s)}
                                        className="text-xs px-2 py-1 rounded-full border border-border hover:bg-muted"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TitlesPanel;