// src/pages/help/components/Shortcuts.jsx
import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import useSelectedStudyValue from '../../../hooks/useSelectedStudyValue';

const isBcInf = (rec) => String(rec?.programCode || '').toLowerCase() === 'inf_bc_d_sk';
const isArchived = (rec) => !!rec && rec.ongoing === false;

const Shortcuts = ({ anchorId }) => {
    const { user } = useAuth() || {};
    const role = (user?.role === 'teacher' ? 'teacher' : 'student');
    const studyResult = useSelectedStudyValue();
    const study = studyResult.value;
    const restricted = role === 'student' && (isArchived(study) || isBcInf(study));

    const items = useMemo(() => {
        const base = [
            { id: 'pal', k: '⌘/Ctrl + K', d: 'Command Palette' },
            { id: 'mv',  k: 'J / K',      d: 'Move selection (lists)' },
            { id: 'ok',  k: 'Enter',      d: 'Open selected item' },
            { id: 'esc', k: 'Esc',        d: 'Close dialogs / palette' },
        ];

        const navCommon = [
            { id: 'ga', k: 'G then A', d: 'Go to Activities', path: '/activities' },
            { id: 'gp', k: 'G then P', d: 'Go to Profile',    path: '/profile' },
        ];
        const navTeacherOnly = [
            { id: 'gf', k: 'G then F', d: 'Go to Faculty (Teachers)', path: '/faculty-management' },
        ];

        let nav = navCommon;
        if (role === 'teacher') nav = [...navCommon, ...navTeacherOnly];

        if (restricted) {
            const allowed = new Set(['/student-dashboard', '/student-studies', '/print-reports', '/final-thesis', '/anketa', '/help']);
            nav = nav.filter(x => allowed.has(x.path));
        }

        return [...base, ...nav];
    }, [role, restricted]);

    return (
        <section id={anchorId} className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
                <Icon name="Keyboard" size={18} />
                <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
            </div>

            <div className="grid grid-cols-1 gap-2">
                {items.map((i) => (
                    <div key={i.id} className="flex items-center justify-between border border-border rounded px-3 py-2">
                        <div className="text-sm">{i.d}</div>
                        <div className="text-xs text-muted-foreground">{i.k}</div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Shortcuts;