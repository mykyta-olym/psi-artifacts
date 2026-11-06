// src/pages/student-studies/components/AssessmentTable.jsx
import React from 'react';

export default function AssessmentTable({ items, showTerm }) {
    return (
        <div className="overflow-x-auto thin-scrollbar rounded-lg border border-border">
            <table className="w-full text-sm">
                <thead>
                <tr className="text-left border-b border-border">
                    <th className="py-2 px-3 w-10">No.</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">Score</th>
                    {showTerm && <th className="py-2 px-3">Semester type</th>}
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Awarded by</th>
                    <th className="py-2 px-3">Note</th>
                </tr>
                </thead>
                <tbody>
                {items.map((r) => (
                    <tr key={r.no} className="border-b border-border">
                        <td className="py-2 px-3">{r.no}</td>
                        <td className="py-2 px-3">{r.title}</td>
                        <td className="py-2 px-3">{r.pct}%</td>
                        {showTerm && <td className="py-2 px-3">{r.termType || '—'}</td>}
                        <td className="py-2 px-3 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 px-3">{r.by}</td>
                        <td className="py-2 px-3 text-muted-foreground">—</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}