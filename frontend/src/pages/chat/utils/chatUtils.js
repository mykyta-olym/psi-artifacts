// src/pages/chat/utils/chatUtils.jsx
import React from 'react';
import { getInitials, nameFromEmail } from '../../../utils/displayName';

const TITLE_PREFIXES = ['Bc.','Mgr.','Ing.','RNDr.','PaedDr.','Mgr. art.','doc.','prof.','Dr.','JUDr.','MUDr.'];

export const stripTitlesFrom = (full = '') => {
    let s = String(full || '').split(/\s*,\s*/)[0] || '';
    for (;;) {
        const before = s.trim();
        const after = before.replace(
            new RegExp(`^(?:${TITLE_PREFIXES.map(t => t.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})\\s+`, 'i'),
            ''
        );
        s = after.trim();
        if (after === before) break;
    }
    return s.trim();
};

export const initialsFrom = (full = '', email = '') => {
    // If full name looks like email, extract name from it
    let name = full;
    if (!name || name.includes('@')) {
        name = nameFromEmail(full || email);
    }
    return getInitials({ name, email }) || '?';
};

export const Avatar = ({ name, email }) =>
    React.createElement(
        'div',
        { className: 'w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-semibold' },
        initialsFrom(name, email)
    );

export const GEMINI = { id: 'ai:gemini', role: 'ai', name: 'Gemini' };
export const findGemini = (thread) =>
    ((thread?.participants) || []).find(p => p.id === GEMINI.id || p.role === 'ai');
export const hasGemini = (thread) => !!findGemini(thread);

// Check if thread has real human participants (not AI)
export const hasHumanParticipants = (thread) => {
    const participants = thread?.participants || [];
    return participants.some(p => p.role !== 'ai' && p.id !== GEMINI.id);
};