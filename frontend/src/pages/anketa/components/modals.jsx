// src/pages/anketa/parts/modals.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import Icon from '../../../components/AppIcon';
import { useToasts } from '../../../components/ui/Toasts';
import { Pill } from './ui';
import { clamp, pct, todayISO } from '../utils/utils';

export const SurveyModal = ({ isOpen, onClose, survey, onSaveDraft, onSubmit, initialDraft, readOnly=false }) => {
    const { notify } = useToasts();
    const toastLockRef = useRef({});
    const guardedNotify = useCallback(
        (key, type, message, opts = {}) => {
            if (key) {
                const now = Date.now();
                const lock = opts.lockMs ?? 2800;
                const prev = toastLockRef.current[key] ?? 0;
                if (now - prev < lock) return;
                toastLockRef.current[key] = now;
            }
            notify(type, message, opts);
        },
        [notify]
    );
    const [answers, setAnswers] = useState(initialDraft || {});
    const [submitting, setSubmitting] = useState(false);
    const reqCount = useMemo(() => survey?.questions.filter(q => q.required !== false).length || 0, [survey]);
    const answeredRequired = useMemo(() => survey?.questions.filter(q => q.required !== false && !!answers[q.id]).length || 0, [survey, answers]);
    const progress = pct(answeredRequired, reqCount);

    useEffect(()=>{ setAnswers(initialDraft || {}); }, [initialDraft, isOpen]);
    if (!isOpen || !survey) return null;

    const set = (id, v) => setAnswers(prev => ({ ...prev, [id]: v }));
    const handleSubmit = async () => {
        const missing = survey.questions.filter(q => q.required !== false && !answers[q.id]);
        if (missing.length) { guardedNotify('survey-validation', 'warning', `Please answer required questions (${missing.length}).`, { title: 'Validation', lockMs: 3200 }); return; }
        setSubmitting(true);
        try {
            await onSubmit(answers);
            setTimeout(() => {
                notify('success', 'Your response has been recorded.', { title: 'Submitted' });
            }, 300);
        } finally { setSubmitting(false); }
    };

    const Likert = ({ q }) => (
        <div className="flex items-center gap-2 flex-wrap">
            {[1,2,3,4,5].map(n => (
                <button
                    key={String(n)}
                    onClick={() => !readOnly && set(q.id, String(n))}
                    className={`px-3 py-1 rounded-md border ${answers[q.id] === String(n) ? 'bg-primary/20 border-primary/40' : 'bg-muted hover:bg-muted/70'} ${readOnly?'pointer-events-none opacity-70':''}`}
                    type="button"
                >{n}</button>
            ))}
            <span className="text-xs text-muted-foreground ml-1">1 — low, 5 — high</span>
        </div>
    );

    const Stars = ({ q, max=5 }) => (
        <div className="flex items-center gap-1">
            {Array.from({length:max}, (_,i)=>i+1).map(n=>(
                <button
                    key={String(n)}
                    type="button"
                    onClick={() => !readOnly && set(q.id, String(n))}
                    aria-label={`${n} star`}
                    className={`p-1 ${readOnly?'pointer-events-none opacity-70':''}`}
                >
                    <Icon name={Number(answers[q.id]||0) >= n ? 'Star' : 'StarOff'} size={18} className="text-primary" />
                </button>
            ))}
        </div>
    );

    const YesNo = ({ q }) => (
        <div className="flex items-center gap-2">
            <Button size="sm" variant={answers[q.id]==='yes'?'default':'outline'} onClick={()=>!readOnly && set(q.id,'yes')} disabled={readOnly}>Yes</Button>
            <Button size="sm" variant={answers[q.id]==='no'?'default':'outline'} onClick={()=>!readOnly && set(q.id,'no')} disabled={readOnly}>No</Button>
        </div>
    );

    const MultiChoice = ({ q }) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(q.options || []).map(opt => {
                const cur = new Set((answers[q.id] || []));
                const active = cur.has(opt);
                return (
                    <button
                        key={String(opt)}
                        type="button"
                        onClick={() => { if (readOnly) return; active ? cur.delete(opt) : cur.add(opt); set(q.id, Array.from(cur.values())); }}
                        className={`px-3 py-2 rounded-md border text-left ${active?'bg-primary/15 border-primary/40':'bg-muted hover:bg-muted/70'} ${readOnly?'pointer-events-none opacity-70':''}`}
                    >
                        {opt}
                    </button>
                );
            })}
        </div>
    );

    const Control = (q) => {
        if (q.type==='likert5') return <Likert q={q} />;
        if (q.type==='stars5') return <Stars q={q} />;
        if (q.type==='yesno')  return <YesNo q={q} />;
        if (q.type==='multichoice') return <MultiChoice q={q} />;
        return (
            <Textarea
                minRows={4}
                value={answers[q.id] || ''}
                onChange={(e)=>set(q.id, e.target.value)}
                placeholder="Type your answer…"
                readOnly={readOnly}
                textareaClassName="min-h-[120px]"
            />
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[1400] flex items-start sm:items-center justify-center p-3">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-5xl max-h-[90vh] glass-pop rounded-xl shadow-modal p-0 border border-border bg-card flex flex-col">
                <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-foreground">{survey.title}</h3>
                        <div className="text-xs text-muted-foreground mt-0.5">{survey.isAnonymous ? 'Anonymous' : 'Identified'} • Open {survey.openAt} – {survey.closeAt}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            className="p-2 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40" 
                            onClick={() => {
                                const link = `${window.location.origin}/anketa?survey=${survey.id}`;
                                navigator.clipboard.writeText(link);
                                guardedNotify('survey-share', 'success', 'Survey link copied to clipboard!', { title: 'Share', lockMs: 2000 });
                            }}
                            title="Share survey"
                        >
                            <Icon name="Share2" size={16} />
                        </button>
                        <button className="p-2 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40" onClick={onClose}>
                            <Icon name="X" size={16} />
                        </button>
                    </div>
                </div>
                <div className="px-4 sm:px-5 pt-3">
                    <div className="rounded-lg border border-border p-3 mb-3">
                        <div className="text-xs text-muted-foreground mb-1">Progress</div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${clamp(progress,0,100)}%` }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{answeredRequired}/{reqCount} required answered</div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto thin-scrollbar px-4 sm:px-5">
                    <ol className="space-y-4">
                        {survey.questions.map((q, idx)=>(
                            <li key={String(q.id)} className="rounded-lg border border-border p-3 bg-card">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-medium">{idx+1}. {q.text} {q.required === false ? <span className="text-xs text-muted-foreground">(optional)</span> : null}</div>
                                    </div>
                                    <Pill intent="gray">{q.type}</Pill>
                                </div>
                                <div className="mt-3">{Control(q)}</div>
                            </li>
                        ))}
                    </ol>
                </div>
                <div className="px-4 sm:px-5 py-3 border-t border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-xs text-muted-foreground">{survey.isAnonymous ? <>Your identity is <span className="text-foreground font-medium">not</span> stored.</> : <>Submission will include your name for service improvements.</>}</div>
                        {!readOnly ? (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => { onSaveDraft(answers); setTimeout(() => { guardedNotify('survey-draft', 'success','Draft saved',{title:'Save draft', lockMs: 2200}); }, 300); }} iconName="Save">Save draft</Button>
                                <Button onClick={handleSubmit} disabled={submitting} iconName="Send">Submit</Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={onClose} iconName="X">Close</Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const SurveyBuilderModal = ({ open, onClose, value, onSave }) => {
    const { notify } = useToasts();
    const toastLockRef = useRef({});
    const guardedNotify = useCallback((key, type, message, opts = {}) => {
        if (key) {
            const now = Date.now();
            const lock = opts.lockMs ?? 2600;
            const prev = toastLockRef.current[key] ?? 0;
            if (now - prev < lock) return;
            toastLockRef.current[key] = now;
        }
        notify(type, message, opts);
    }, [notify]);
    const [draft, setDraft] = useState(value || {});
    const [qText, setQText] = useState('');
    const [qType, setQType] = useState('likert5');
    const [qReq, setQReq] = useState(true);
    const [qOpts, setQOpts] = useState('');
    useEffect(()=>{ setDraft(value||{}); setQText(''); setQType('likert5'); setQReq(true); setQOpts(''); },[open, value]);
    if (!open) return null;

    const set = (k,v)=> setDraft(prev=>({ ...prev, [k]: v }));
    const addQuestion = () => {
        const id = 'q'+(Math.random().toString(36).slice(2,8));
        const q = { id, type:qType, text:qText.trim(), required:qReq };
        if (qType==='multichoice') q.options = String(qOpts||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,16);
        if (!q.text) { guardedNotify('builder-validation','warning','Enter question text',{title:'Validation', lockMs: 2600}); return; }
        set('questions', [...(draft.questions||[]), q]);
        setQText(''); setQOpts(''); setQType('likert5'); setQReq(true);
        notify('success','Question added',{title:'Builder'});
    };
    const moveQ = (i,dir)=> {
        const arr = [...(draft.questions||[])];
        const j = i+dir;
        if (j<0 || j>=arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        set('questions', arr);
    };
    const delQ = (i)=> {
        const arr = [...(draft.questions||[])];
        arr.splice(i,1);
        set('questions', arr);
        notify('success','Question removed',{title:'Builder'});
    };

    return createPortal(
        <div className="fixed inset-0 z-[1200] flex items-start sm:items-center justify-center p-0 sm:p-3">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-6xl max-h-[90vh] rounded-none sm:rounded-xl shadow-modal border border-border bg-card p-0 flex flex-col">
                <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold">{draft?.id ? 'Edit survey' : 'Create survey'}</h3>
                        <div className="text-xs text-muted-foreground mt-0.5">Define metadata, window, anonymity and questions.</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" iconName="X" onClick={onClose}>Close</Button>
                        <Button iconName="Save" onClick={()=>{ onSave(draft); setTimeout(() => { notify('success','Survey saved',{title:'Builder'}); }, 300); }} disabled={!(draft.title && (draft.questions||[]).length>0)}>Save</Button>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden">
                    <div className="h-full grid grid-cols-1 md:grid-cols-5 gap-0">
                        <div className="md:col-span-2 border-r border-border h-full overflow-y-auto thin-scrollbar p-4 sm:p-5">
                            <div className="grid grid-cols-1 gap-3">
                                <Input label="Title" value={draft.title||''} onChange={e=>set('title', e.target.value)} />
                                <Select
                                    label="Category"
                                    value={draft.category || 'course'}
                                    options={[{value:'course',label:'Course'},{value:'teacher',label:'Teacher'},{value:'service',label:'Service'}]}
                                    onChange={v=>set('category', typeof v==='string'?v:v?.value)}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input label="Open at" type="date" value={draft.openAt || todayISO()} onChange={e=>set('openAt', e.target.value)} />
                                    <Input label="Close at" type="date" value={draft.closeAt || todayISO()} onChange={e=>set('closeAt', e.target.value)} />
                                </div>
                                <Select
                                    label="Anonymity"
                                    value={draft.isAnonymous ? 'yes':'no'}
                                    options={[{value:'yes',label:'Anonymous'},{value:'no',label:'Identified'}]}
                                    onChange={v=>set('isAnonymous', (typeof v==='string'?v:v?.value)==='yes')}
                                />
                                <Select
                                    label="Published"
                                    value={String(draft.published ?? true)}
                                    options={[{value:'true',label:'Published'},{value:'false',label:'Unpublished'}]}
                                    onChange={v=>set('published', (typeof v==='string'?v:v?.value) === 'true')}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-3 h-full overflow-y-auto thin-scrollbar p-4 sm:p-5">
                            <div className="text-sm font-medium mb-2">Questions</div>
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-2">
                                <Input className="lg:col-span-2" label="Question text" value={qText} onChange={e=>setQText(e.target.value)} />
                                <Select
                                    label="Type"
                                    value={qType}
                                    options={[{value:'likert5',label:'Likert 1–5'},{value:'stars5',label:'Stars 1–5'},{value:'yesno',label:'Yes/No'},{value:'multichoice',label:'Multiple choice'},{value:'text',label:'Text'}]}
                                    onChange={v=>setQType(typeof v==='string'?v:v?.value)}
                                />
                                {qType==='multichoice' ? <Input label="Options (comma separated)" value={qOpts} onChange={e=>setQOpts(e.target.value)} /> : <div className="hidden lg:block" />}
                                <Select
                                    label="Required"
                                    value={qReq ? 'yes':'no'}
                                    options={[{value:'yes',label:'Required'},{value:'no',label:'Optional'}]}
                                    onChange={v=>setQReq((typeof v==='string'?v:v?.value)==='yes')}
                                />
                            </div>
                            <div className="mt-2">
                                <Button variant="outline" iconName="PlusCircle" onClick={addQuestion}>Add question</Button>
                            </div>
                            <div className="mt-4 space-y-2">
                                {(draft.questions||[]).map((q,i)=>(
                                    <div key={q.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-medium">{i+1}. {q.text}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                                <Pill intent="gray">{q.type}</Pill>
                                                <span>{q.required!==false?'Required':'Optional'}</span>
                                                {Array.isArray(q.options) && q.options.length>0 ? <span>Options: {q.options.join(', ')}</span> : null}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                            <Button size="xs" variant="outline" iconName="ArrowUp" onClick={()=>moveQ(i,-1)} disabled={i===0}>Up</Button>
                                            <Button size="xs" variant="outline" iconName="ArrowDown" onClick={()=>moveQ(i,1)} disabled={i===(draft.questions.length-1)}>Down</Button>
                                            <Button size="xs" variant="ghost" iconName="Trash2" onClick={()=>delQ(i)}>Delete</Button>
                                        </div>
                                    </div>
                                ))}
                                {(draft.questions||[]).length===0 && (
                                    <div className="text-sm text-muted-foreground">No questions yet.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="px-4 sm:px-5 py-3 border-t border-border flex items-center justify-end gap-2">
                    <Button variant="outline" iconName="X" onClick={onClose}>Close</Button>
                    <Button iconName="Save" onClick={()=>{ onSave(draft); setTimeout(() => { notify('success','Survey saved',{title:'Builder'}); }, 300); }} disabled={!(draft.title && (draft.questions||[]).length>0)}>Save</Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const ResponseDetailModal = ({ open, onClose, survey, submission }) => {
    if (!open || !survey || !submission) return null;
    return createPortal(
        <div className="fixed inset-0 z-[1350] flex items-start sm:items-center justify-center p-3">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w/full max-w-4xl max-h-[85vh] rounded-xl shadow-modal p-4 sm:p-5 border border-border bg-card flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold">Submission</h3>
                        <div className="text-xs text-muted-foreground mt-0.5">Submitted {new Date(submission.submittedAt).toLocaleString()} {submission.name?`• ${submission.name}`:''}</div>
                    </div>
                    <button className="p-2 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40" onClick={onClose}>
                        <Icon name="X" size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto thin-scrollbar pr-1 space-y-2">
                    {survey.questions.map((q,i)=>(
                        <div key={q.id} className="rounded-lg border border-border p-3">
                            <div className="text-sm font-medium">{i+1}. {q.text}</div>
                            <div className="text-sm mt-1">
                                {Array.isArray(submission.answers[q.id]) ? submission.answers[q.id].join(', ') : (submission.answers[q.id] ?? <em className="text-muted-foreground">—</em>)}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex justify-end">
                    <Button variant="outline" iconName="X" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>,
        document.body
    );
};