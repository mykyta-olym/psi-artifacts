// src/pages/final-thesis/components/MyThesis.jsx
import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import Pill from './Pill';
import { fmt } from '../utils/thesisUtils';

export default function MyThesis({ myThesis, onExport, onRequestUpload, onMarkSubmitted, onEditAbstract, onEditAnnotation, onRemoveAttachment, children }) {
    if (!myThesis) {
        return (
            <div className="glass-card rounded-xl border border-border/70 bg-card/80 shadow-lg shadow-black/20 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-primary/15 border-b border-primary/20">
                    <Icon name="Info" size={18} className="text-primary" />
                    <div>
                        <p className="text-sm font-semibold text-foreground">No thesis assigned yet</p>
                        <p className="text-xs text-muted-foreground/90">
                            As soon as your supervisor confirms a topic, your assignment will appear here.
                        </p>
                    </div>
                </div>
                <div className="p-6 sm:p-7 text-sm text-muted-foreground/95 leading-relaxed bg-gradient-to-b from-white/4 to-transparent backdrop-blur">
                    <p>
                        You can browse available topics in the catalogue and submit a request.
                        Once approved, your thesis dashboard will unlock progress tracking,
                        submission uploads, and supervisor feedback in one place.
                    </p>
                </div>
            </div>
        );
    }

    const statusColor = myThesis.status === 'graded' ? 'green' : myThesis.status === 'defended' ? 'amber' : myThesis.status === 'submitted' ? 'primary' : 'gray';
    const canSubmit = !['submitted', 'defended', 'graded'].includes(String(myThesis.status || '').toLowerCase());

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
                <article className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-foreground">{myThesis.title}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Pill>{myThesis.type}</Pill>
                                <span>Identifier #{myThesis.identifier}</span>
                                <span>Program: {myThesis.program}</span>
                                <span>Due: {fmt(myThesis.dueAt)}</span>
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <Pill intent={statusColor}>{String(myThesis.status || '').toUpperCase()}</Pill>
                            <div className="text-xs text-muted-foreground">Assigned {fmt(myThesis.assignedAt)}</div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground">Supervisor</div>
                            <div className="font-medium">{myThesis.supervisor?.name}</div>
                            <div className="text-xs text-muted-foreground">{myThesis.supervisor?.email}</div>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground">Opponent</div>
                            <div className="font-medium">{myThesis.opponent?.name}</div>
                            <div className="text-xs text-muted-foreground">{myThesis.opponent?.email}</div>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">Abstract</div>
                            <Button type="button" size="xs" variant="outline" iconName="Edit3" onClick={onEditAbstract}>Edit</Button>
                        </div>
                        <p className="text-sm mt-1">{myThesis.abstract || <em className="text-muted-foreground">No abstract yet.</em>}</p>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">Annotation</div>
                            <Button type="button" size="xs" variant="outline" iconName="Edit3" onClick={onEditAnnotation}>Edit</Button>
                        </div>
                        <p className="text-sm mt-1">{myThesis.annotation || <em className="text-muted-foreground">No annotation yet.</em>}</p>
                    </div>

                    <div className="mt-4 btn-group">
                        <Button type="button" size="sm" iconName="Save" onClick={onExport}>Export JSON</Button>
                        <Button type="button" size="sm" variant="outline" iconName="Send" onClick={onMarkSubmitted} disabled={!canSubmit}>
                            {canSubmit ? 'Mark as submitted' : 'Already submitted'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" iconName="Paperclip" onClick={onRequestUpload}>Upload attachments</Button>
                        {children}
                    </div>
                    {myThesis.submissionNote ? (
                        <div className="mt-2 text-xs text-muted-foreground">Submission note: {myThesis.submissionNote}</div>
                    ) : null}
                </article>

                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="text-sm font-medium mb-3">Grades & defense</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground mb-1">Defense</div>
                            <div className="text-sm">Date: {fmt(myThesis.defense.date)} • Room: {myThesis.defense.room}</div>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground mb-1">Originality check</div>
                            <div className="text-sm">Checked: {fmt(myThesis.originality.checkedAt)} • Similarity: {myThesis.originality.percentage}%</div>
                            <a className="text-xs text-primary underline" href={myThesis.originality.protocolUrl} target="_blank" rel="noreferrer">Protocol link</a>
                        </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm min-w-[560px]">
                            <thead>
                            <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-2 text-muted-foreground border-b border-border">
                                <th>#</th><th>Item</th><th>Semester</th><th>Assessed by</th><th>Grade</th><th>Date</th>
                            </tr>
                            </thead>
                            <tbody>
                            {(myThesis.grades || []).map((g, i) => (
                                <tr key={String(i)} className="[&>td]:py-2 [&>td]:px-2 border-b border-border/60">
                                    <td>{i + 1}</td><td>{g.item}</td><td>{g.term}</td><td>{g.by}</td><td className="font-medium">{g.grade}</td><td>{fmt(g.date)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <div className="space-y-6">
                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="text-sm font-medium mb-3">Attachments</div>
                    {(!myThesis.attachments || !myThesis.attachments.length) ? (
                        <div className="text-sm text-muted-foreground">No files yet.</div>
                    ) : (
                        <ul className="space-y-2">
                            {myThesis.attachments.map((f, i) => (
                                <li key={String(f?.id ?? i)} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                                    <div className="min-w-0 flex items-center gap-2">
                                        <Icon name="FileText" size={16} className="text-primary" />
                                        <span className="truncate">{f.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs text-muted-foreground">{Math.round((f.size || 0) / 1024)} KB</div>
                                        <Button type="button" size="xs" variant="ghost" iconName="Trash2" onClick={() => onRemoveAttachment(f.id)}>Remove</Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="text-sm font-medium mb-3">Languages & metadata</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground">Primary language</div>
                            <div>{myThesis.primaryLanguage}</div>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground">Secondary language</div>
                            <div>{myThesis.secondaryLanguage}</div>
                        </div>
                        <div className="rounded-lg border border-border p-3 sm:col-span-2">
                            <div className="text-xs text-muted-foreground">Keywords</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {(myThesis.keywords || []).map((k, i) => <Pill key={String(i)} intent="gray">{k}</Pill>)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}