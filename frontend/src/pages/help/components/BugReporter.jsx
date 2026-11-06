import React from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import Icon from '../../../components/AppIcon';

const BugReporter = ({
                         anchorId,
                         bug, setBug,
                         bugMarkdown, bugHtml,
                         copied, onCopyMd, onCopyHtml, onDownload, onMail,
                         previewMode, setPreviewMode
                     }) => (
    <section id={anchorId} className="bg-card rounded-lg border border-border p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-4">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 md:h-9 md:w-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
                    <Icon name="Bug" size={16} />
                </div>
                <h2 className="text-lg md:text-xl font-semibold leading-tight">Report a Bug</h2>
            </div>
            <span className="text-xs text-muted-foreground">Markdown template • Live preview</span>
        </div>

        {/* Row 1: controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
            <Select
                label="Category"
                value={bug.category}
                onChange={(v) => setBug({ ...bug, category: String(v || '') })}
                options={['ui', 'performance', 'data', 'accessibility', 'other'].map(v => ({
                    value: v,
                    label: ({ ui: 'UI / Styling', performance: 'Performance', data: 'Data / Sync', accessibility: 'Accessibility', other: 'Other' })[v]
                }))}
                className="w-full"
            />
            <Select
                label="Severity"
                value={bug.severity}
                onChange={(v) => setBug({ ...bug, severity: String(v || '') })}
                options={['low', 'medium', 'high', 'critical'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
                className="w-full"
            />
            <Input
                label="Short summary"
                value={bug.summary}
                onChange={(e) => setBug({ ...bug, summary: e.target.value })}
                placeholder="e.g., Activities page duplicates rows after per-page change"
                className="w-full"
            />
        </div>

        {/* Row 2: text areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 mt-3">
            <Textarea
                label="Steps to reproduce"
                minRows={6}
                value={bug.repro}
                onChange={(e) => setBug({ ...bug, repro: e.target.value })}
                placeholder="- Step 1…"
            />

        <div className="grid grid-cols-1 gap-2 md:gap-3">
            <Textarea
                label="Expected result"
                minRows={3}
                value={bug.expected}
                onChange={(e) => setBug({ ...bug, expected: e.target.value })}
            />
            <Textarea
                label="Actual result"
                minRows={3}
                value={bug.actual}
                onChange={(e) => setBug({ ...bug, actual: e.target.value })}
            />
        </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
                className="w-full sm:w-auto"
                variant="default"
                iconName={copied ? 'Check' : 'Copy'}
                onClick={onCopyMd}
            >
                {copied ? 'Copied' : 'Copy Markdown'}
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" iconName="Code" onClick={onCopyHtml}>
                Copy HTML
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" iconName="Download" onClick={onDownload}>
                Download .md
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" iconName="Mail" onClick={onMail}>
                Email to Support
            </Button>
        </div>

        {/* Preview */}
        <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <label className="text-sm">Preview</label>

                {/* segmented toggle */}
                <div className="sm:ml-auto inline-flex rounded-md border border-border overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setPreviewMode('rendered')}
                        className={`px-3 py-1.5 text-sm transition ${
                            previewMode === 'rendered'
                                ? 'bg-background text-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                        aria-pressed={previewMode === 'rendered'}
                    >
                        Rendered
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreviewMode('raw')}
                        className={`px-3 py-1.5 text-sm transition border-l border-border ${
                            previewMode === 'raw'
                                ? 'bg-background text-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                        aria-pressed={previewMode === 'raw'}
                    >
                        Raw
                    </button>
                </div>
            </div>

            {previewMode === 'raw' ? (
                <pre className="p-3 bg-muted rounded border border-border overflow-auto text-xs sm:text-[13px] whitespace-pre-wrap break-words max-h-[50vh]">
          {bugMarkdown}
        </pre>
            ) : (
                <div
                    className="p-4 bg-muted/40 rounded border border-border prose prose-sm max-w-none break-words overflow-auto max-h-[50vh]"
                     
                    dangerouslySetInnerHTML={{ __html: bugHtml }}
                />
            )}
        </div>
    </section>
);

export default BugReporter;