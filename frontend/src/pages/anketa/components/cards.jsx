import React from 'react';
import Button from '../../../components/ui/Button';
import { Pill } from './ui';
import { clamp, isWindowOpen, parseLocalDate, formatRelativeTime } from '../utils/utils';
import { getResponsesSync } from './storage';

export const SurveyCardStudent = ({ s, openSurvey, handleRemoveLocal, handleQuickSaveDraft, loadEntry }) => {
    const entry = loadEntry(s.id);
    const submitted = !!entry?.submittedAt;
    const draftActive = !submitted && s.hasDraft;
    const lastSavedAt = entry?.updatedAt || (draftActive ? entry?.submittedAt : null);
    const submittedAt = entry?.submittedAt;
    const answered = Number.isFinite(s.answered) ? s.answered : 0;
    const required = Number.isFinite(s.required) ? s.required : 0;
    const rawWidth = Number.isFinite(s.progress) ? s.progress : 0;
    const width = Number.isFinite(clamp(rawWidth, 0, 100)) ? clamp(rawWidth, 0, 100) : 0;
    return (
        <article className="bg-card glass-card rounded-lg border border-border p-4 hover-lift">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-foreground truncate">{s.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Pill intent="gray">{s.category}</Pill>
                        <span>{s.isAnonymous ? 'Anonymous' : 'Identified'}</span>
                        <span>Open {s.openAt} – {s.closeAt}</span>
                    </div>
                </div>
                <div className="shrink-0 text-right space-y-1">
                    <div className={`text-xs flex items-center justify-end gap-1 ${s.status === 'open' ? 'text-primary-200' : 'text-muted-foreground'}`}>
                        {draftActive && <span className="text-amber-200">DRAFT</span>}
                        <span>{s.status.toUpperCase()}</span>
                    </div>
                    <div className="mt-1 text-sm">{answered}/{required}</div>
                </div>
            </div>
            <div className="mt-3">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${width}%` }} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">{width}% required answered</div>
                {draftActive && (
                    <div className="mt-2 text-xs text-amber-100/90">Draft saved {formatRelativeTime(lastSavedAt, 'just now')}</div>
                )}
                {submitted && submittedAt && (
                    <div className="mt-2 text-xs text-emerald-200/90">Submitted {formatRelativeTime(submittedAt)}</div>
                )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                {submitted ? (
                    <>
                        <Button size="sm" variant="outline" iconName="Eye" onClick={() => openSurvey(s, true)}>View submission</Button>
                        <Button size="sm" variant="ghost" iconName="Trash2" onClick={() => handleRemoveLocal(s)}>Remove local copy</Button>
                    </>
                ) : s.status === 'open' ? (
                    <>
                        <Button size="sm" iconName="Clipboard" onClick={() => openSurvey(s, false)}>
                            {answered > 0 ? 'Continue' : 'Start'}
                        </Button>
                        <Button size="sm" variant="outline" iconName="Save" onClick={() => handleQuickSaveDraft(s)}>
                            Save draft
                        </Button>
                    </>
                ) : (
                    <Button size="sm" variant="outline" iconName="Info" disabled>Closed</Button>
                )}
            </div>
        </article>
    );
};

export const TeacherManageCard = ({ s, openBuilderEdit, duplicateSurvey, openSurvey, togglePublished, deleteSurvey }) => {
    const open = isWindowOpen(s.openAt, s.closeAt);
    const start = parseLocalDate(s.openAt)?.getTime() || 0;
    const now = new Date().getTime();
    const status = open ? 'OPEN' : (start > now ? 'UPCOMING' : 'CLOSED');
    const subs = getResponsesSync(s.id)?.length ?? 0;
    return (
        <article className="bg-card glass-card rounded-lg border border-border p-4 hover-lift">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-foreground truncate">{s.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Pill intent="gray">{s.category}</Pill>
                        <span>{s.isAnonymous ? 'Anonymous' : 'Identified'}</span>
                        <span>Open {s.openAt} – {s.closeAt}</span>
                        <Pill intent={s.published ? 'green' : 'amber'}>{s.published ? 'PUBLISHED' : 'UNPUBLISHED'}</Pill>
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">{status}</div>
                    <div className="text-sm font-medium">{subs} responses</div>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" iconName="Edit3" onClick={() => openBuilderEdit(s)}>Edit</Button>
                <Button size="sm" variant="outline" iconName="Copy" onClick={() => duplicateSurvey(s)}>Duplicate</Button>
                <Button size="sm" variant="outline" iconName="Eye" onClick={() => openSurvey(s, true)}>Preview</Button>
                <Button size="sm" variant="outline" iconName="CheckCircle" onClick={() => togglePublished(s)}>{s.published ? 'Unpublish' : 'Publish'}</Button>
                <Button size="sm" variant="ghost" iconName="Trash2" onClick={() => deleteSurvey(s)}>Delete</Button>
            </div>
        </article>
    );
};