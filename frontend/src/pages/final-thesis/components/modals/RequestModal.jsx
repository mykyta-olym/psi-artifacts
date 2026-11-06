// src/pages/final-thesis/components/modals/RequestModal.jsx
import React, { useEffect, useState } from 'react';
import Button from '../../../../components/ui/Button';
import Select from '../../../../components/ui/Select';
import Input from '../../../../components/ui/Input';
import Textarea from '../../../../components/ui/Textarea';
import ModalBase from './ModalBase';
import { useAuth } from '../../../../contexts/AuthContext';

export default function RequestModal({ open, value, onClose, onSave, supervisors }) {
    const { user } = useAuth() || {};
    const [draft, setDraft] = useState(value || {});
    
    useEffect(() => {
        // Pre-fill with Master degree (Bachelor already completed)
        const initialData = value || {};
        setDraft({
            ...initialData,
            degree: 'msc',
            studyForm: initialData.studyForm || 'full-time',
            academicYear: initialData.academicYear || '2025/2026'
        });
    }, [value, open, user]);
    
    const set = (k, v) => setDraft((prev) => ({ ...prev, [k]: v }));
    const supOptions = (supervisors || []).map((s) => ({ value: s.id, label: s.name }));

    return (
        <ModalBase
            open={open}
            title="New Thesis Assignment Request"
            subtitle="Fill in the details. You can save as draft and finish later."
            onClose={onClose}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                    <Button variant="outline" onClick={() => onSave({ ...draft, status: 'draft' })} className="w-full sm:w-auto">Save Draft</Button>
                    <Button variant="default" onClick={() => onSave({ ...draft, status: 'submitted', submittedAt: new Date().toISOString() })} className="w-full sm:w-auto">Submit Request</Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <Input label="Program" value={draft.program || ''} onChange={(e) => set('program', e.target.value)} placeholder="e.g., Applied Informatics" className="sm:col-span-2" />
                    <Input label="Preferred language" value={draft.language || 'EN'} onChange={(e) => set('language', e.target.value)} />
                    <div className="relative z-dropdown">
                        <Select label="Preferred supervisor" options={supOptions} value={draft.supervisorId || supOptions[0]?.value} onChange={(v) => set('supervisorId', typeof v === 'string' ? v : v?.value)} />
                    </div>
                    <Input label="Proposed topic (optional)" value={draft.topic || ''} onChange={(e) => set('topic', e.target.value)} className="sm:col-span-2" />
                    <Input label="Keywords (comma separated)" value={draft.keywords || ''} onChange={(e) => set('keywords', e.target.value)} className="sm:col-span-2" />
                    <Textarea
                        label="Notes for supervisor (optional)"
                        minRows={5}
                        className="sm:col-span-2"
                        value={draft.note || ''}
                        onChange={(e) => set('note', e.target.value)}
                    />
                </div>
            </div>
        </ModalBase>
    );
}