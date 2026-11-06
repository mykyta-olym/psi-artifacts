// src/pages/final-thesis/components/RequestsSection.jsx
import React from 'react';
import Button from '../../../components/ui/Button';
import Pill from './Pill';
import { nowIso, fmt } from '../utils/thesisUtils';

export default function RequestsSection({ requests, onNew, onEdit, onCancel, onDelete }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Assignment requests</h3>
                <div className="toolbar">
                    <Button type="button" iconName="PlusCircle" onClick={onNew}>New request</Button>
                    {requests.length > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            iconName="Save"
                            onClick={() => {
                                const blob = new Blob([JSON.stringify(requests, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `thesis_requests_${Date.now()}.json`; a.click();
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                            }}
                        >
                            Export
                        </Button>
                    )}
                </div>
            </div>

            {!requests.length ? (
                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                    You have not created any requests yet.
                </div>
            ) : (
                <div className="bg-card glass-card rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm min-w-[980px]">
                        <thead>
                        <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-3 text-muted-foreground border-b border-border">
                            <th>#</th><th>Year</th><th>Degree</th><th>Program</th><th>Language</th><th>Supervisor</th><th>Topic</th><th>Status</th><th>Updated</th><th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {requests.map((r, i) => (
                            <tr key={String(r?.id ?? i)} className="[&>td]:py-2 [&>td]:px-3 border-b border-border/60">
                                <td>{i + 1}</td>
                                <td>{r.academicYear}</td>
                                <td className="uppercase">{r.degree}</td>
                                <td>{r.program}</td>
                                <td>{r.language}</td>
                                <td>{r.supervisorId ? 'Selected' : '—'}</td>
                                <td className="truncate max-w-[260px]">{r.topic || <span className="text-muted-foreground">—</span>}</td>
                                <td>
                                    <Pill intent={
                                        r.status === 'submitted' ? 'primary' :
                                            r.status === 'approved' ? 'green' :
                                                r.status === 'returned' ? 'amber' :
                                                    r.status === 'rejected' ? 'red' : 'gray'
                                    }>{String(r.status || 'draft').toUpperCase()}</Pill>
                                </td>
                                <td>{fmt(r.updatedAt || r.createdAt || nowIso())}</td>
                                <td className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" size="xs" variant="outline" iconName="Edit3" onClick={() => onEdit(r)}>Open</Button>
                                        {(r.status === 'submitted' || r.status === 'draft') && (
                                            <Button type="button" size="xs" variant="ghost" iconName="XCircle" onClick={() => onCancel(r.id)}>Cancel</Button>
                                        )}
                                        <Button type="button" size="xs" variant="ghost" iconName="Trash2" onClick={() => onDelete(r.id)}>Delete</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}