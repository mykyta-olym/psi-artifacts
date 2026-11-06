// src/pages/final-thesis/components/modals/ConfirmModal.jsx
import React, { useEffect, useState } from 'react';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import ModalBase from './ModalBase';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onClose, requireNote = false }) {
    const [note, setNote] = useState('');
    useEffect(() => { if (!open) setNote(''); }, [open]);
    return (
        <ModalBase
            open={open}
            title={title}
            subtitle={requireNote ? 'Optional note will be saved with the action.' : undefined}
            onClose={onClose}
            footer={
                <>
                    <Button type="button" variant="outline" onClick={onClose} iconName="X">{cancelLabel}</Button>
                    <Button type="button" onClick={() => { onConfirm(requireNote ? note : undefined); onClose(); }} iconName="Check">{confirmLabel}</Button>
                </>
            }
        >
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{message}</p>
                {requireNote && (
                    <Textarea
                        minRows={5}
                        placeholder="Add a short note (optional)..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                )}
            </div>
        </ModalBase>
    );
}