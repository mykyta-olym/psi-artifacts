// src/pages/final-thesis/FinalThesis.jsx
import React from 'react';
import { ToastsProvider, ToastViewport } from '../../components/ui/Toasts';
import FinalThesisInner from './components/FinalThesisInner';

export default function FinalThesisPage() {
    return (
        <ToastsProvider>
            <FinalThesisInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
}