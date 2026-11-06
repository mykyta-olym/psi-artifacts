// src/pages/student-studies/components/ThesisInfoCard.jsx
import React from 'react';
import InfoRow from './InfoRow';

export default function ThesisInfoCard({ info }) {
    if (!info) return null;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow label="Identifier" value={info.identifier} />
                <InfoRow label="Type" value={info.type} />
                <InfoRow label="Title" value={info.title} />
                <InfoRow label="Department" value={info.department} />
                <InfoRow label="Supervisor" value={info.supervisor} />
                <InfoRow label="Opponent" value={info.opponent} />
                <InfoRow label="Consultant" value={info.consultant} />
                <InfoRow label="Primary language" value={info.primaryLang} />
                <InfoRow label="Secondary language" value={info.secondaryLang} />
                <InfoRow label="Issue date" value={info.issuedAt} />
                <InfoRow label="Assignment date" value={info.assignedAt} />
                <InfoRow label="Study program" value={info.programGroup} />
                <InfoRow label="Keywords" value={info.keywords} />
            </div>

            <div className="rounded-lg border border-border p-3">
                <div className="text-sm">Originality check result: <span className="font-medium">{info.originalityPct}</span></div>
                <div className="text-xs text-muted-foreground">Originality check date: {info.originalityCheckDate}</div>
            </div>

            <div className="overflow-x-auto thin-scrollbar rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="text-left border-b border-border">
                        <th className="py-2 px-3 w-10">#</th>
                        <th className="py-2 px-3">Subject</th>
                        <th className="py-2 px-3">Semester</th>
                        <th className="py-2 px-3">Assessment name</th>
                        <th className="py-2 px-3">Score</th>
                        <th className="py-2 px-3">Date</th>
                    </tr>
                    </thead>
                    <tbody>
                    {info.thesisGrades.map((g,i)=>(
                        <tr key={i} className="border-b border-border">
                            <td className="py-2 px-3">{i+1}</td>
                            <td className="py-2 px-3">{g.subject}</td>
                            <td className="py-2 px-3">{g.term}</td>
                            <td className="py-2 px-3">{g.name}</td>
                            <td className="py-2 px-3">{g.pct}%</td>
                            <td className="py-2 px-3">{g.date}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}