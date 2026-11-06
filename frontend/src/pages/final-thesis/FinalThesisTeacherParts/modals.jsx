// src/pages/final-thesis/FinalThesisTeacherParts/modals.jsx
import React, { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';
import { TextArea, ChipsPreview } from './ui';
import { fetchPrograms } from '../../../data/programsApi';
import { useAuth } from '../../../contexts/AuthContext';

export const ModalBase = ({ open, title, subtitle, onClose, children, footer }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-110 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-6 pb-24 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-background/80 backdrop-blur-sm" onClick={onClose} />
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block w-full max-w-[100vw] sm:max-w-3xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border">
                    <div className="flex items-center justify-between gap-3 px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-b border-border bg-card sticky top-0 z-20">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">{title}</h3>
                            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="flex-shrink-0">
                            <Icon name="X" size={22} />
                        </Button>
                    </div>
                    <div className="px-4 sm:px-5 md:px-8 py-5 md:py-8 max-h-[68vh] sm:max-h-[66vh] overflow-y-auto thin-scrollbar">
                        {children}
                    </div>
                    {footer && (
                        <div className="px-4 sm:px-6 md:px-8 py-3 md:py-5 border-t border-border bg-card sticky bottom-0">
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
                                {footer}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const TopicModal = ({ open, value, onClose, onSave }) => {
    const { user } = useAuth() || {};
    const [draft, setDraft] = useState(value || {});
    const [titleErr, setTitleErr] = useState('');
    const [descErr, setDescErr] = useState('');
    const [kw, setKw] = useState('');
    const [programs, setPrograms] = useState([]);
    const programOptions = programs.map(p=>({ value:p.value, label:p.label }));
    
    useEffect(() => {
        if (open) {
            fetchPrograms().then(data => setPrograms(Array.isArray(data) ? data : [])).catch(() => setPrograms([]));
        }
    }, [open]);

    useEffect(()=> {
        const initialData = value || {};
        setDraft({
            ...initialData,
            type: 'Master thesis'
        });
        setKw(Array.isArray(value?.keywords) ? value.keywords.join(', ') : String(value?.keywords || ''));
        setTitleErr('');
        setDescErr('');
    },[value, open]);

    const set = (k,v)=>setDraft(prev=>({...prev,[k]:v}));
    const titleValid = String(draft.title||'').trim().length >= 8;
    const descValid = String(draft.description||'').trim().length >= 30;

    useEffect(()=> setTitleErr(titleValid ? '' : 'Title should be at least 8 characters'), [draft.title, titleValid]);
    useEffect(()=> setDescErr(descValid ? '' : 'Description should be at least 30 characters'), [draft.description, descValid]);

    const parsedKeywords = String(kw||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,16);

    return (
        <ModalBase
            open={open}
            title={draft?.id ? 'Edit topic' : 'New topic'}
            subtitle="Define topic details students will see."
            onClose={onClose}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                    <Button variant="default" disabled={!(titleValid && descValid)} onClick={()=>onSave({...draft, keywords: parsedKeywords})} className="w-full sm:w-auto">Save Topic</Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <Input label="Title" className="sm:col-span-2" value={draft.title||''} onChange={(e)=>set('title', e.target.value)} />
                    {titleErr && <div className="sm:col-span-2 text-sm text-destructive">{titleErr}</div>}
                    <Input label="Capacity" type="number" min="1" step="1" value={String(draft.capacity ?? 1)} onChange={(e)=>set('capacity', Math.max(1, parseInt(e.target.value||'1',10)||1))} />
                    <Select
                        label="State"
                        value={draft.state || 'open'}
                        options={[{value:'open',label:'Open'},{value:'closed',label:'Closed'},{value:'archived',label:'Archived'}]}
                        onChange={(v)=>set('state', typeof v==='string'?v:v?.value)}
                    />
                    <Input label="Keywords" placeholder="Comma separated" className="sm:col-span-2" value={kw} onChange={(e)=>setKw(e.target.value)} />
                    {parsedKeywords.length > 0 && <div className="sm:col-span-2"><ChipsPreview items={parsedKeywords} /></div>}
                    <TextArea
                        id="topic-desc"
                        className="sm:col-span-2"
                        label="Short description"
                        value={draft.description||''}
                        onChange={(e)=>set('description', e.target.value)}
                        placeholder="Describe the goal, data, baseline, and expected outcomes…"
                        maxLength={1000}
                        rows={5}
                        invalid={!!descErr}
                        helper={descErr || 'Tip: include data source, baseline, expected deliverables.'}
                    />
                </div>
            </div>
        </ModalBase>
    );
};

export const ReviewRequestModal = ({ open, request, topics, onClose, onApprove, onReturn, onReject }) => {
    const [message, setMessage] = useState('');
    const [topicId, setTopicId] = useState('');
    useEffect(()=>{ setMessage(''); setTopicId(''); },[open, request]);
    const topicOptions = [{value:'', label:'— Create new from student topic —'}, ...topics.filter(t=>t.state==='open' && (!t.capacity || t.capacity>0)).map(t=>({ value:String(t.id), label:`${t.title} (${t.type})` }))];
    const canApprove = request && (request.status === 'submitted') && (String(topicId).length > 0 || String(request?.topic||'').trim().length > 0);

    return (
        <ModalBase
            open={open}
            title="Review assignment request"
            subtitle="Approve to create a supervised thesis, or return with comments, or reject."
            onClose={onClose}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                    <Button variant="outline" onClick={()=>onReject({ message })} className="w-full sm:w-auto">Reject</Button>
                    <Button variant="outline" onClick={()=>onReturn({ message })} disabled={!message.trim()} className="w-full sm:w-auto">Return</Button>
                    <Button variant="default" onClick={()=>onApprove({ topicId, message })} disabled={!canApprove} className="w-full sm:w-auto">Approve</Button>
                </>
            }
        >
            {!request ? null : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground">Student</div>
                            <div className="text-sm font-medium">{request.student?.name}</div>
                            <div className="text-xs text-muted-foreground">{request.student?.email}</div>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground">Meta</div>
                            <div className="text-sm">{request.academicYear} • {request.degree?.toUpperCase()} • {request.language}</div>
                            <div className="text-xs text-muted-foreground">{request.program}</div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                        <div className="text-xs text-muted-foreground mb-1">Student topic / note</div>
                        <div className="text-sm">
                            <div><strong>Topic:</strong> {request.topic || <em className="text-muted-foreground">—</em>}</div>
                            <div className="mt-1"><strong>Keywords:</strong> {request.keywords || <em className="text-muted-foreground">—</em>}</div>
                            {request.note ? <div className="mt-1"><strong>Note:</strong> {request.note}</div> : null}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <div className="z-dropdown">
                            <Select
                                label="Assign to existing topic"
                                options={topicOptions}
                                value={String(topicId)}
                                onChange={(v)=>setTopicId(typeof v==='string'?v:v?.value)}
                            />
                        </div>
                        <TextArea
                            id="review-msg"
                            label="Message to student"
                            value={message}
                            onChange={(e)=>setMessage(e.target.value)}
                            placeholder="Short note about your decision…"
                            maxLength={320}
                            rows={3}
                            helper="Optional, but required for Return"
                        />
                    </div>
                </div>
            )}
        </ModalBase>
    );
};

export const DefenseModal = ({ open, thesis, onClose, onSave }) => {
    const [date, setDate] = useState('');
    const [room, setRoom] = useState('');
    useEffect(()=>{ setDate(thesis?.defense?.date || ''); setRoom(thesis?.defense?.room || ''); },[open, thesis]);
    const canSave = Boolean(date && room);
    return (
        <ModalBase
            open={open}
            title="Schedule defense"
            subtitle="Set defense date and room."
            onClose={onClose}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                    <Button variant="default" onClick={()=>onSave({ date, room })} disabled={!canSave} className="w-full sm:w-auto">Save Defense</Button>
                </>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <Input label="Defense date/time" type="datetime-local" value={date} onChange={(e)=>setDate(e.target.value)} />
                <Input label="Room" value={room} onChange={(e)=>setRoom(e.target.value)} placeholder="FEI AULA" />
            </div>
        </ModalBase>
    );
};

export const OriginalityModal = ({ open, thesis, onClose, onSave }) => {
    const [pct, setPct] = useState('');
    const [url, setUrl] = useState('');
    const pctNum = Number(pct);
    const pctValid = !Number.isNaN(pctNum) && pctNum >= 0 && pctNum <= 100;
    useEffect(()=>{ setPct(String(thesis?.originality?.percentage ?? '')); setUrl(thesis?.originality?.protocolUrl || ''); },[open, thesis]);
    return (
        <ModalBase
            open={open}
            title="Originality check"
            subtitle="Record similarity percentage and (optional) protocol URL."
            onClose={onClose}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                    <Button variant="default" onClick={()=>onSave({ percentage: parseFloat(pct)||0, protocolUrl: url })} disabled={!pctValid} className="w-full sm:w-auto">Save Originality</Button>
                </>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <Input label="Similarity (%)" type="number" min="0" max="100" step="0.1" value={String(pct)} onChange={(e)=>setPct(e.target.value)} />
                <Input label="Protocol URL (optional)" type="url" value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://…" />
                {!pctValid && <div className="sm:col-span-2 text-sm text-destructive">Enter a value between 0 and 100.</div>}
            </div>
        </ModalBase>
    );
};

export const GradeModal = ({ open, thesis, onClose, onSave }) => {
    const [supervisorGrade, setSupervisorGrade] = useState('');
    const [opponentGrade, setOpponentGrade] = useState('');
    const [commissionGrade, setCommissionGrade] = useState('');
    useEffect(()=>{ setSupervisorGrade(''); setOpponentGrade(''); setCommissionGrade(''); },[open, thesis]);
    const any = [supervisorGrade, opponentGrade, commissionGrade].some(v=>String(v).trim().length>0);
    return (
        <ModalBase
            open={open}
            title="Enter grades"
            subtitle="Add one or multiple grading items. They’ll append to the table."
            onClose={onClose}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                    <Button variant="default" onClick={()=>onSave({ supervisorGrade, opponentGrade, commissionGrade })} disabled={!any} className="w-full sm:w-auto">Add Grades</Button>
                </>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <Input label="Supervisor (%)" type="number" min="0" max="100" step="0.1" value={supervisorGrade} onChange={(e)=>setSupervisorGrade(e.target.value)} />
                <Input label="Opponent (%)" type="number" min="0" max="100" step="0.1" value={opponentGrade} onChange={(e)=>setOpponentGrade(e.target.value)} />
                <Input label="Commission (%)" type="number" min="0" max="100" step="0.1" value={commissionGrade} onChange={(e)=>setCommissionGrade(e.target.value)} />
            </div>
        </ModalBase>
    );
};