// src/pages/final-thesis/components/modals/EditTextModal.jsx
import React, { useEffect, useState } from 'react';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import ModalBase from './ModalBase';

export default function EditTextModal({ open, title, value, onSave, onClose, placeholder, maxLength = 4000 }) {
    const [v, setV] = useState(value || '');
    const left = Math.max(0, maxLength - (v?.length || 0));
    useEffect(() => setV(value || ''), [value, open]);
    return (
        <ModalBase
            open={open}
            title={title}
            subtitle="Write comfortably. Your draft is not auto-saved until you press Save."
            onClose={onClose}
            footer={
                <>
                    <Button type="button" variant="outline" onClick={onClose} iconName="X">Cancel</Button>
                    <Button type="button" onClick={() => { onSave(v.trim()); onClose(); }} iconName="Check">Save</Button>
                </>
            }
        >
            <div className="space-y-2">
                <Textarea
                    minRows={8}
                    value={v}
                    maxLength={maxLength}
                    onChange={(e) => setV(e.target.value)}
                    placeholder={placeholder || 'Type here…'}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{v.trim().length} / {maxLength}</span>
                    <span>Characters left: {left}</span>
                </div>
            </div>
        </ModalBase>
    );
}