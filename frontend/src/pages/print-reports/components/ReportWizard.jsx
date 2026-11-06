// src/pages/print-reports/components/ReportWizard.jsx
import React from 'react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';

const cx = (...a) => a.filter(Boolean).join(' ');

const Toggle = ({ value, onChange, label }) => {
    return (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className={cx(
                'inline-flex items-center gap-2 px-3 py-2 rounded-md border transition text-sm',
                value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border hover:bg-muted/70'
            )}
        >
            <span className="w-2 h-2 rounded-full" style={{ background: value ? 'currentColor' : 'transparent' }} />
            {label}
        </button>
    );
};

const Label = ({ children }) => <div className="text-xs text-muted-foreground">{children}</div>;

const FieldRow = ({ children }) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;

const WizardFields = ({ kind, form, onForm }) => {
    if (kind === 'confirm') {
        return (
            <>
                <FieldRow>
                    <Input label="Full name" value={form.fullName} onChange={(e) => onForm({ ...form, fullName: e.target.value })} />
                    <Input label="Study program" value={form.program} onChange={(e) => onForm({ ...form, program: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Faculty" value={form.faculty} onChange={(e) => onForm({ ...form, faculty: e.target.value })} />
                    <Select
                        label="Form of study"
                        value={form.studyForm}
                        options={[{ value: 'Full-time', label: 'Full-time' }, { value: 'Part-time', label: 'Part-time' }]}
                        onChange={(v) => onForm({ ...form, studyForm: typeof v === 'string' ? v : v?.value })}
                    />
                </FieldRow>
                <FieldRow>
                    <Select
                        label="Level"
                        value={form.studyLevel}
                        options={[{ value: 'B.Sc.', label: 'B.Sc.' }, { value: 'M.Sc.', label: 'M.Sc.' }, { value: 'M.A.', label: 'M.A.' }]}
                        onChange={(v) => onForm({ ...form, studyLevel: typeof v === 'string' ? v : v?.value })}
                    />
                    <Input label="Year" value={form.year} onChange={(e) => onForm({ ...form, year: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Issued at" type="date" value={form.issuedAt} onChange={(e) => onForm({ ...form, issuedAt: e.target.value })} />
                    <Input label="Valid until" type="date" value={form.validUntil} onChange={(e) => onForm({ ...form, validUntil: e.target.value })} />
                </FieldRow>
            </>
        );
    }
    if (kind === 'confirm_upsvar') {
        return (
            <>
                <FieldRow>
                    <Input label="Full name" value={form.fullName} onChange={(e) => onForm({ ...form, fullName: e.target.value })} />
                    <Input label="National ID" value={form.nationalId} onChange={(e) => onForm({ ...form, nationalId: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Address" value={form.address} onChange={(e) => onForm({ ...form, address: e.target.value })} />
                    <Input label="Study program" value={form.program} onChange={(e) => onForm({ ...form, program: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Issued at" type="date" value={form.issuedAt} onChange={(e) => onForm({ ...form, issuedAt: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Purpose for Labour Office" value={form.upsvarPurpose} onChange={(e) => onForm({ ...form, upsvarPurpose: e.target.value })} />
                </FieldRow>
            </>
        );
    }
    if (kind === 'immatriculation') {
        return (
            <>
                <FieldRow>
                    <Input label="Full name" value={form.fullName} onChange={(e) => onForm({ ...form, fullName: e.target.value })} />
                    <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => onForm({ ...form, dateOfBirth: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Place of birth" value={form.placeOfBirth} onChange={(e) => onForm({ ...form, placeOfBirth: e.target.value })} />
                    <Input label="Program" value={form.program} onChange={(e) => onForm({ ...form, program: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Year" value={form.year} onChange={(e) => onForm({ ...form, year: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Enrollment date" type="date" value={form.issuedAt} onChange={(e) => onForm({ ...form, issuedAt: e.target.value })} />
                </FieldRow>
            </>
        );
    }
    if (kind === 'study_overview') {
        return (
            <>
                <FieldRow>
                    <Input label="Full name" value={form.fullName} onChange={(e) => onForm({ ...form, fullName: e.target.value })} />
                    <Input label="Program" value={form.program} onChange={(e) => onForm({ ...form, program: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Select
                        label="Level"
                        value={form.studyLevel}
                        options={[{ value: 'B.Sc.', label: 'B.Sc.' }, { value: 'M.Sc.', label: 'M.Sc.' }, { value: 'M.A.', label: 'M.A.' }]}
                        onChange={(v) => onForm({ ...form, studyLevel: typeof v === 'string' ? v : v?.value })}
                    />
                    <Select
                        label="Form of study"
                        value={form.studyForm}
                        options={[{ value: 'Full-time', label: 'Full-time' }, { value: 'Part-time', label: 'Part-time' }]}
                        onChange={(v) => onForm({ ...form, studyForm: typeof v === 'string' ? v : v?.value })}
                    />
                </FieldRow>
                <FieldRow>
                    <Input label="Year" value={form.year} onChange={(e) => onForm({ ...form, year: e.target.value })} />
                </FieldRow>
            </>
        );
    }
    if (kind === 'accommodation_contract') {
        return (
            <>
                <FieldRow>
                    <Input label="Full name" value={form.fullName} onChange={(e) => onForm({ ...form, fullName: e.target.value })} />
                    <Input label="Student ID" value={form.studentId} onChange={(e) => onForm({ ...form, studentId: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Accommodation from" type="date" value={form.accommodationFrom} onChange={(e) => onForm({ ...form, accommodationFrom: e.target.value })} />
                    <Input label="Accommodation to" type="date" value={form.accommodationTo} onChange={(e) => onForm({ ...form, accommodationTo: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Accommodation address" value={form.accommodationAddress} onChange={(e) => onForm({ ...form, accommodationAddress: e.target.value })} />
                    <Input label="Email" value={form.email} onChange={(e) => onForm({ ...form, email: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Phone" value={form.phone} onChange={(e) => onForm({ ...form, phone: e.target.value })} />
                </FieldRow>
            </>
        );
    }
    if (kind === 'accommodation_addendum') {
        return (
            <>
                <FieldRow>
                    <Input label="Full name" value={form.fullName} onChange={(e) => onForm({ ...form, fullName: e.target.value })} />
                    <Input label="Student ID" value={form.studentId} onChange={(e) => onForm({ ...form, studentId: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Original accommodation from" type="date" value={form.accommodationFrom} onChange={(e) => onForm({ ...form, accommodationFrom: e.target.value })} />
                    <Input label="Original accommodation to" type="date" value={form.accommodationTo} onChange={(e) => onForm({ ...form, accommodationTo: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="New accommodation valid until" type="date" value={form.validUntil} onChange={(e) => onForm({ ...form, validUntil: e.target.value })} />
                </FieldRow>
            </>
        );
    }
    if (kind === 'residence_report') {
        return (
            <>
                <FieldRow>
                    <Input label="Full name" value={form.fullName} onChange={(e) => onForm({ ...form, fullName: e.target.value })} />
                    <Input label="Valid from" type="date" value={form.accommodationFrom} onChange={(e) => onForm({ ...form, accommodationFrom: e.target.value })} />
                </FieldRow>
                <FieldRow>
                    <Input label="Permanent address" value={form.address} onChange={(e) => onForm({ ...form, address: e.target.value })} />
                    <Input label="Temporary residence" value={form.accommodationAddress} onChange={(e) => onForm({ ...form, accommodationAddress: e.target.value })} />
                </FieldRow>
            </>
        );
    }
    return null;
};

const ReportWizard = ({ open, onClose, kind, form, onForm, previewHtml, previewLoading = false, previewError = '', footerSlot = null }) => {
    const titleMap = {
        confirm: 'Confirmation of Study',
        confirm_upsvar: 'Confirmation of Study for Labour Office',
        immatriculation: 'Matriculation Letter',
        study_overview: 'Study Overview',
        accommodation_contract: 'Accommodation Contract',
        accommodation_addendum: 'Accommodation Contract Addendum',
        residence_report: 'Residence Report'
    };
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[520] p-2 sm:p-3 flex items-start sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-[1400px] h-[92vh] bg-card border border-border rounded-xl shadow-modal overflow-hidden flex flex-col">
                <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2 sm:pb-3 border-b border-border flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">{titleMap[kind]}</h3>
                        <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Fill in the details to generate the print report</div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <Button variant="ghost" size="sm" iconName="X" onClick={onClose}>Close</Button>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 xl:grid-cols-5 gap-0 overflow-hidden">
                    <div className="xl:col-span-2 p-3 sm:p-5 h-full overflow-y-auto thin-scrollbar">
                        <div className="grid grid-cols-1 gap-3">
                            <WizardFields kind={kind} form={form} onForm={onForm} />
                            <FieldRow>
                                <Select
                                    label="Language"
                                    value={form.language}
                                    options={[{ value: 'en', label: 'English' }]}
                                    onChange={(v) => onForm({ ...form, language: typeof v === 'string' ? v : v?.value })}
                                />
                                <div className="flex items-end gap-2">
                                    <Toggle value={form.includeQr} onChange={(v) => onForm({ ...form, includeQr: v })} label="QR code" />
                                    <Toggle value={form.includeWatermark} onChange={(v) => onForm({ ...form, includeWatermark: v })} label="Watermark" />
                                </div>
                            </FieldRow>
                            <div className="pt-1 sm:pt-2">
                                <Label>Tip: Turn on QR and generate your own print report.</Label>
                            </div>
                            {footerSlot}
                        </div>
                    </div>

                    <div className="xl:col-span-3 h-full bg-muted/40 border-t xl:border-t-0 xl:border-l border-border">
                        <div className="relative h-full w-full flex items-center justify-center p-3 sm:p-6">
                            <div className="bg-white shadow-2xl border border-border overflow-hidden w-auto" style={{ aspectRatio: '210 / 297', height: '100%', maxWidth: '100%' }}>
                                {previewHtml ? (
                                    <iframe title="preview" className="w-full h-full" srcDoc={previewHtml} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">No preview yet</div>
                                )}
                            </div>
                            {previewLoading && (
                                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center text-sm text-muted-foreground">
                                    Generating preview…
                                </div>
                            )}
                            {!previewLoading && previewError && (
                                <div className="absolute inset-0 bg-destructive/10 text-destructive flex items-center justify-center text-sm text-center px-6">
                                    {previewError}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportWizard;