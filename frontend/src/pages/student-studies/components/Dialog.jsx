// src/pages/student-studies/components/Dialog.jsx
import React from 'react';
import ModalBase from '../../../components/ui/ModalBase';

export default function Dialog({ title, children, onClose }) {
    return (
        <ModalBase
            open={true}
            title={title}
            onClose={onClose}
            maxWidth="max-w-2xl"
        >
            {children}
        </ModalBase>
    );
}