// src/pages/faculty-management/components/AddFacultyModal.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import MultiSelect from '../../../components/ui/MultiSelect';
import Textarea from '../../../components/ui/Textarea';
import Icon from '../../../components/AppIcon';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useToasts } from '../../../components/ui/Toasts';
import { maisId, ensureEmployeeId, isEmployeeId } from '../../../utils/ids';
import { fetchCourses, fetchScheduleEvents } from '../../../data/maisApiAdapter';
import { fetchDepartments } from '../../../data/departmentsApi';
import { fetchFacultyOptions } from '../../../data/facultyOptionsApi';
import { fetchPrograms } from '../../../data/programsApi';
import { fetchRooms } from '../../../data/roomsApi';
import {
    before,
    custom as customRule,
    date as dateRule,
    email as emailRule,
    max as maxRule,
    maxLength as maxLengthRule,
    min as minRule,
    minLength as minLengthRule,
    number as numberRule,
    phone as phoneRule,
    required,
    useFormValidator,
} from '../../../utils/validation';

const FACULTY_DRAFT_KEY = 'mais:faculty-management:add-faculty-draft';

const clamp = (n, a, b) => Math.min(b, Math.max(a, Number.isFinite(+n) ? +n : 0));
const asString = (v) =>
    typeof v === 'string' ? v : (v && typeof v === 'object' && 'value' in v ? String(v.value) : String(v ?? ''));
const notFutureDate = (iso) => {
    if (!iso) return true;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t <= Date.now();
};
const uniq = (arr) => Array.from(new Set((arr || []).map((s) => String(s || '').trim()).filter(Boolean)));
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const splitName = (full = '') => {
    const parts = String(full).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const PREFIX_SUGGESTIONS = ['Bc.', 'Mgr.', 'Ing.', 'RNDr.', 'doc.', 'prof.', 'Dr.', 'JUDr.', 'MUDr.'];
const SUFFIX_SUGGESTIONS = ['PhD.', 'CSc.', 'DrSc.', 'MBA', 'Th.D.', 'ArtD.'];

const normPrefix = (t = '') => {
    const x = String(t).trim();
    if (!x) return '';
    const map = {
        'bc.': 'Bc.',
        'mgr.': 'Mgr.',
        'ing.': 'Ing.',
        'rndr.': 'RNDr.',
        'doc.': 'doc.',
        'prof.': 'prof.',
        'dr.': 'Dr.',
        'judr.': 'JUDr.',
        'mudr.': 'MUDr.',
    };
    const key = x.toLowerCase().endsWith('.') ? x.toLowerCase() : `${x.toLowerCase()}.`;
    return map[key] || x;
};
const normSuffix = (t = '') => {
    const x = String(t).trim();
    if (!x) return '';
    if (/^phd\.?$/i.test(x)) return 'PhD.';
    if (/^csc\.?$/i.test(x)) return 'CSc.';
    if (/^drsc\.?$/i.test(x)) return 'DrSc.';
    if (/^mba$/i.test(x)) return 'MBA';
    if (/^th\.?d\.?$/i.test(x)) return 'Th.D.';
    if (/^artd\.?$/i.test(x)) return 'ArtD.';
    return x;
};
const formatDisplayName = ({ titlesPrefix = [], givenName = '', familyName = '', titlesSuffix = [] }) => {
    const left = [...titlesPrefix, `${givenName} ${familyName}`.trim()].filter(Boolean).join(' ');
    const right = titlesSuffix.length ? `, ${titlesSuffix.join(', ')}` : '';
    return `${left}${right}`.replace(/\s+/g, ' ').trim();
};

const STEPS = [
    { id: 1, title: 'Basic Information', short: 'Basic', icon: 'User' },
    { id: 2, title: 'Employment', short: 'Work', icon: 'Briefcase' },
    { id: 3, title: 'Contact', short: 'Contact', icon: 'Phone' },
    { id: 4, title: 'Certifications & Schedule', short: 'Schedule', icon: 'Award' },
];

const STEP_FIELDS = {
    1: ['firstName', 'lastName', 'departments', 'employmentType', 'status'],
    2: ['subjects', 'yearsExperience', 'hireDate'],
    3: ['email', 'phone'],
    4: ['availability', 'certifications'],
};

const TYPES = ['full-time', 'part-time'];
const STATUSES = ['active', 'on-leave', 'inactive', 'substitute'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const daysLeft = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(+d)) return null;
    return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};

const CertCard = ({ cert, onChange, onRemove, onTogglePrimary }) => {
    const fileInputRef = useRef(null);
    const left = daysLeft(cert?.expiresOn);
    const isImg = /\.(png|jpg|jpeg|webp|gif)$/i.test(cert?.fileName || '') || /image\//.test(cert?.mimeType || '');
    return (
        <div className="rounded-lg border border-border p-3 bg-muted/20 flex gap-3">
            <div className="w-16 h-16 rounded-md bg-muted border border-border overflow-hidden grid place-items-center">
                {isImg && cert.fileUrl ? <img src={cert.fileUrl} alt="thumb" className="w-full h-full object-cover" /> : <Icon name="FileText" size={20} className="text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{cert.title || cert.fileName || 'Certificate'}</div>
                        {left != null && left < 0 && <span className="text-[11px] px-2 py-0.5 rounded bg-destructive text-destructive-foreground">Expired</span>}
                        {left != null && left >= 0 && left <= 30 && <span className="text-[11px] px-2 py-0.5 rounded bg-warning text-warning-foreground">Expiring soon</span>}
                        {cert.primary && <span className="text-[11px] px-2 py-0.5 rounded bg-primary text-primary-foreground">Primary</span>}
                    </div>
                    <Button type="button" size="xs" variant="ghost" iconName={cert.primary ? 'StarOff' : 'Star'} title={cert.primary ? 'Unset primary' : 'Mark as primary'} onClick={onTogglePrimary} />
                </div>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input placeholder="Title" value={cert.title || ''} onChange={(e) => onChange({ ...cert, title: e.target.value })} />
                    <Input placeholder="Issuer" value={cert.issuer || ''} onChange={(e) => onChange({ ...cert, issuer: e.target.value })} />
                    <Input placeholder="Verification code" value={cert.code || ''} onChange={(e) => onChange({ ...cert, code: e.target.value })} />
                    <Input type="date" placeholder="Issued" value={(cert.issuedOn || '').slice(0, 10)} onChange={(e) => onChange({ ...cert, issuedOn: e.target.value })} />
                    <Input type="date" placeholder="Expires" value={(cert.expiresOn || '').slice(0, 10)} onChange={(e) => onChange({ ...cert, expiresOn: e.target.value })} />
                    <Input placeholder="Tags (comma)" value={(cert.tags || []).join(', ')} onChange={(e) => onChange({ ...cert, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                    <div className="md:col-span-3 flex items-center gap-2">
                        <Input placeholder="File URL" value={cert.fileUrl || ''} onChange={(e) => onChange({ ...cert, fileUrl: e.target.value })} />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const url = URL.createObjectURL(f);
                                onChange({ ...cert, fileUrl: url, fileName: f.name, mimeType: f.type });
                            }}
                        />
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>Upload</Button>
                    </div>
                    <div className="md:col-span-3">
                        <Input placeholder="Notes" value={cert.notes || ''} onChange={(e) => onChange({ ...cert, notes: e.target.value })} />
                    </div>
                </div>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {cert.fileUrl && (
                        <a href={cert.fileUrl} download={cert.fileName || 'certificate'} className="inline-flex">
                            <Button type="button" size="sm" variant="ghost" iconName="Download">Download</Button>
                        </a>
                    )}
                    {cert.fileUrl && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(cert.fileUrl)} iconName="Copy">Copy link</Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" iconName="Trash2" onClick={onRemove}>Remove</Button>
                </div>
            </div>
        </div>
    );
};

const AddFacultyModal = ({
                             isOpen,
                             onClose,
                             onSave,
                             onImport,
                             existingEmployeeIds = [],
                             existingEmails = [],
                             initialValue = null,
                         }) => {
    const pristine = useMemo(
        () => ({
            firstName: '',
            lastName: '',
            titlesPrefix: [],
            titlesSuffix: [],
            email: '',
            phone: '',
            faculty: 'FEI',
            department: '',
            departmentCode: '',
            program: '',
            subjects: [],
            employmentType: 'full-time',
            status: 'active',
            availability: DAYS,
            timeWindows: {},
            rating: 0,
            avatarUrl: '',
            about: '',
            officeHours: {},
            workingHours: {},
            academicDegree: '',
            expertise: [],
            researchInterests: [],
            publications: [],
            languages: [],
            socialLinks: {
                linkedin: '',
                researchgate: '',
                orcid: '',
                googleScholar: '',
                website: ''
            }
        }),
        []
    );

    const normalizedExistingEmails = useMemo(
        () => (existingEmails || []).map((email) => String(email || '').trim().toLowerCase()).filter(Boolean),
        [existingEmails]
    );
    const initialEmailNormalized = useMemo(
        () => String(initialValue?.email || '').trim().toLowerCase(),
        [initialValue?.email]
    );
    const baselineForm = useMemo(() => {
        const merged = { ...pristine, ...(initialValue ? initialValue : {}) };
        merged.titlesPrefix = Array.isArray(merged.titlesPrefix) ? [...merged.titlesPrefix] : [];
        merged.titlesSuffix = Array.isArray(merged.titlesSuffix) ? [...merged.titlesSuffix] : [];
        merged.subjects = Array.isArray(merged.subjects) ? [...merged.subjects] : [];
        merged.expertise = Array.isArray(merged.expertise) ? [...merged.expertise] : [];
        merged.researchInterests = Array.isArray(merged.researchInterests) ? [...merged.researchInterests] : [];
        merged.publications = Array.isArray(merged.publications) ? merged.publications.map(p => ({ ...p })) : [];
        merged.languages = Array.isArray(merged.languages) ? merged.languages.map(l => ({ ...l })) : [];
        merged.socialLinks = merged.socialLinks && typeof merged.socialLinks === 'object' ? { ...merged.socialLinks } : {};
        merged.certifications = Array.isArray(merged.certifications)
            ? merged.certifications.map((c) => (c ? { ...c } : c))
            : [];
        merged.availability = Array.isArray(merged.availability) ? [...merged.availability] : [];
        merged.timeWindows = merged.timeWindows
            ? Object.fromEntries(
                  Object.entries(merged.timeWindows || {}).map(([day, window]) => [day, { ...(window || {}) }])
              )
            : {};
        return merged;
    }, [pristine, initialValue]);

    const validationSchema = useMemo(
        () => ({
            firstName: [
                required('First name is required'),
                minLengthRule('Must be at least 2 characters', { length: 2 }),
                maxLengthRule('Cannot exceed 80 characters', { length: 80 }),
            ],
            lastName: [
                required('Last name is required'),
                minLengthRule('Must be at least 2 characters', { length: 2 }),
                maxLengthRule('Cannot exceed 80 characters', { length: 80 }),
            ],
            employmentType: [
                required('Employment type is required'),
                customRule('Select a valid employment type', { validate: (value) => !value || TYPES.includes(value) }),
            ],
            status: [
                required('Status is required'),
                customRule('Select a valid status', { validate: (value) => !value || STATUSES.includes(value) }),
            ],
            subjects: [
                customRule('Add at least one subject', {
                    validate: (value) => Array.isArray(value) && value.length > 0,
                }),
            ],
            classesCount: [
            ],
            yearsExperience: [
                numberRule('Enter a valid number'),
                minRule('Cannot be negative', { value: 0 }),
                maxRule('Cannot exceed 50', { value: 50 }),
            ],
            hireDate: [
                dateRule('Enter a valid hire date'),
                before('Hire date cannot be in the future', { value: () => new Date(), label: 'today' }),
            ],
            email: [
                required('Email is required'),
                emailRule('Enter a valid email'),
                customRule('Email already exists', {
                    validate: (value) => {
                        if (!value) return true;
                        const normalized = String(value).trim().toLowerCase();
                        if (!normalized) return true;
                        if (initialEmailNormalized && normalized === initialEmailNormalized) return true;
                        return !normalizedExistingEmails.includes(normalized);
                    },
                }),
            ],
            phone: [phoneRule('Enter a valid phone number')],
            availability: [
                customRule('Select at least one day', {
                    validate: (value) => Array.isArray(value) && value.length > 0,
                }),
            ],
            certifications: [
                customRule('Remove empty certificate rows or fill them', {
                    validate: (_value, values) => {
                        const list = Array.isArray(values?.certifications) ? values.certifications : [];
                        const empties = list.filter((cert) => {
                            if (!cert) return true;
                            const filled =
                                [
                                    cert.title,
                                    cert.issuer,
                                    cert.code,
                                    cert.fileUrl,
                                    cert.fileName,
                                    cert.notes,
                                    cert.issuedOn,
                                    cert.expiresOn,
                                ].some(Boolean) ||
                                (Array.isArray(cert.tags) && cert.tags.length > 0);
                            return !filled;
                        });
                        return empties.length === 0;
                    },
                }),
            ],
        }),
        [initialEmailNormalized, normalizedExistingEmails]
    );

    const [mode, setMode] = useState('single');
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(() => ({ ...baselineForm }));
    const { errors, validateFields, validateAll, setFieldError, resetErrors } = useFormValidator(validationSchema, {
        validateOnChange: false,
        validateOnBlur: true,
    });
    const [dirty, setDirty] = useState(false);
    const escBoundRef = useRef(false);

    const [coursesOptions, setCoursesOptions] = useState([]);
    const [programsOptions, setProgramsOptions] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [facultyOptions, setFacultyOptions] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [roomsOptions, setRoomsOptions] = useState([]);
    const [scheduleEvents, setScheduleEvents] = useState([]);
    const [loadingScheduleEvents, setLoadingScheduleEvents] = useState(false);
    const [linkedScheduleIds, setLinkedScheduleIds] = useState([]);
    const [autoMetrics, setAutoMetrics] = useState({ years: true, status: true });
    const [stepValidCache, setStepValidCache] = useState({});

    const [rawJson, setRawJson] = useState('');
    const [parsed, setParsed] = useState([]);
    const [parseError, setParseError] = useState('');
    const [importStrategy, setImportStrategy] = useState('skip');

    const [defaultDept, setDefaultDept] = useState('');
    const [defaultType, setDefaultType] = useState(TYPES[0] || 'full-time');
    const [defaultStatus, setDefaultStatus] = useState(STATUSES[0] || 'active');
    const [defaultSubjects, setDefaultSubjects] = useState([]);

    const [preferRowDept, setPreferRowDept] = useState(true);
    const [autoGenerateEmpId, setAutoGenerateEmpId] = useState(true);
    const [autoFillNameFromEmail, setAutoFillNameFromEmail] = useState(true);
    const fileRef = useRef(null);

    const [hasDraft, setHasDraft] = useState(false);
    const draftSaveTimerRef = useRef(null);

    const { notify } = useToasts();
    const toastLockRef = useRef(0);
    const guardedNotify = useCallback((type, message, opts = {}, lockMs = 2600) => {
        const now = Date.now();
        if (now - toastLockRef.current < lockMs) return;
        toastLockRef.current = now;
        notify(type, message, opts);
    }, [notify]);

    const loadScheduleEvents = useCallback(async () => {
        setLoadingScheduleEvents(true);
        try {
            const events = await fetchScheduleEvents();
            setScheduleEvents(Array.isArray(events) ? events : []);
        } catch {
            setScheduleEvents([]);
        } finally {
            setLoadingScheduleEvents(false);
        }
    }, []);

    // Draft management functions
    const loadDraft = useCallback(() => {
        try {
            const raw = localStorage.getItem(FACULTY_DRAFT_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.updatedAt) {
                return parsed;
            }
        } catch {
            // Invalid draft, ignore
        }
        return null;
    }, []);

    const saveDraft = useCallback((formData, stepNum) => {
        try {
            const draft = {
                form: formData,
                step: stepNum,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(FACULTY_DRAFT_KEY, JSON.stringify(draft));
            setHasDraft(true);
        } catch {
            // localStorage full or unavailable
        }
    }, []);

    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(FACULTY_DRAFT_KEY);
        } catch {
            // Ignore
        }
        setHasDraft(false);
    }, []);

    const handleSaveDraft = useCallback(() => {
        saveDraft(form, step);
        guardedNotify('success', 'Draft saved', { title: 'Faculty draft' });
    }, [form, step, saveDraft, guardedNotify]);

    const handleRestoreDraft = useCallback((draft) => {
        if (!draft?.form) return;
        setForm({ ...pristine, ...draft.form });
        if (draft.step && draft.step >= 1 && draft.step <= STEPS.length) {
            setStep(draft.step);
        }
        setDirty(true);
        guardedNotify('info', 'Draft restored', { title: 'Faculty draft' });
    }, [pristine, guardedNotify]);

    const handleDiscardDraft = useCallback(() => {
        clearDraft();
        guardedNotify('info', 'Draft discarded', { title: 'Faculty draft' });
    }, [clearDraft, guardedNotify]);

    // Auto-save draft on form changes (debounced)
    useEffect(() => {
        if (!isOpen || mode !== 'single') return;
        if (!dirty) return;
        
        if (draftSaveTimerRef.current) {
            clearTimeout(draftSaveTimerRef.current);
        }
        draftSaveTimerRef.current = setTimeout(() => {
            saveDraft(form, step);
        }, 2000); // Auto-save after 2 seconds of inactivity
        
        return () => {
            if (draftSaveTimerRef.current) {
                clearTimeout(draftSaveTimerRef.current);
            }
        };
    }, [isOpen, mode, dirty, form, step, saveDraft]);

    useEffect(() => {
        if (!isOpen) return;

        // Load courses for subjects dropdown
        fetchCourses().then((courses) => {
            const options = courses
                .sort((a, b) => {
                    // Sort by program first, then by code
                    const programCompare = (a.program || '').localeCompare(b.program || '');
                    if (programCompare !== 0) return programCompare;
                    return (a.code || '').localeCompare(b.code || '');
                })
                .map((c) => ({
                    value: c.code,
                    label: `${c.code} - ${c.nameEn || c.nameSk || c.code}`,
                    faculty: c.faculty,
                    program: c.program,
                }));
            setCoursesOptions(options);
        }).catch(() => {
            setCoursesOptions([]);
        });

        // Load departments, faculty options, programs and rooms from API
        Promise.all([
            fetchDepartments(),
            fetchFacultyOptions(),
            fetchPrograms(),
            fetchRooms({ active: true })
        ]).then(([depts, faculties, progs, rooms]) => {
            setDepartments(depts || []);
            setFacultyOptions(faculties || []);
            setPrograms(progs || []);
            // Map rooms to select options
            const roomOpts = (rooms || []).map(r => ({
                value: r.name || r.id,
                label: r.name + (r.building ? ` (${r.building})` : '') + (r.type ? ` - ${r.type}` : '')
            }));
            setRoomsOptions(roomOpts);
        }).catch(() => {
            setDepartments([]);
            setFacultyOptions([]);
            setPrograms([]);
            setRoomsOptions([]);
        });

        // Check for existing draft (only for new faculty, not when editing)
        const existingDraft = !initialValue ? loadDraft() : null;
        const hasValidDraft = !!existingDraft?.updatedAt;
        setHasDraft(hasValidDraft);

        const base = { ...baselineForm };
        if (!base.firstName && !base.lastName && base.name) {
            const { firstName, lastName } = splitName(base.name);
            base.firstName = firstName;
            base.lastName = lastName;
        }
        base.titlesPrefix = Array.isArray(base.titlesPrefix) ? uniq(base.titlesPrefix) : [];
        base.titlesSuffix = Array.isArray(base.titlesSuffix) ? uniq(base.titlesSuffix) : [];
        base.subjects = uniq(base.subjects);
        base.availability = uniq(base.availability?.length ? base.availability : DAYS);
        base.timeWindows = base.timeWindows || {};
        base.employmentType = base.employmentType || 'full-time';
        base.status = base.status || 'active';
        base.classesCount = clamp(base.classesCount ?? 4, 0, 20);
        base.yearsExperience = clamp(base.yearsExperience ?? 0, 0, 50);
        base.rating = clamp(base.rating ?? 0, 0, 5);

        setMode('single');
        setStep(1);
        // If there's a draft and no initialValue (new faculty), show option to restore
        // For now, auto-restore draft if it exists
        if (hasValidDraft && existingDraft?.form) {
            setForm({ ...base, ...existingDraft.form });
            if (existingDraft.step >= 1 && existingDraft.step <= STEPS.length) {
                setStep(existingDraft.step);
            }
            setDirty(true);
        } else {
            setForm(base);
            setDirty(false);
        }
        resetErrors();
        setStepValidCache({});

        setRawJson('');
        setParsed([]);
        setParseError('');
        setImportStrategy('skip');
        setDefaultDept('');
        setDefaultType(TYPES[0] || 'full-time');
        setDefaultStatus(STATUSES[0] || 'active');
        setDefaultSubjects([]);
        setPreferRowDept(true);
        setAutoGenerateEmpId(true);
        setAutoFillNameFromEmail(true);
        setAutoMetrics({ years: true, status: true });
        setLinkedScheduleIds([]);
        loadScheduleEvents();
    }, [baselineForm, isOpen, resetErrors, loadScheduleEvents, initialValue, loadDraft]);

    useEffect(() => {
        if (!isOpen || escBoundRef.current) return;
        const onEsc = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
            }
        };
        window.addEventListener('keydown', onEsc);
        escBoundRef.current = true;
        return () => {
            window.removeEventListener('keydown', onEsc);
            escBoundRef.current = false;
        };
    }, [isOpen]);

    const validateScheduleDetails = useCallback(
        (values) => {
            let ok = true;
            const availability = Array.isArray(values?.availability) ? values.availability : [];
            const windows = values?.timeWindows || {};
            const activeKeys = new Set();

            availability.forEach((day) => {
                const tw = windows?.[day] || {};
                const from = tw?.from || '';
                const to = tw?.to || '';
                const key = `time_${day}`;
                activeKeys.add(key);
                if ((from && !to) || (!from && to)) {
                    setFieldError(key, 'Set both start and end times or clear both');
                    ok = false;
                } else if (from && to && from >= to) {
                    setFieldError(key, 'End time must be after start time');
                    ok = false;
                } else {
                    setFieldError(key, null);
                }
            });

            Object.keys(errors)
                .filter((key) => key.startsWith('time_') && !activeKeys.has(key))
                .forEach((key) => setFieldError(key, null));

            return ok;
        },
        [errors, setFieldError]
    );

    const validateCertificationDetails = useCallback(
        (values) => {
            let ok = true;
            const list = Array.isArray(values?.certifications) ? values.certifications : [];
            const activeKeys = new Set();

            list.forEach((cert, idx) => {
                const key = `cert_${idx}`;
                activeKeys.add(key);
                if (cert?.issuedOn && cert?.expiresOn && new Date(cert.issuedOn) > new Date(cert.expiresOn)) {
                    setFieldError(key, 'Issued date must be before expiry');
                    ok = false;
                } else {
                    setFieldError(key, null);
                }
            });

            Object.keys(errors)
                .filter((key) => key.startsWith('cert_') && !activeKeys.has(key))
                .forEach((key) => setFieldError(key, null));

            return ok;
        },
        [errors, setFieldError]
    );

    const set = useCallback((k, v) => {
        let snapshot = null;
        setForm((prev) => {
            const nextValue = typeof v === 'function' ? v(prev[k], prev) : v;
            const next = { ...prev, [k]: nextValue };
            snapshot = next;
            setDirty(!deepEqual(next, baselineForm));
            return next;
        });
        if (!snapshot) return;

        const impactedSteps = Object.entries(STEP_FIELDS)
            .filter(([, fields]) => fields.includes(k))
            .map(([id]) => Number(id));

        if (k === 'timeWindows') {
            impactedSteps.push(4);
        }

        if (impactedSteps.length) {
            setStepValidCache((prev) => {
                const next = { ...prev };
                impactedSteps.forEach((id) => {
                    delete next[id];
                });
                return next;
            });
        }

        if (Object.prototype.hasOwnProperty.call(validationSchema, k)) {
            if (errors?.[k]) {
                validateFields([k], snapshot);
            }
        }

        if (k === 'availability' || k === 'timeWindows') {
            validateFields(['availability'], snapshot);
            validateScheduleDetails(snapshot);
        }

        if (k === 'certifications') {
            validateFields(['certifications'], snapshot);
            validateCertificationDetails(snapshot);
        }
    }, [baselineForm, errors, setDirty, setForm, setStepValidCache, validateCertificationDetails, validateFields, validateScheduleDetails, validationSchema]);

    const stopAutoMetric = useCallback((key) => {
        setAutoMetrics((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
    }, [setAutoMetrics]);

    useEffect(() => {
        const derived = clamp(form.subjects?.length || 0, 0, 20);
        if (derived !== form.classesCount) {
            set('classesCount', derived);
        }
    }, [form.subjects, form.classesCount, set]);

    useEffect(() => {
        if (!autoMetrics.years) return;
        if (!form.hireDate) {
            if (form.yearsExperience !== 0) {
                set('yearsExperience', 0);
            }
            return;
        }
        const hireTs = Date.parse(form.hireDate);
        if (Number.isNaN(hireTs) || hireTs > Date.now()) {
            if (form.yearsExperience !== 0) set('yearsExperience', 0);
            return;
        }
        const diffYears = Math.floor((Date.now() - hireTs) / (365.25 * 24 * 60 * 60 * 1000));
        const derived = clamp(diffYears, 0, 50);
        if (derived !== form.yearsExperience) {
            set('yearsExperience', derived);
        }
    }, [autoMetrics.years, form.hireDate, form.yearsExperience, set]);

    useEffect(() => {
        if (!autoMetrics.status) return;
        const derived = form.classesCount > 0 ? 'active' : 'on-leave';
        if (derived !== form.status) {
            set('status', derived);
        }
    }, [autoMetrics.status, form.classesCount, form.status, set]);

    const handleFieldBlur = useCallback(
        (field) => () => {
            validateFields([field], form);
        },
        [form, validateFields]
    );

    const toggleFromSuggestions = (kind, token) => {
        const normed = kind === 'prefix' ? normPrefix(token) : normSuffix(token);
        const key = kind === 'prefix' ? 'titlesPrefix' : 'titlesSuffix';
        const setNow = new Set(form[key] || []);
        if (setNow.has(normed)) setNow.delete(normed);
        else setNow.add(normed);
        set(key, Array.from(setNow));
    };
    const addCustomTitle = (kind, raw) => {
        const normed = kind === 'prefix' ? normPrefix(raw) : normSuffix(raw);
        if (!normed) return;
        const key = kind === 'prefix' ? 'titlesPrefix' : 'titlesSuffix';
        set(key, uniq([...(form[key] || []), normed]));
    };
    const removeTitle = (kind, val) => {
        const key = kind === 'prefix' ? 'titlesPrefix' : 'titlesSuffix';
        set(key, (form[key] || []).filter((x) => x !== val));
    };

    const toggleDay = (d) => {
        const setDays = new Set(form.availability || []);
        if (setDays.has(d)) {
            setDays.delete(d);
            const tw = { ...(form.timeWindows || {}) };
            delete tw[d];
            set('timeWindows', tw);
        } else setDays.add(d);
        set('availability', Array.from(setDays));
    };
    const setTime = (day, which, value) => {
        const tw = { ...(form.timeWindows || {}) };
        tw[day] = { ...(tw[day] || {}), [which]: value };
        set('timeWindows', tw);
    };
    const validateStep = useCallback(
        (stepId, values) => {
            const currentValues = values || form;
            const fields = STEP_FIELDS[stepId] || [];
            let ok = true;

            if (fields.length) {
                ok = validateFields(fields, currentValues) && ok;
            }

            if (stepId === 4) {
                ok = validateScheduleDetails(currentValues) && ok;
                ok = validateCertificationDetails(currentValues) && ok;
            }

            setStepValidCache((prev) => ({ ...prev, [stepId]: ok }));
            return ok;
        },
        [form, validateCertificationDetails, validateFields, validateScheduleDetails]
    );

    const canProceed = useCallback((sid) => stepValidCache[sid] === true, [stepValidCache]);

    const goNext = () => {
        if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length));
    };
    const goPrev = () => setStep((s) => Math.max(1, s - 1));
    const jumpTo = (sid) => {
        if (sid < step || validateStep(step)) setStep(sid);
    };

    const handleClose = () => {
        if (dirty) {
            guardedNotify('info', 'Changes discarded', { title: 'Closed without saving' });
        }
        onClose?.();
    };

    const handleYearsExperienceChange = (e) => {
        stopAutoMetric('years');
        set('yearsExperience', clamp(e.target.value, 0, 50));
    };

    const handleStatusChange = (value) => {
        stopAutoMetric('status');
        set('status', value);
    };

    const fillSubjectsFromDept = () => {
        if (!form.department) {
            guardedNotify('info', 'Please select a department first');
            return;
        }
        
        // Use filtered courses (already filtered by program if selected)
        const coursesToSearch = form.program ? filteredCoursesOptions : coursesOptions;
        
        // Get the selected department (options use department code)
        const selectedDept = departments.find((d) => d.code === form.department || d.id === form.department);
        if (!selectedDept) {
            guardedNotify('info', 'Department not found');
            return;
        }
        
        // Get courses that match the department's faculty
        const matchingCourses = coursesToSearch
            .filter(opt => {
                if (opt.faculty && selectedDept.faculty) {
                    return opt.faculty.toUpperCase().includes(selectedDept.faculty.toUpperCase());
                }
                return false;
            })
            .map(opt => opt.value);
        
        if (matchingCourses.length === 0) {
            const hint = form.program 
                ? `No courses found for ${selectedDept.name} in program "${form.program}". Try a different program.`
                : `No courses found for ${selectedDept.name}. Try selecting a program first.`;
            guardedNotify('info', hint);
            return;
        }
        
        const programHint = form.program ? ` (${form.program})` : '';
        set('subjects', uniq([...(form.subjects || []), ...matchingCourses]));
        guardedNotify('success', `Added ${matchingCourses.length} course(s)${programHint}`);
    };

    const avatarFor = (name = '') => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}&radius=50`;

    // Filter courses by selected program
    const filteredCoursesOptions = useMemo(() => {
        if (!form.program) return coursesOptions;
        // Find the selected program to get its name (courses use program name, not code)
        const selectedProgram = programs.find(p => p.code === form.program);
        const programName = selectedProgram?.name || form.program;
        return coursesOptions
            .filter((opt) => {
                if (!opt.program) return false;
                const optProgram = opt.program.toLowerCase();
                // Match by program name (primary) or code (fallback)
                return optProgram.includes(programName.toLowerCase()) || 
                       optProgram.includes(form.program.toLowerCase());
            })
            .map((opt) => ({
                value: opt.value,
                label: opt.label,
                faculty: opt.faculty,
                program: opt.program,
            }));
    }, [coursesOptions, form.program, programs]);

    // Get selected program name for display
    const selectedProgramName = useMemo(() => {
        if (!form.program) return '';
        const prog = programs.find(p => p.code === form.program);
        return prog?.name || form.program;
    }, [form.program, programs]);

    // Filter departments by selected faculty
    const filteredDepartments = useMemo(() => {
        if (!form.faculty) return [];
        return departments.filter(d => d.faculty === form.faculty && d.active);
    }, [departments, form.faculty]);

    // Filter programs by selected faculty and department
    const filteredPrograms = useMemo(() => {
        if (!form.faculty) return [];
        
        // Find the selected department object to get its ID
        const selectedDept = form.department 
            ? departments.find(d => d.code === form.department || d.id === form.department)
            : null;
        
        return programs.filter(p => {
            if (p.faculty !== form.faculty) return false;
            if (!p.active) return false;
            // If department is selected, filter by department ID
            if (selectedDept && p.departmentId) {
                // Compare departmentId with department's actual ID (not code)
                if (p.departmentId !== selectedDept.id && p.departmentId !== selectedDept.code) {
                    return false;
                }
            }
            return true;
        });
    }, [programs, form.faculty, form.department, departments]);

    const handleFacultyChange = useCallback((value) => {
        const nextFaculty = asString(value);
        set('faculty', nextFaculty);
        set('department', '');
        set('program', '');
    }, [set]);

    const handleDepartmentChange = useCallback((value) => {
        const nextDept = asString(value);
        set('department', nextDept);
        set('program', '');
    }, [set]);

    const matchingScheduleOptions = useMemo(() => {
        if (!Array.isArray(scheduleEvents) || scheduleEvents.length === 0) return [];
        const codes = new Set((form.subjects || []).map((code) => String(code || '').trim().toUpperCase()).filter(Boolean));
        if (codes.size === 0) return [];
        return scheduleEvents
            .filter((event) => codes.has(String(event?.courseCode || '').trim().toUpperCase()))
            .map((event) => {
                const pieces = [
                    event?.courseCode || '—',
                    `${event?.day || ''} ${event?.slot || ''}`.trim(),
                    event?.room ? `Room ${event.room}` : null,
                    event?.teacherEmail ? `Currently ${event.teacherEmail}` : 'Unassigned'
                ].filter(Boolean);
                return {
                    value: event?.id,
                    label: pieces.join(' • '),
                    meta: event,
                };
            })
            .filter((opt) => Boolean(opt.value));
    }, [scheduleEvents, form.subjects]);

    useEffect(() => {
        setLinkedScheduleIds((prev) => prev.filter((id) => matchingScheduleOptions.some((opt) => opt.value === id)));
    }, [matchingScheduleOptions]);

    const displayNamePreview = useMemo(
        () =>
            formatDisplayName({
                titlesPrefix: form.titlesPrefix || [],
                givenName: form.firstName || '',
                familyName: form.lastName || '',
                titlesSuffix: form.titlesSuffix || [],
            }),
        [form.titlesPrefix, form.firstName, form.lastName, form.titlesSuffix]
    );

    const submit = () => {
        const results = STEPS.map((s) => ({ id: s.id, valid: validateStep(s.id) }));
        const schemaValid = validateAll(form);
        const scheduleValid = validateScheduleDetails(form);
        const certValid = validateCertificationDetails(form);
        const allGood = results.every((r) => r.valid) && schemaValid && scheduleValid && certValid;

        if (!allGood) {
            const firstBad = results.find((r) => !r.valid)?.id ?? 1;
            setStep(firstBad);
            return;
        }

        const baseName = `${form.firstName?.trim()} ${form.lastName?.trim()}`.trim();
        const normalizedEmail = form.email.trim().toLowerCase();
        let finalEmpId = ensureEmployeeId({
            email: normalizedEmail,
            fullName: baseName,
        });
        let saltAttempt = 1;
        while (existingEmployeeIds.includes(finalEmpId) && saltAttempt < 10) {
            finalEmpId = ensureEmployeeId({ email: normalizedEmail, fullName: baseName, salt: `alt${saltAttempt}` });
            saltAttempt += 1;
        }

        const displayName = formatDisplayName({
            titlesPrefix: form.titlesPrefix || [],
            givenName: form.firstName?.trim(),
            familyName: form.lastName?.trim(),
            titlesSuffix: form.titlesSuffix || [],
        });

        const payload = {
            id: maisId('fac', `${baseName}|${normalizedEmail}`),
            name: baseName,
            fullName: baseName,
            displayName,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            givenName: form.firstName.trim(),
            familyName: form.lastName.trim(),
            titlesPrefix: uniq((form.titlesPrefix || []).map(normPrefix)),
            titlesSuffix: uniq((form.titlesSuffix || []).map(normSuffix)),
            employeeId: finalEmpId,
            email: normalizedEmail,
            phone: (form.phone || '').trim(),
            faculty: (form.faculty || 'FEI').trim(),
            department: (form.department || '').trim(),
            program: (form.program || '').trim(),
            subjects: uniq(form.subjects),
            employmentType: form.employmentType,
            status: form.status,
            classesCount: clamp(form.classesCount, 0, 20),
            yearsExperience: clamp(form.yearsExperience, 0, 50),
            hireDate: form.hireDate || '',
            office: (form.office || '').trim(),
            certifications: (form.certifications || []).map((c) => ({ ...c })),
            availability: uniq(form.availability),
            timeWindows: form.timeWindows || {},
            officeHours: form.officeHours || {},
            workingHours: form.workingHours || {},
            rating: clamp(form.rating, 0, 5),
            lastActivity: new Date().toISOString(),
            avatarUrl: form.avatarUrl || avatarFor(displayName || baseName),
            about: (form.about || '').trim(),
        };

        onSave?.(payload, { linkedScheduleIds });
        // Clear draft after successful save
        clearDraft();
        setTimeout(() => {
            notify('success', `${payload.displayName || payload.email} saved`, { title: 'Faculty saved' });
        }, 300);
        setMode('single');
        setStep(1);
        setForm(() => ({ ...pristine }));
        resetErrors();
        setStepValidCache({});
        setDirty(false);
        setLinkedScheduleIds([]);
        onClose?.();
    };

    const lc = (s) => String(s || '').toLowerCase().trim();
    const toArray = (v) => Array.isArray(v) ? v : String(v || '').split(/[;,|]/).map((s) => s.trim()).filter(Boolean);

    const keyAliases = {
        firstName: ['firstname', 'first_name', 'givenname', 'given_name', 'fname', 'first'],
        lastName: ['lastname', 'last_name', 'surname', 'familyname', 'family_name', 'lname', 'last'],
        name: ['fullname', 'full_name', 'displayname', 'display_name', 'name'],
        titlesPrefix: ['prefix', 'academic_prefix', 'titles_prefix'],
        titlesSuffix: ['suffix', 'academic_suffix', 'titles_suffix'],
        email: ['email', 'emailaddress', 'email_address', 'mail'],
        phone: ['phone', 'phonenumber', 'phone_number', 'mobile', 'mobilephone', 'tel', 'telephone'],
        employeeId: ['employeeid', 'employee_id', 'eid', 'code', 'staff_code'],
        department: ['department', 'dept', 'katedra'],
        faculty: ['faculty', 'faculty_name', 'school'],
        subjects: ['subjects', 'courses', 'teaches'],
        employmentType: ['employmenttype', 'employment_type', 'type', 'contract'],
        status: ['status', 'state'],
        classesCount: ['classescount', 'classes_count', 'load', 'teachingload'],
        yearsExperience: ['yearsexperience', 'years_experience', 'experience', 'exp'],
        hireDate: ['hiredate', 'hire_date', 'startdate', 'start_date', 'joined'],
        office: ['office', 'room', 'kabinet'],
        rating: ['rating', 'stars'],
        availability: ['availability', 'available_days', 'days'],
        timeWindows: ['timewindows', 'time_windows', 'office_hours'],
        avatarUrl: ['avatar', 'avatarurl', 'photo', 'photo_url'],
        about: ['about', 'bio', 'biography', 'description', 'info'],
    };

    const aliasToCanonical = (key) => {
        const l = lc(key);
        for (const can in keyAliases) {
            if (l === can) return can;
            if (keyAliases[can].includes(l)) return can;
        }
        return '';
    };

    const pick = (obj, paths = []) => {
        for (const p of paths) {
            const v = obj?.[p];
            if (v != null && v !== '') return v;
        }
        return undefined;
    };

    const explodeContainerLike = (obj) => {
        if (Array.isArray(obj)) return obj;
        if (obj && typeof obj === 'object') {
            for (const k of ['faculty', 'teachers', 'data', 'items', 'rows', 'list', 'result', 'payload']) {
                if (Array.isArray(obj[k])) return obj[k];
            }
        }
        return [];
    };

    const normalizeRow = (row) => {
        if (!row || typeof row !== 'object') return { error: 'Row is not an object' };

        const flat = {};
        Object.keys(row).forEach((k) => {
            const v = row[k];
            const c = aliasToCanonical(k) || k;
            if (typeof v === 'object' && v && !Array.isArray(v)) {
                Object.keys(v).forEach((kk) => {
                    const cc = aliasToCanonical(kk) || kk;
                    if (flat[cc] == null) flat[cc] = v[kk];
                });
            } else {
                if (flat[c] == null) flat[c] = v;
            }
        });

        let firstName = String(pick(flat, ['firstName']) ?? '').trim();
        let lastName = String(pick(flat, ['lastName']) ?? '').trim();
        const nameFromField = String(pick(flat, ['name']) ?? '').trim();
        if ((!firstName || !lastName) && nameFromField) {
            const s = splitName(nameFromField);
            if (!firstName) firstName = s.firstName;
            if (!lastName) lastName = s.lastName;
        }
        const email = String(pick(flat, ['email']) ?? '').trim().toLowerCase();
        if ((!firstName || !lastName) && autoFillNameFromEmail && email) {
            const base = email.split('@')[0] || '';
            const cleaned = base.replace(/[._-]+/g, ' ').trim();
            const s = splitName(cleaned);
            if (!firstName) firstName = s.firstName ? s.firstName[0].toUpperCase() + s.firstName.slice(1) : '';
            if (!lastName) lastName = s.lastName ? s.lastName[0].toUpperCase() + s.lastName.slice(1) : '';
        }

        const titlesPrefix = toArray(pick(flat, ['titlesPrefix']) || []).map(normPrefix);
        const titlesSuffix = toArray(pick(flat, ['titlesSuffix']) || []).map(normSuffix);

        let department = String(pick(flat, ['department', 'dept']) ?? '').trim();
        if (!department || !preferRowDept) department = defaultDept || department;

        let employmentType = lc(pick(flat, ['employmentType', 'type']) ?? '') || defaultType;
        if (!TYPES.includes(employmentType)) employmentType = defaultType;

        let status = lc(pick(flat, ['status', 'state']) ?? '') || defaultStatus;
        if (!STATUSES.includes(status)) status = defaultStatus;

        const subjects = uniq([...(toArray(pick(flat, ['subjects']) || [])), ...defaultSubjects]);

        const classesCount = clamp(pick(flat, ['classesCount', 'load']) ?? 0, 0, 20);
        const yearsExperience = clamp(pick(flat, ['yearsExperience', 'experience']) ?? 0, 0, 50);
        const hireDate = String(pick(flat, ['hireDate', 'joined']) || '').slice(0, 10);
        const office = String(pick(flat, ['office', 'room']) || '').trim();
        const phone = String(pick(flat, ['phone']) || '').trim();
        const rating = clamp(Number(pick(flat, ['rating']) || 0), 0, 5);

        const availRaw = pick(flat, ['availability']) ?? [];
        const availability = uniq(toArray(availRaw).map((d) => d.slice(0, 3)).filter((d) => DAYS.includes(d)));
        const timeWindows = pick(flat, ['timeWindows']) || {};

        const about = String(pick(flat, ['about']) ?? '').trim();

        let employeeId = String(pick(flat, ['employeeId']) || '').trim().toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim() || nameFromField || (email ? email.split('@')[0] : '').trim();
        if ((!employeeId || !isEmployeeId(employeeId)) && autoGenerateEmpId) {
            employeeId = ensureEmployeeId({ email, fullName, preferred: employeeId });
        }

        const avatarUrl = String(pick(flat, ['avatarUrl']) || '').trim();

        const missing = [];
        if (!email) missing.push('email');
        if (!fullName) missing.push('name');
        if (missing.length) return { error: `Missing ${missing.join(', ')}` };

        if (!notFutureDate(hireDate)) return { error: 'Hire date cannot be in the future' };
        if (normalizedExistingEmails.includes(email.toLowerCase())) return { error: 'Duplicate email' };
        if (employeeId && existingEmployeeIds.includes(employeeId)) return { error: 'Duplicate employeeId' };

        const displayName = formatDisplayName({
            titlesPrefix,
            givenName: firstName,
            familyName: lastName,
            titlesSuffix,
        });

        return {
            id: maisId('fac', `${fullName}|${email}`),
            name: fullName,
            fullName: displayName || fullName,
            displayName: displayName || fullName,
            firstName,
            lastName,
            titlesPrefix,
            titlesSuffix,
            employeeId,
            email,
            phone,
            department,
            subjects,
            employmentType,
            status,
            classesCount,
            yearsExperience,
            hireDate,
            office,
            certifications: [],
            availability: availability.length ? availability : DAYS,
            timeWindows,
            rating,
            lastActivity: new Date().toISOString(),
            avatarUrl: avatarUrl || '',
            about: about || '',
        };
    };

    const tryParseText = (text) => {
        const parsers = [];
        parsers.push(() => {
            const obj = JSON.parse(text);
            if (Array.isArray(obj)) return obj;
            const arr = explodeContainerLike(obj);
            if (arr.length) return arr;
            return [obj];
        });
        parsers.push(() => {
            const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            const arr = [];
            for (const line of lines) {
                try {
                    const o = JSON.parse(line);
                    arr.push(o);
                } catch {
                    return null;
                }
            }
            return arr && arr.length ? arr : null;
        });
        for (const fn of parsers) {
            try {
                const r = fn();
                if (r && Array.isArray(r)) return r;
            } catch {}
        }
        return null;
    };

    useEffect(() => {
        if (!isOpen || mode !== 'import') return;
        if (!rawJson.trim()) {
            setParsed([]);
            setParseError('');
            return;
        }
        const base = tryParseText(rawJson);
        if (!base) {
            setParsed([]);
            setParseError('Unable to parse JSON or NDJSON');
            return;
        }
        const rows = base.map((row, idx) => {
            const normalized = normalizeRow(row);
            if (normalized && !normalized.error) {
                return { index: idx, selected: true, error: '', data: normalized, raw: row };
            }
            return { index: idx, selected: false, error: normalized?.error || 'Invalid row', data: null, raw: row };
        });
        setParsed(rows);
        setParseError('');
    }, [rawJson, mode, isOpen, existingEmails, existingEmployeeIds, defaultDept, defaultType, defaultStatus, defaultSubjects, preferRowDept, autoGenerateEmpId, autoFillNameFromEmail]);

    const validRows = useMemo(() => parsed.filter((r) => r.data && !r.error), [parsed]);
    const validCount = useMemo(() => validRows.length, [validRows]);
    const invalidCount = useMemo(() => parsed.filter((r) => !r.data || r.error).length, [parsed]);
    const allValidSelected = useMemo(() => validRows.length > 0 && validRows.every((r) => r.selected), [validRows]);
    const someValidSelected = useMemo(() => validRows.some((r) => r.selected) && !allValidSelected, [validRows, allValidSelected]);

    const toggleSelectAll = (checked) => setParsed((prev) => prev.map((r) => (r.data && !r.error ? { ...r, selected: checked } : r)));

    const doImport = () => {
        const chosen = parsed.filter((r) => r.selected && r.data && !r.error).map((r) => r.data);
        if (!chosen.length) {
            guardedNotify('faculty-import-empty', 'warning', 'No valid rows selected', { title: 'Import' });
            return;
        }
        if (onImport) {
            onImport(chosen, importStrategy);
            setTimeout(() => {
                guardedNotify('faculty-import-success', 'success', `Imported ${chosen.length} faculty member${chosen.length > 1 ? 's' : ''}`, { title: 'Import successful' });
            }, 300);
            onClose?.();
            return;
        }
        chosen.forEach((item, i) => {
            onSave?.(item, { keepOpen: i < chosen.length - 1 });
        });
        setTimeout(() => {
            guardedNotify('faculty-import-success', 'success', `Imported ${chosen.length} faculty member${chosen.length > 1 ? 's' : ''}`, { title: 'Import successful' });
        }, 300);
        onClose?.();
    };

    const ImportRowCard = ({ r, idx }) => {
        const ok = r.data && !r.error;
        return (
            <div className="rounded-md border border-border bg-card p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2">
          <span data-stop-row="1">
            <Checkbox
                checked={!!r.selected && ok}
                onChange={(e) => {
                    const checked = !!e?.target?.checked;
                    setParsed((prev) => prev.map((row, i) => (i === idx ? { ...row, selected: checked } : row)));
                }}
                disabled={!ok}
                aria-label="Select row"
            />
          </span>
                    <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{ok ? r.data.fullName || r.data.name : '—'}</div>
                        <div className={`text-xs ${ok ? 'text-muted-foreground' : 'text-red-600'}`}>
                            {ok ? 'Valid' : r.error}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-0.5">
                        <div className="text-muted-foreground">Email</div>
                        <div className="truncate">{ok ? r.data.email || '—' : '—'}</div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-muted-foreground">Employee ID</div>
                        <div className="truncate">{ok ? r.data.employeeId || '—' : '—'}</div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-muted-foreground">Dept.</div>
                        <div className="truncate">{ok ? r.data.department || '—' : '—'}</div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-muted-foreground">Subjects</div>
                        <div className="truncate">{ok ? (r.data.subjects || []).slice(0, 3).join(', ') || '—' : '—'}</div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-muted-foreground">Status</div>
                        <div className="truncate">{ok ? (r.data.status || 'active') : '—'}</div>
                    </div>
                    <div className="col-span-2">
            <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] ${
                    ok ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30' : 'bg-red-500/10 text-red-700 border border-red-500/30'
                }`}
            >
              {ok ? 'Valid' : 'Invalid'}
            </span>
                    </div>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

    return (
        <div className="fixed inset-0 z-[110] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-6 pb-24 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-background/80 backdrop-blur-sm" onClick={handleClose} />
                <div className="inline-block w-full max-w-[100vw] sm:max-w-5xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-b border-border sticky top-0 z-20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">Add Faculty Member</h3>
                        <div className="flex items-center justify-between gap-2">
                            <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40 w-full sm:w-auto" role="tablist" aria-label="Mode">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={mode === 'single' ? 'true' : 'false'}
                                    className={`px-3 py-1.5 text-sm rounded w-full sm:w-auto ${mode === 'single' ? 'bg-card shadow-inner text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => setMode('single')}
                                    title="Single entry"
                                >
                                    Single
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={mode === 'import' ? 'true' : 'false'}
                                    className={`px-3 py-1.5 text-sm rounded w-full sm:w-auto ${mode === 'import' ? 'bg-card shadow-inner text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => setMode('import')}
                                    title="Import JSON"
                                >
                                    Import JSON
                                </button>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close" className="shrink-0">
                                <Icon name="X" size={22} />
                            </Button>
                        </div>
                    </div>

                    {mode === 'single' ? (
                        <>
                            <div className="px-4 sm:px-5 md:px-6 pt-3 pb-2 border-b border-border sticky top-[52px] sm:top-[64px] md:top-[72px] z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                                <div className="relative -mx-4 sm:mx-0">
                                    <div className="overflow-x-auto px-4 sm:px-0" role="tablist" aria-label="Add faculty steps">
                                        <div className="flex flex-nowrap sm:flex-wrap items-stretch gap-2.5 sm:gap-3 md:gap-4 min-w-max sm:min-w-0">
                                            {STEPS.map((s, i) => {
                                                const active = step === s.id;
                                                const done = step > s.id;
                                                const clickable = s.id <= step || canProceed(step);
                                                return (
                                                    <div key={s.id} className="flex-none sm:flex-1 min-w-[160px] sm:min-w-0 flex items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => clickable && jumpTo(s.id)}
                                                            disabled={!clickable}
                                                            className={`group w-full inline-flex items-center justify-center gap-2.5 md:gap-3 py-2 sm:py-2.5 md:py-3 ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'} ${!clickable ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                            title={s.title}
                                                            aria-current={active ? 'step' : undefined}
                                                        >
                              <span className={`flex-shrink-0 w-8 h-8 rounded-full grid place-items-center border ${done || active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}>
                                {done ? <Icon name="Check" size={16} /> : <Icon name={s.icon} size={16} />}
                              </span>
                                                            <span className="truncate text-sm md:text-base font-medium min-w-0">
                                <span className="sm:hidden">{s.short}</span>
                                <span className="hidden sm:inline">{s.title}</span>
                              </span>
                                                        </button>
                                                        {i < STEPS.length - 1 && <div className="hidden md:block h-px bg-border w-10 mx-1 flex-shrink-0" aria-hidden="true" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="pointer-events-none sm:hidden absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-card to-transparent" />
                                    <div className="pointer-events-none sm:hidden absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-card to-transparent" />
                                </div>
                                <div className="h-1 md:h-1.5 bg-muted mt-3 rounded">
                                    <div className="h-full bg-primary rounded transition-all" style={{ width: `${progressPct}%` }} />
                                </div>
                            </div>

                            <div className="px-4 sm:px-5 md:px-8 py-5 md:py-8 max-h-[68vh] sm:max-h-[66vh] overflow-y-auto thin-scrollbar space-y-6">
                                {step === 1 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <Input
                                            label="First Name"
                                            required
                                            value={form.firstName}
                                            onChange={(e) => set('firstName', e.target.value)}
                                            onBlur={handleFieldBlur('firstName')}
                                            error={errors.firstName}
                                        />
                                        <Input
                                            label="Last Name"
                                            required
                                            value={form.lastName}
                                            onChange={(e) => set('lastName', e.target.value)}
                                            onBlur={handleFieldBlur('lastName')}
                                            error={errors.lastName}
                                        />

                                        <div className="md:col-span-2">
                                            <div className="text-xs text-muted-foreground mb-1">Display name preview</div>
                                            <div className="px-3 py-2 rounded border border-border bg-muted/20 text-sm">{displayNamePreview || '—'}</div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <div className="text-sm font-medium mb-1">Academic titles — prefix</div>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {PREFIX_SUGGESTIONS.map((t) => {
                                                    const on = (form.titlesPrefix || []).includes(t);
                                                    return (
                                                        <button
                                                            key={String(t)}
                                                            type="button"
                                                            className={`px-2 py-1 rounded border text-xs ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'}`}
                                                            onClick={() => toggleFromSuggestions('prefix', t)}
                                                        >
                                                            {t}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    placeholder="Add custom prefix (Enter)"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addCustomTitle('prefix', e.currentTarget.value);
                                                            e.currentTarget.value = '';
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        const inp = e.currentTarget.previousSibling?.querySelector?.('input');
                                                        const val = inp?.value || '';
                                                        addCustomTitle('prefix', val);
                                                        if (inp) inp.value = '';
                                                    }}
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                            {!!(form.titlesPrefix || []).length && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {(form.titlesPrefix || []).map((x) => (
                                                        <span key={String(x)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                              <Icon name="Award" size={12} /> {x}
                                                            <button type="button" onClick={() => removeTitle('prefix', x)} className="ml-1 hover:opacity-70" title="Remove">
                                <Icon name="X" size={12} />
                              </button>
                            </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="md:col-span-2">
                                            <div className="text-sm font-medium mb-1">Academic titles — suffix</div>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {SUFFIX_SUGGESTIONS.map((t) => {
                                                    const on = (form.titlesSuffix || []).includes(t);
                                                    return (
                                                        <button
                                                            key={String(t)}
                                                            type="button"
                                                            className={`px-2 py-1 rounded border text-xs ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'}`}
                                                            onClick={() => toggleFromSuggestions('suffix', t)}
                                                        >
                                                            {t}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    placeholder="Add custom suffix (Enter)"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addCustomTitle('suffix', e.currentTarget.value);
                                                            e.currentTarget.value = '';
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        const inp = e.currentTarget.previousSibling?.querySelector?.('input');
                                                        const val = inp?.value || '';
                                                        addCustomTitle('suffix', val);
                                                        if (inp) inp.value = '';
                                                    }}
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                            {!!(form.titlesSuffix || []).length && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {(form.titlesSuffix || []).map((x) => (
                                                        <span key={String(x)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                              <Icon name="Award" size={12} /> {x}
                                                            <button type="button" onClick={() => removeTitle('suffix', x)} className="ml-1 hover:opacity-70" title="Remove">
                                <Icon name="X" size={12} />
                              </button>
                            </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Select
                                                    label="Faculty"
                                                    value={form.faculty || 'FEI'}
                                                    onChange={handleFacultyChange}
                                                    options={facultyOptions.map(f => ({ 
                                                        value: f.code, 
                                                        label: `${f.code} - ${f.nameSk || f.nameEn}` 
                                                    }))}
                                                    clearable={false}
                                                    description="Primary faculty affiliation"
                                                />
                                            </div>
                                            <div>
                                                <Select
                                                    label="Department"
                                                    value={form.department || ''}
                                                    onChange={handleDepartmentChange}
                                                    options={filteredDepartments.map(d => ({ value: d.code, label: d.name }))}
                                                    placeholder="Select department..."
                                                    searchable={true}
                                                    clearable={true}
                                                    description={form.faculty ? 'Primary department (filters programs)' : 'Select a faculty first'}
                                                    disabled={!form.faculty}
                                                />
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Select
                                                    label="Program"
                                                    value={form.program || ''}
                                                    onChange={(v) => set('program', asString(v))}
                                                    options={filteredPrograms.map(p => ({ value: p.code, label: `${p.code} - ${p.name}` }))}
                                                    placeholder="Select program..."
                                                    searchable={true}
                                                    clearable={true}
                                                    description={form.department ? 'Study program limited to chosen department' : 'Select a department first'}
                                                    disabled={!form.department}
                                                />
                                            </div>
                                        </div>

                                        {/* Expertise & Research */}
                                        <div className="md:col-span-2">
                                            <h4 className="text-sm font-semibold mb-3 text-foreground">Expertise & Research (optional)</h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                <Input
                                                    label="Areas of Expertise (comma-separated)"
                                                    value={(form.expertise || []).join(', ')}
                                                    onChange={(e) => set('expertise', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                                    placeholder="Forensic Analysis, Network Security..."
                                                />
                                                <Input
                                                    label="Research Interests (comma-separated)"
                                                    value={(form.researchInterests || []).join(', ')}
                                                    onChange={(e) => set('researchInterests', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                                    placeholder="Digital Forensics, Malware Analysis..."
                                                />
                                            </div>
                                        </div>

                                        {/* Social Links */}
                                        <div className="md:col-span-2">
                                            <h4 className="text-sm font-semibold mb-3 text-foreground">Social Links (optional)</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <Input
                                                    label="LinkedIn"
                                                    value={form.socialLinks?.linkedin || ''}
                                                    onChange={(e) => set('socialLinks', { ...form.socialLinks, linkedin: e.target.value })}
                                                    placeholder="https://linkedin.com/in/..."
                                                />
                                                <Input
                                                    label="ResearchGate"
                                                    value={form.socialLinks?.researchgate || ''}
                                                    onChange={(e) => set('socialLinks', { ...form.socialLinks, researchgate: e.target.value })}
                                                    placeholder="https://researchgate.net/profile/..."
                                                />
                                                <Input
                                                    label="ORCID"
                                                    value={form.socialLinks?.orcid || ''}
                                                    onChange={(e) => set('socialLinks', { ...form.socialLinks, orcid: e.target.value })}
                                                    placeholder="https://orcid.org/..."
                                                />
                                                <Input
                                                    label="Google Scholar"
                                                    value={form.socialLinks?.googleScholar || ''}
                                                    onChange={(e) => set('socialLinks', { ...form.socialLinks, googleScholar: e.target.value })}
                                                    placeholder="https://scholar.google.com/..."
                                                />
                                                <div className="md:col-span-2">
                                                    <Input
                                                        label="Personal Website"
                                                        value={form.socialLinks?.website || ''}
                                                        onChange={(e) => set('socialLinks', { ...form.socialLinks, website: e.target.value })}
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <Select
                                            label="Employment type"
                                            value={form.employmentType}
                                            onChange={(v) => set('employmentType', v)}
                                            onBlur={handleFieldBlur('employmentType')}
                                            options={TYPES.map((x) => ({ value: x, label: x.replace('-', ' ') }))}
                                            error={errors.employmentType}
                                            clearable={false}
                                        />
                                        <Select
                                            label="Status"
                                            value={form.status}
                                            onChange={handleStatusChange}
                                            onBlur={handleFieldBlur('status')}
                                            options={STATUSES.map((x) => ({ value: x, label: x.replace('-', ' ') }))}
                                            error={errors.status}
                                            clearable={false}
                                        />
                                    </div>
                                )}

                                {step === 2 && (
                                    <>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-medium">Subjects (Courses)</div>
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={fillSubjectsFromDept} 
                                                    disabled={!form.department}
                                                >
                                                    Fill from departments
                                                </Button>
                                            </div>
                                            <MultiSelect
                                                value={form.subjects || []}
                                                onChange={(vals) => set('subjects', vals)}
                                                options={filteredCoursesOptions}
                                                placeholder="Select courses..."
                                                searchable={true}
                                                description={form.program ? `Filtered by program: ${selectedProgramName}` : 'Select a program to filter courses'}
                                            />
                                            {!!errors.subjects && <div className="text-xs text-destructive mt-1">{errors.subjects}</div>}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                            <div className="rounded-lg border border-dashed border-muted-foreground/40 p-4 bg-muted/50">
                                                <div className="text-xs uppercase tracking-wide text-muted-foreground">Classes load</div>
                                                <div className="text-2xl font-semibold text-foreground mt-1">{form.classesCount ?? 0}</div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Auto-calculated from selected subjects. Adjust courses to change this value.
                                                </p>
                                            </div>
                                            <Input
                                                label="Years of experience"
                                                type="number"
                                                min={0}
                                                max={50}
                                                value={form.yearsExperience}
                                                onChange={handleYearsExperienceChange}
                                                onBlur={handleFieldBlur('yearsExperience')}
                                                error={errors.yearsExperience}
                                            />
                                            <Input
                                                label="Hire date"
                                                type="date"
                                                value={form.hireDate}
                                                onChange={(e) => set('hireDate', e.target.value)}
                                                onBlur={handleFieldBlur('hireDate')}
                                                error={errors.hireDate}
                                            />
                                        </div>
                                    </>
                                )}

                                {step === 3 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <Input
                                            label="Email"
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => set('email', e.target.value)}
                                            onBlur={handleFieldBlur('email')}
                                            required
                                            error={errors.email}
                                        />
                                        <Input
                                            label="Phone"
                                            type="tel"
                                            value={form.phone}
                                            onChange={(e) => set('phone', e.target.value)}
                                            onBlur={handleFieldBlur('phone')}
                                            error={errors.phone}
                                        />
                                        <Select
                                            label="Office / Room"
                                            value={form.office || ''}
                                            onChange={(v) => set('office', asString(v))}
                                            options={roomsOptions}
                                            placeholder="Select office/room..."
                                            searchable={true}
                                            clearable={true}
                                            description={roomsOptions.length ? `${roomsOptions.length} rooms available` : 'No rooms available'}
                                        />
                                        <div>
                                            <div className="text-sm font-medium mb-1">Rating (0–5)</div>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <button
                                                        key={String(i)}
                                                        type="button"
                                                        className={`p-1 rounded ${form.rating >= i + 1 ? 'text-yellow-500' : 'text-muted-foreground'}`}
                                                        onClick={() => set('rating', i + 1)}
                                                        title={`${i + 1} star`}
                                                    >
                                                        <Icon name={form.rating >= i + 1 ? 'Star' : 'StarOff'} size={18} />
                                                    </button>
                                                ))}
                                                <Button size="sm" variant="ghost" onClick={() => set('rating', 0)}>Clear</Button>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <Textarea
                                                label="About"
                                                value={form.about || ''}
                                                onChange={(e) => set('about', e.target.value)}
                                                placeholder="Additional information about the faculty member"
                                                minRows={3}
                                            />
                                        </div>
                                    </div>
                                )}

                                {step === 4 && (
                                    <>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-medium">Certifications</div>
                                                <Button
                                                    type="button"
                                                    iconName="Plus"
                                                    variant="outline"
                                                    onClick={() =>
                                                        set('certifications', [
                                                            ...(form.certifications || []),
                                                            { title: '', issuer: '', issuedOn: '', expiresOn: '', fileUrl: '', fileName: '', mimeType: '', tags: [], notes: '', code: '', primary: false },
                                                        ])
                                                    }
                                                >
                                                    Add certificate
                                                </Button>
                                            </div>
                                            {!!errors.certifications && <div className="text-xs text-destructive">{errors.certifications}</div>}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {(form.certifications || []).map((c, i) => (
                                                    <CertCard
                                                        key={String(i)}
                                                        cert={c}
                                                        onChange={(next) => set('certifications', form.certifications.map((x, idx) => (idx === i ? next : x)))}
                                                        onRemove={() => set('certifications', form.certifications.filter((_, idx) => idx !== i))}
                                                        onTogglePrimary={() => {
                                                            const isPrimary = !!form.certifications[i]?.primary;
                                                            if (isPrimary) set('certifications', form.certifications.map((x) => ({ ...x, primary: false })));
                                                            else set('certifications', form.certifications.map((x, idx) => ({ ...x, primary: idx === i })));
                                                        }}
                                                    />
                                                ))}
                                                {!form.certifications?.length && <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-muted/10">No certificates added.</div>}
                                            </div>
                                            {Object.entries(errors)
                                                .filter(([k]) => String(k).startsWith('cert_'))
                                                .map(([k, msg]) => (
                                                    <div key={String(k)} className="text-xs text-destructive">
                                                        {String(msg)}
                                                    </div>
                                                ))}
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-sm font-medium">Availability</div>
                                            {!!errors.availability && <div className="text-xs text-destructive">{errors.availability}</div>}
                                            <div className="flex flex-wrap gap-2">
                                                {DAYS.map((d) => {
                                                    const on = (form.availability || []).includes(d);
                                                    return (
                                                        <button
                                                            key={String(d)}
                                                            type="button"
                                                            onClick={() => toggleDay(d)}
                                                            className={`px-3 py-1.5 rounded-md border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'}`}
                                                        >
                                                            {d}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {(form.availability || []).length > 0 && (
                                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {(form.availability || []).map((d) => {
                                                        const tw = form.timeWindows?.[d] || { from: '', to: '' };
                                                        return (
                                                            <div key={String(d)} className="border border-border rounded-md p-3">
                                                                <div className="text-xs text-muted-foreground mb-2">{d} — optional time window</div>
                                                                <div className="grid grid-cols-2 gap-2 items-end">
                                                                    <Input label="From" type="time" value={tw.from || ''} onChange={(e) => setTime(d, 'from', e.target.value)} />
                                                                    <Input label="To" type="time" value={tw.to || ''} onChange={(e) => setTime(d, 'to', e.target.value)} />
                                                                </div>
                                                                {!!errors[`time_${d}`] && <div className="mt-1 text-xs text-destructive">{errors[`time_${d}`]}</div>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="rounded-lg border border-dashed border-muted-foreground/40 p-4 bg-muted/50 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-medium">Assign to existing schedule</div>
                                                    <p className="text-xs text-muted-foreground">Select timetable entries that should immediately switch to this teacher after creation.</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    iconName="RefreshCw"
                                                    onClick={loadScheduleEvents}
                                                    disabled={loadingScheduleEvents}
                                                >
                                                    Refresh
                                                </Button>
                                            </div>
                                            {!(form.subjects || []).length ? (
                                                <div className="text-xs text-muted-foreground">Add at least one subject to see compatible schedule entries.</div>
                                            ) : loadingScheduleEvents ? (
                                                <div className="text-xs text-muted-foreground">Loading schedule…</div>
                                            ) : matchingScheduleOptions.length === 0 ? (
                                                <div className="text-xs text-muted-foreground">No schedule entries match the selected subjects.</div>
                                            ) : (
                                                <>
                                                    <MultiSelect
                                                        value={linkedScheduleIds}
                                                        onChange={setLinkedScheduleIds}
                                                        options={matchingScheduleOptions}
                                                        placeholder="Select classes to reassign..."
                                                        searchable={true}
                                                    />
                                                    {linkedScheduleIds.length > 0 && (
                                                        <div className="text-xs text-muted-foreground">{linkedScheduleIds.length} class{linkedScheduleIds.length === 1 ? '' : 'es'} selected</div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="px-4 sm:px-6 md:px-8 py-3 md:py-5 border-t border-border bg-card sticky bottom-0">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm text-muted-foreground">Step {step} of {STEPS.length}</div>
                                        {hasDraft && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30 text-xs">
                                                <Icon name="Save" size={12} />
                                                Draft saved
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:ml-auto md:pl-6 w-full sm:w-auto">
                                        {hasDraft && (
                                            <Button variant="ghost" size="sm" onClick={handleDiscardDraft} className="w-full sm:w-auto" title="Discard draft">
                                                <Icon name="Trash2" size={14} className="mr-1" />
                                                Discard
                                            </Button>
                                        )}
                                        <Button variant="outline" onClick={handleSaveDraft} className="w-full sm:w-auto">
                                            <Icon name="Save" size={14} className="mr-1" />
                                            Save Draft
                                        </Button>
                                        {step > 1 && <Button variant="outline" onClick={goPrev} className="w-full sm:w-auto">Previous</Button>}
                                        {step < STEPS.length ? (
                                            <Button variant="default" onClick={goNext} className="w-full sm:w-auto">Next</Button>
                                        ) : (
                                            <Button variant="default" onClick={submit} className="w-full sm:w-auto">Add Faculty</Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="px-4 sm:px-6 md:px-8 py-5 md:py-8 max-h-[74vh] overflow-y-auto thin-scrollbar space-y-4">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                    <div className="lg:col-span-2 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div className="text-sm text-muted-foreground">
                                                Paste JSON array, object with a faculty list, or NDJSON. Keys like name/firstName/lastName, email, employeeId, department, faculty, subjects, type/status, load/experience, joined, office, days, about are supported.
                                            </div>
                                        </div>

                                        <Textarea
                                            minRows={10}
                                            resize="y"
                                            textareaClassName="font-mono h-40 sm:h-48 md:h-56 thin-scrollbar"
                                            placeholder='[{"name":"John Doe","email":"john.doe@example.com","department":"Computer Science","subjects":["Programming"]}]'
                                            value={rawJson}
                                            onChange={(e) => setRawJson(e.target.value)}
                                        />

                                        <div className="flex flex-wrap items-center gap-3">
                                            <input ref={fileRef} type="file" accept=".json,.ndjson,.txt,application/json,text/plain" onChange={(e) => {
                                                const f = e?.target?.files?.[0];
                                                if (!f) return;
                                                const reader = new FileReader();
                                                reader.onload = () => setRawJson(String(reader.result || ''));
                                                reader.onerror = () => setParseError('Failed to read file');
                                                reader.readAsText(f);
                                                if (fileRef.current) fileRef.current.value = '';
                                            }} className="hidden" />
                                            <Button variant="outline" iconName="Upload" onClick={() => fileRef.current?.click()}>Upload file</Button>

                                            <label className="inline-flex items-center gap-2 text-sm" data-stop-row="1">
                                                <Checkbox checked={autoFillNameFromEmail} onChange={(e) => setAutoFillNameFromEmail(!!e?.target?.checked)} aria-label="Names from email if missing" />
                                                <span className="text-muted-foreground">Names from email if missing</span>
                                            </label>
                                            <label className="inline-flex items-center gap-2 text-sm" data-stop-row="1">
                                                <Checkbox checked={autoGenerateEmpId} onChange={(e) => setAutoGenerateEmpId(!!e?.target?.checked)} aria-label="Auto-generate Employee ID" />
                                                <span className="text-muted-foreground">Auto-generate Employee ID</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Select 
                                            label="Default Department" 
                                            options={departments.filter(d => d.active).map(d => ({ value: d.code, label: d.name }))} 
                                            value={defaultDept} 
                                            onChange={setDefaultDept}
                                            searchable={true}
                                            clearable={true}
                                        />
                                        <Select label="Default Employment Type" options={TYPES.map((x) => ({ value: x, label: x }))} value={defaultType} onChange={setDefaultType} />
                                        <Select label="Default Status" options={STATUSES.map((x) => ({ value: x, label: x }))} value={defaultStatus} onChange={setDefaultStatus} />
                                        <Input
                                            label="Default Subjects"
                                            placeholder="Comma separated"
                                            value={defaultSubjects.join(', ')}
                                            onChange={(e) => setDefaultSubjects(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                                        />

                                        <label className="inline-flex items-center gap-2 text-sm">
                                            <Checkbox checked={preferRowDept} onChange={(e) => setPreferRowDept(!!e?.target?.checked)} aria-label="Prefer department from rows" />
                                            <span className="text-muted-foreground">Prefer department from rows</span>
                                        </label>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium">On conflict</label>
                                            <div className="w-full grid grid-cols-3 gap-2">
                                                <Button
                                                    size="sm"
                                                    className="w-full"
                                                    variant={importStrategy === 'skip' ? 'default' : 'outline'}
                                                    onClick={() => setImportStrategy('skip')}
                                                >
                                                    Skip
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="w-full"
                                                    variant={importStrategy === 'update' ? 'default' : 'outline'}
                                                    onClick={() => setImportStrategy('update')}
                                                >
                                                    Update
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="w-full"
                                                    variant={importStrategy === 'duplicate' ? 'default' : 'outline'}
                                                    onClick={() => setImportStrategy('duplicate')}
                                                >
                                                    Duplicate
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="rounded-md border border-border p-3 bg-muted/40">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                                                <div>Parsed: <span className="font-medium">{parsed.length}</span></div>
                                                <div className="text-green-600">Valid: <span className="font-medium">{validCount}</span></div>
                                                <div className="text-red-600 sm:col-span-1 col-span-2">Invalid: <span className="font-medium">{invalidCount}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {parseError ? (
                                    <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-700 px-3 py-2 text-sm">{parseError}</div>
                                ) : null}

                                <div className="rounded-lg border border-border">
                                    <div className="flex items-center justify-between px-3 py-2 gap-2 flex-wrap">
                                        <div className="inline-flex items-center gap-2">
                      <span data-stop-row="1">
                        <Checkbox
                            checked={allValidSelected}
                            indeterminate={someValidSelected}
                            aria-checked={allValidSelected ? 'true' : someValidSelected ? 'mixed' : 'false'}
                            onChange={(e) => toggleSelectAll(!!e?.target?.checked)}
                            title={validCount === 0 ? 'No valid rows' : allValidSelected ? 'Deselect all valid' : 'Select all valid'}
                            disabled={validCount === 0}
                        />
                      </span>
                                            <span className="text-sm text-muted-foreground">Select all valid</span>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Selected: {validRows.filter((r) => r.selected).length} / {validCount}
                                        </div>
                                    </div>

                                    <div className="hidden md:block max-h-72 overflow-y-auto thin-scrollbar">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="sticky top-0 bg-muted/50 backdrop-blur z-10">
                                                <tr className="text-left">
                                                    <th className="w-12 px-3 py-2">Sel</th>
                                                    <th className="px-3 py-2">Name</th>
                                                    <th className="px-3 py-2">Email</th>
                                                    <th className="px-3 py-2">Employee ID</th>
                                                    <th className="px-3 py-2">Dept.</th>
                                                    <th className="px-3 py-2">Subjects</th>
                                                    <th className="px-3 py-2">Status</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {parsed.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No data</td>
                                                    </tr>
                                                ) : (
                                                    parsed.map((r, i) => {
                                                        const ok = r.data && !r.error;
                                                        return (
                                                            <tr key={`${r.index}-${i}`} className="border-t border-border/60">
                                                                <td className="px-3 py-2 align-top">
                                    <span data-stop-row="1">
                                      <Checkbox
                                          checked={!!r.selected && ok}
                                          onChange={(e) => {
                                              const checked = !!e?.target?.checked;
                                              setParsed((prev) => prev.map((row, idx) => (idx === i ? { ...row, selected: checked } : row)));
                                          }}
                                          disabled={!ok}
                                          aria-label="Select row"
                                      />
                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 align-top">
                                                                    <div className="font-medium truncate max-w-[240px]">{ok ? r.data.fullName || r.data.name : '—'}</div>
                                                                    <div className={`text-xs ${ok ? 'text-muted-foreground' : 'text-red-600'}`}>
                                                                        {ok ? 'Mapped' : r.error}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 align-top">
                                                                    <div className="truncate max-w-[240px]">{ok ? r.data.email || '—' : '—'}</div>
                                                                </td>
                                                                <td className="px-3 py-2 align-top">
                                                                    <div className="truncate max-w-[200px]">{ok ? r.data.employeeId || '—' : '—'}</div>
                                                                </td>
                                                                <td className="px-3 py-2 align-top">
                                                                    <div className="truncate max-w-[200px]">{ok ? r.data.department || '—' : '—'}</div>
                                                                </td>
                                                                <td className="px-3 py-2 align-top">
                                                                    <div className="truncate max-w-[240px]">{ok ? (r.data.subjects || []).slice(0, 3).join(', ') || '—' : '—'}</div>
                                                                </td>
                                                                <td className="px-3 py-2 align-top">
                                                                    <div className="truncate max-w-[120px]">{ok ? (r.data.status || 'active') : '—'}</div>
                                                                </td>
                                                                <td className="px-3 py-2 align-top">
                                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${ok ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30' : 'bg-red-500/10 text-red-700 border border-red-500/30'}`}>
                                      {ok ? 'Valid' : 'Invalid'}
                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="md:hidden max-h-80 overflow-y-auto p-2 space-y-2 thin-scrollbar">
                                        {parsed.length === 0 ? (
                                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">No data</div>
                                        ) : (
                                            parsed.map((r, i) => <ImportRowCard key={`${r.index}-${i}`} r={r} idx={i} />)
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 sm:px-6 md:px-8 py-3 md:py-5 border-t border-border bg-card sticky bottom-0">
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:items-center md:justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        {validRows.filter((r) => r.selected).length > 0 ? `Ready to import ${validRows.filter((r) => r.selected).length} record(s)` : 'No valid rows selected'}
                                        {invalidCount > 0 ? ` • Skipping ${invalidCount} invalid row(s)` : ''}
                                    </div>
                                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                                        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                                        <Button variant="default" onClick={doImport} disabled={validRows.filter((r) => r.selected).length === 0} className="w-full sm:w-auto">
                                            Import Selected
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddFacultyModal;