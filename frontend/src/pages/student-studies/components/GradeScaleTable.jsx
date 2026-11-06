// src/pages/student-studies/components/GradeScaleTable.jsx
import React from 'react';

export default function GradeScaleTable() {
    const rows = [
        { grade: 'A – Excellent', upper: '100%', lower: '91%' },
        { grade: 'B – Very good', upper: '90%', lower: '81%' },
        { grade: 'C – Good', upper: '80%', lower: '71%' },
        { grade: 'D – Satisfactory', upper: '70%', lower: '61%' },
        { grade: 'E – Sufficient', upper: '60%', lower: '51%' },
        { grade: 'FX – Insufficient', upper: '50%', lower: '0%' }
    ];
    return (
        <div className="rounded-lg border border-border">
            <div className="px-3 py-2 border-b border-border text-sm font-medium">Grade conversion table</div>
            <div className="divide-y divide-border">
                <div className="grid grid-cols-3 text-xs text-muted-foreground px-3 py-2">
                    <div>Overall grade</div><div>Upper bound</div><div>Lower bound</div>
                </div>
                {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-3 text-sm px-3 py-2">
                        <div>{r.grade}</div><div>{r.upper}</div><div>{r.lower}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}