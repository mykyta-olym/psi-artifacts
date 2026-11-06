// src/pages/faculty-management/components/FacultyProfileModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import MultiSelect from '../../../components/ui/MultiSelect';
import Textarea from '../../../components/ui/Textarea';
import Avatar from '../../../components/ui/Avatar';
import Icon from '../../../components/AppIcon';
import CertificatesPanel from '../../../components/profile/CertificatesPanel';
import TeachingSchedule from '../../../components/profile/TeachingSchedule';
import { DAY_LABELS, DAYS_KEYS as Days, TEACHER_POLICY } from '../../../constants/schedulePolicy';
import { displayNameFrom, getInitials } from '../../../utils/displayName';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationsContext';
import { fetchCourses, fetchTeacherTimetable, fetchFacultyByEmail } from '../../../data/maisApiAdapter';
import { fetchDepartments } from '../../../data/departmentsApi';
import { fetchFacultyOptions } from '../../../data/facultyOptionsApi';
import { fetchPrograms } from '../../../data/programsApi';
import { fetchRooms } from '../../../data/roomsApi';
import { getActivities, getUserActivities } from '../../../data/activitiesApi';
import { rateTeacher, getStudentRating } from '../../../data/teacherRatingApi';

const NON_EDIT_TABS = ['activity'];

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(+v) ? +v : 0));
const blockBadKeysInt = (e) => { const k = e.key; if (['e', 'E', '+', '-', '.'].includes(k)) e.preventDefault(); };
const preventWheel = (e) => { e.currentTarget.blur(); e.preventDefault(); };
const fmtDateLong = (d) => { if (!d) return '—'; const x = new Date(d); return isNaN(+x) ? '—' : x.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); };

const statusOpts = ['active', 'on-leave', 'inactive', 'substitute'].map(x => ({ value: x, label: x.replace('-', ' ') }));
const typeOpts = ['full-time', 'part-time'].map(x => ({ value: x, label: x.replace('-', ' ') }));

const parseTime = (str = '') => {
    if (!str) return null;
    const m = String(str).match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return null;
    let h = Math.min(23, Math.max(0, +m[1]));
    let min = Math.min(59, Math.max(0, +(m[2] ?? 0)));
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = ((h + 11) % 12) + 1;
    return { h, min, suffix };
};
const fmtSingle = ({ h, min, suffix }) => `${h}${min ? ':' + String(min).padStart(2, '0') : ''} ${suffix}`;
const formatTimeRange = (start, end) => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (!s || !e) return '';
    return s.suffix === e.suffix
        ? `${s.h}${s.min ? ':' + String(s.min).padStart(2, '0') : ''} - ${e.h}${e.min ? ':' + String(e.min).padStart(2, '0') : ''} ${e.suffix}`
        : `${fmtSingle(s)} - ${fmtSingle(e)}`;
};

const StatusBadge = ({ status }) => {
    const map = {
        active: { label: 'Active', cls: 'bg-success text-success-foreground' },
        'on-leave': { label: 'On leave', cls: 'bg-warning text-warning-foreground' },
        inactive: { label: 'Inactive', cls: 'bg-muted text-muted-foreground' },
        substitute: { label: 'Substitute', cls: 'bg-primary text-primary-foreground' }
    };
    const cfg = map[status] || map.inactive;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>;
};

const { MIN: TEACHER_MIN, MAX: TEACHER_MAX, MIN_STEP_MIN, MAX_DURATION_MIN, ALLOW_WEEKENDS } = TEACHER_POLICY;

const timeToMin = (t) => {
    if (!t) return null;
    const m = t.match(/^(\d{2}):(\d{2})$/);
    if (!m) return null;
    return +m[1] * 60 + +m[2];
};
const normalizeTime = (obj = {}, keys = []) => { for (const k of keys) { if (typeof obj[k] === 'string' && obj[k]) return obj[k]; } return ''; };
const normalizeOH = (dayObj = {}) => {
    const start = normalizeTime(dayObj, ['start', 'startAt', 'from']);
    const end = normalizeTime(dayObj, ['end', 'endAt', 'to']);
    const enabled = !!dayObj.enabled;
    return { start, end, enabled };
};
const validateOfficeHours = (officeHours = {}) => {
    const errors = {};
    for (const d of Days) {
        const oh = normalizeOH(officeHours[d] || {});
        const weekend = d === 'Sat' || d === 'Sun';
        if (!oh.enabled) continue;
        if (!ALLOW_WEEKENDS && weekend) { errors[d] = ['Weekends not allowed']; continue; }
        const sMin = timeToMin(oh.start);
        const eMin = timeToMin(oh.end);
        const minAllowed = timeToMin(TEACHER_MIN);
        const maxAllowed = timeToMin(TEACHER_MAX);
        const dayErrs = [];
        if (sMin == null || eMin == null) dayErrs.push('Both start and end required');
        if (sMin != null && eMin != null) {
            if (eMin <= sMin) dayErrs.push('End must be after start');
            if (eMin - sMin < MIN_STEP_MIN) dayErrs.push(`Minimum ${MIN_STEP_MIN} minutes`);
            if (eMin - sMin > MAX_DURATION_MIN) dayErrs.push(`Maximum ${MAX_DURATION_MIN / 60} hours`);
        }
        if (sMin != null && sMin < minAllowed) dayErrs.push(`Earliest ${TEACHER_MIN}`);
        if (eMin != null && eMin > maxAllowed) dayErrs.push(`Latest ${TEACHER_MAX}`);
        if (dayErrs.length) errors[d] = dayErrs;
    }
    return { errors, isValid: Object.keys(errors).length === 0 };
};

const isEmail = (s = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const invalidCls = 'border-destructive focus-visible:ring-destructive focus-visible:border-destructive';

const minutesToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const minutesToLabel = (mins) => {
    const hours24 = Math.floor(mins / 60);
    const minutes = mins % 60;
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = ((hours24 + 11) % 12) + 1;
    return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const alignToStep = (value, { min, max, step }) => {
    const minutes = timeToMin(value);
    if (minutes == null) return '';
    const clamped = Math.max(min, Math.min(max, minutes));
    const delta = clamped - min;
    const snaps = Math.round(delta / step);
    const normalized = Math.min(max, min + snaps * step);
    return minutesToTime(normalized);
};

const parseOfficeFromLocation = (s = '') => {
    const m = String(s || '').match(/^Room\s+([^\s·]+)\s*·\s*(.+)$/);
    return m ? m[1] : '';
};

const ensureProfileShape = (v = {}) => {
    const subjects = Array.isArray(v.subjects) ? v.subjects : v.subjects ? [v.subjects] : [];
    const certs = Array.isArray(v.certifications) ? v.certifications : [];
    const prefs = v.preferences || {};
    const langs = Array.isArray(v.languages) ? v.languages : [];
    const pubs = Array.isArray(v.publications) ? v.publications : [];
    const interests = Array.isArray(v.researchInterests) ? v.researchInterests : [];
    const expertise = Array.isArray(v.expertise) ? v.expertise : [];
    const social = v.socialLinks && typeof v.socialLinks === 'object' ? v.socialLinks : {};
    
    return {
        role: v.role || 'teacher',
        firstName: v.firstName || v.givenName || '',
        lastName: v.lastName || v.familyName || '',
        name: v.name || v.fullName || `${(v.firstName || v.givenName || '').trim()} ${(v.lastName || v.familyName || '').trim()}`.trim(),
        email: v.email || '',
        phone: typeof v.phone === 'string' ? v.phone : '',
        location: v.location || '',
        about: v.about || '',
        faculty: v.faculty || 'FEI',
        program: v.program || '',
        department: v.department || '',
        departmentCode: v.departmentCode || '',
        subjects,
        yearsExperience: Number.isFinite(+v.yearsExperience) ? +v.yearsExperience : 0,
        officeHours: typeof v.officeHours === 'object' && v.officeHours ? v.officeHours : {},
        workingHours: typeof v.workingHours === 'object' && v.workingHours ? v.workingHours : {},
        certifications: certs,
        preferences: {
            showEmailOnProfile: prefs.showEmailOnProfile ?? true,
            showPhoneOnProfile: prefs.showPhoneOnProfile ?? false
        },
        status: v.status || 'active',
        employmentType: v.employmentType || 'full-time',
        classesCount: Number.isFinite(+v.classesCount) ? +v.classesCount : 0,
        hireDate: v.hireDate || '',
        lastActivity: v.lastActivity || '',
        rating: Number.isFinite(+v.rating) ? +v.rating : 0,
        employeeId: v.employeeId || v.id || '',
        office: v.office || '',
        avatarUrl: v.avatarUrl || '',
        activity: Array.isArray(v.activity) ? v.activity : [],
        titlesPrefix: Array.isArray(v.titlesPrefix) ? v.titlesPrefix : [],
        titlesSuffix: Array.isArray(v.titlesSuffix) ? v.titlesSuffix : [],
        academicDegree: v.academicDegree || '',
        languages: langs,
        publications: pubs,
        researchInterests: interests,
        expertise,
        socialLinks: social
    };
};

const FacultyProfileModal = ({ isOpen, onClose, teacher, onSave, onReassignSchedule, readOnly = false }) => {
    const { user, userProfile } = useAuth();
    const primaryEmail = user?.email || userProfile?.email || '';

    const [activeTab, setActiveTab] = useState('profile');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(() => ensureProfileShape(teacher || {}));
    const [dirty, setDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [coursesOptions, setCoursesOptions] = useState([]);
    const [allCourses, setAllCourses] = useState([]); // Store full course data
    const [departments, setDepartments] = useState([]);
    const [facultyOptions, setFacultyOptions] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [scheduleEvents, setScheduleEvents] = useState([]);
    const [isScheduleLoading, setIsScheduleLoading] = useState(false);
    const [scheduleReloadKey, setScheduleReloadKey] = useState(0);
    const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
    const [reassignTargetEmail, setReassignTargetEmail] = useState(() => primaryEmail || '');
    const [isReassigningSchedule, setIsReassigningSchedule] = useState(false);
    const [activityData, setActivityData] = useState([]);
    const [isActivityLoading, setIsActivityLoading] = useState(false);
    const [isLoadingFullData, setIsLoadingFullData] = useState(false);
    const [userRating, setUserRating] = useState(null); // User's rating for this teacher
    const [isRatingLoading, setIsRatingLoading] = useState(false);
    const [showRatingDialog, setShowRatingDialog] = useState(false);
    const [hoverRating, setHoverRating] = useState(0);
    // Local copy of selfProfile for when viewing own profile - mirrors userProfile but can be updated locally
    const [selfProfile, setSelfProfile] = useState(() => ensureProfileShape(userProfile || {}));
    
    // Controlled input helper - ensures value is never undefined
    const controlled = (val) => val ?? '';
    
    const emailsEqual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    const isYou = !!teacher?.isYou || (teacher?.email && emailsEqual(teacher.email, userProfile?.email));
    const eff = (k) => (isYou ? userProfile?.[k] ?? formData?.[k] : formData?.[k]);
    const effectiveOH = useMemo(() => (isYou ? userProfile?.officeHours || {} : formData?.officeHours || {}), [isYou, userProfile?.officeHours, formData?.officeHours]);
    const scheduleValidation = useMemo(() => validateOfficeHours(effectiveOH), [effectiveOH]);
    const displayNameSelf = useMemo(() => displayNameFrom(userProfile || {}, { privacy: false }), [userProfile]);
    const tabs = useMemo(() => ([
        { id: 'profile', label: 'Overview', icon: 'User' },
        { id: 'employment', label: 'Employment', icon: 'Briefcase' },
        { id: 'certs', label: 'Certifications', icon: 'Award' },
        { id: 'schedule', label: 'Schedule', icon: 'Calendar' },
        { id: 'activity', label: 'Activity', icon: 'Activity' }
    ]), []);
    const initials = useMemo(() => {
        const data = {
            name: eff('name'),
            firstName: eff('firstName'),
            lastName: eff('lastName'),
            email: eff('email') || teacher?.email
        };
        return getInitials(data);
    }, [formData, userProfile, teacher]);

    useEffect(() => {
        if (isOpen) {
            console.log('[FacultyProfileModal] Opening modal with teacher:', teacher);
            console.log('[FacultyProfileModal] Teacher program:', teacher?.program);
            console.log('[FacultyProfileModal] Teacher certifications:', teacher?.certifications);
            console.log('[FacultyProfileModal] Teacher activity:', teacher?.activity);
            setFormData(ensureProfileShape(teacher || {}));
            setSelfProfile(ensureProfileShape(userProfile || teacher || {}));
            setIsEditing(false);
            setActiveTab('profile');
            setDirty(false);
            setIsSaving(false);
            setScheduleReloadKey((prev) => prev + 1);
            setSelectedScheduleIds([]);
            
            // Load full faculty data from API if email is available
            if (teacher?.email) {
                console.log('[FacultyProfileModal] Fetching full data for email:', teacher.email);
                setIsLoadingFullData(true);
                fetchFacultyByEmail(teacher.email, { ttl: 0 }).then(fullData => {
                    console.log('[FacultyProfileModal] Received full data from API:', fullData);
                    console.log('[FacultyProfileModal] API program:', fullData?.program);
                    console.log('[FacultyProfileModal] API certifications:', fullData?.certifications);
                    console.log('[FacultyProfileModal] API activity:', fullData?.activity);
                    if (fullData) {
                        // Merge API data with teacher data, giving priority to API
                        const merged = ensureProfileShape({ 
                            ...teacher, 
                            ...fullData,
                            // Ensure these fields from API take priority
                            phone: fullData.phone || teacher.phone,
                            office: fullData.office || teacher.office,
                            location: fullData.location || teacher.location,
                            about: fullData.about || teacher.about,
                            officeHours: fullData.officeHours || teacher.officeHours,
                            certifications: fullData.certifications || teacher.certifications,
                            program: fullData.program || teacher.program,
                            departmentCode: fullData.departmentCode || teacher.departmentCode,
                            academicDegree: fullData.academicDegree || teacher.academicDegree,
                            expertise: fullData.expertise || teacher.expertise,
                            researchInterests: fullData.researchInterests || teacher.researchInterests,
                            publications: fullData.publications || teacher.publications,
                            languages: fullData.languages || teacher.languages,
                            socialLinks: fullData.socialLinks || teacher.socialLinks
                        });
                        console.log('[FacultyProfileModal] Merged data:', {
                            phone: merged.phone,
                            office: merged.office,
                            program: merged.program,
                            location: merged.location,
                            about: merged.about?.substring(0, 50) + '...',
                            officeHours: merged.officeHours,
                            certifications: merged.certifications?.length,
                            academicDegree: merged.academicDegree
                        });
                        setFormData(merged);
                        // Also update selfProfile if this is the current user
                        if (isYou) {
                            setSelfProfile(merged);
                        }
                    }
                }).catch(err => {
                    console.error('[FacultyProfileModal] Failed to load faculty data:', err);
                }).finally(() => {
                    setIsLoadingFullData(false);
                });
            }
            
            // Load courses for subjects dropdown
            fetchCourses().then(courses => {
                setAllCourses(courses || []); // Store all courses
                const options = (courses || []).map(c => ({
                    value: c.code,
                    label: c.nameEn || c.nameSk || c.name || c.code,
                    program: c.program,
                    faculty: c.faculty
                }));
                setCoursesOptions(options);
            }).catch(() => {
                setAllCourses([]);
                setCoursesOptions([]);
            });

            // Load departments, faculty options, programs, and rooms from API
            Promise.all([
                fetchDepartments(),
                fetchFacultyOptions(),
                fetchPrograms(),
                fetchRooms()
            ]).then(([depts, faculties, progs, roomsData]) => {
                setDepartments(depts || []);
                setFacultyOptions(faculties || []);
                setPrograms(progs || []);
                setRooms(Array.isArray(roomsData) ? roomsData.filter(r => r.active !== false) : []);
            }).catch(() => {
                setDepartments([]);
                setFacultyOptions([]);
                setPrograms([]);
                setRooms([]);
            });
        }
    }, [isOpen, teacher, primaryEmail]);

    useEffect(() => {
        if (!isOpen) {
            setScheduleEvents([]);
            setSelectedScheduleIds([]);
            setIsScheduleLoading(false);
            return;
        }
        if (!teacher?.email) return;
        let cancelled = false;
        setIsScheduleLoading(true);
        (async () => {
            try {
                const items = await fetchTeacherTimetable(teacher.email);
                if (!cancelled) setScheduleEvents(Array.isArray(items) ? items : []);
            } catch {
                if (!cancelled) setScheduleEvents([]);
            } finally {
                if (!cancelled) setIsScheduleLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, teacher?.email, scheduleReloadKey]);

    // Use activities from NotificationsContext for general feed
    // But load user-specific activities when modal is open
    const { activityFeed: globalActivityFeed = [] } = useNotifications() || {};
    
    useEffect(() => {
        // Load activities for the specific teacher when modal opens
        if (!isOpen || !teacher?.email) {
            setActivityData([]);
            setIsActivityLoading(false);
            return;
        }
        
        let cancelled = false;
        setIsActivityLoading(true);
        
        (async () => {
            try {
                // Try to get user-specific activities
                const result = await getUserActivities(teacher.email, { 
                    perPage: 20,
                    sort: 'time',
                    dir: 'desc'
                });
                if (!cancelled) {
                    const items = result?.items || result?.data || result?.activities || [];
                    setActivityData(Array.isArray(items) ? items : []);
                }
            } catch (err) {
                // If error (e.g., permissions), fall back to global feed
                console.warn('[FacultyProfileModal] Could not load user activities, using global feed:', err.message);
                if (!cancelled) {
                    setActivityData(globalActivityFeed);
                }
            } finally {
                if (!cancelled) setIsActivityLoading(false);
            }
        })();
        
        return () => {
            cancelled = true;
        };
    }, [isOpen, teacher?.email, globalActivityFeed]);

    // Load user's rating for this teacher
    useEffect(() => {
        if (!isOpen || !teacher?.id || !userProfile?.studentId || isYou) {
            setUserRating(null);
            return;
        }
        
        let cancelled = false;
        setIsRatingLoading(true);
        
        (async () => {
            try {
                const result = await getStudentRating(teacher.id, userProfile.studentId);
                if (!cancelled) {
                    setUserRating(result?.hasRated ? result : null);
                }
            } catch (err) {
                console.error('[FacultyProfileModal] Failed to load user rating:', err);
                if (!cancelled) setUserRating(null);
            } finally {
                if (!cancelled) setIsRatingLoading(false);
            }
        })();
        
        return () => { cancelled = true; };
    }, [isOpen, teacher?.id, userProfile?.studentId, isYou]);

    useEffect(() => {
        if (isOpen) setReassignTargetEmail(primaryEmail || '');
    }, [isOpen, primaryEmail]);

    useEffect(() => {
        setSelectedScheduleIds([]);
    }, [teacher?.email]);

    useEffect(() => {
        if (NON_EDIT_TABS.includes(activeTab) && isEditing) {
            setIsEditing(false);
            setFormData(ensureProfileShape(teacher || {}));
            setDirty(false);
        }
    }, [activeTab, isEditing, teacher]);

    const minMinutes = timeToMin(TEACHER_MIN);
    const maxMinutes = timeToMin(TEACHER_MAX);
    const timeStep = MIN_STEP_MIN;

    // Filter departments by selected faculty
    const filteredDepartments = useMemo(() => {
        if (!formData?.faculty) return [];
        return departments.filter(d => d.faculty === formData.faculty && d.active);
    }, [departments, formData?.faculty]);

    // Filter programs by selected faculty and department
    const filteredPrograms = useMemo(() => {
        if (!formData?.faculty) return [];
        return programs.filter(p => {
            if (p.faculty !== formData.faculty) return false;
            if (!p.active) return false;
            // If department is selected, filter by departmentCode (not department name)
            if (formData.departmentCode && p.departmentId && p.departmentId !== formData.departmentCode) return false;
            return true;
        });
    }, [programs, formData?.faculty, formData?.departmentCode]);

    // Filter courses by selected program - courses must belong to the selected program
    const filteredCourses = useMemo(() => {
        if (!formData?.program) {
            // If no program selected, show all courses for the selected faculty
            return coursesOptions.filter(c => 
                !formData?.faculty || c.faculty === formData.faculty
            );
        }
        // Filter courses by program
        return coursesOptions.filter(c => 
            c.program === formData.program && 
            (!formData?.faculty || c.faculty === formData.faculty)
        );
    }, [coursesOptions, formData?.program, formData?.faculty]);

    const scheduleOptions = useMemo(() => {
        return (scheduleEvents || [])
            .filter((item) => item?.id)
            .map((item) => ({
                value: item.id,
                label: `${item.courseCode || item.courseName || 'Class'} • ${item.day || ''} ${item.start || ''}-${item.end || ''} ${item.room ? `(${item.room})` : ''}`.trim(),
            }));
    }, [scheduleEvents]);

    // Calculate last activity from activityData
    const lastActivityTimestamp = useMemo(() => {
        if (!activityData || activityData.length === 0) return null;
        
        // Sort by timestamp descending and get the most recent
        const sorted = [...activityData].sort((a, b) => {
            const timeA = new Date(a.timestamp || a.time || a.date || 0).getTime();
            const timeB = new Date(b.timestamp || b.time || b.date || 0).getTime();
            return timeB - timeA;
        });
        
        return sorted[0]?.timestamp || sorted[0]?.time || sorted[0]?.date || formData?.lastActivity;
    }, [activityData, formData?.lastActivity]);

    useEffect(() => {
        setSelectedScheduleIds((prev) => {
            if (!prev?.length) return prev;
            const allowed = new Set(scheduleOptions.map((opt) => opt.value));
            const next = prev.filter((id) => allowed.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [scheduleOptions]);

    // Clear subjects when program or faculty changes (to avoid invalid course selections)
    useEffect(() => {
        if (!isEditing || !formData) return;
        
        const currentSubjects = formData.subjects || [];
        if (currentSubjects.length === 0) return;
        
        // Filter out subjects that don't match current program/faculty
        const validSubjects = currentSubjects.filter(code => {
            const course = filteredCourses.find(c => c.value === code);
            return !!course; // Keep only if course is in filtered list
        });
        
        if (validSubjects.length !== currentSubjects.length) {
            setField('subjects', validSubjects);
        }
    }, [formData?.program, formData?.faculty, filteredCourses, isEditing]);

    const trimmedReassignTarget = (reassignTargetEmail || '').trim().toLowerCase();
    const teacherEmail = (teacher?.email || '').trim().toLowerCase();
    const canManageSchedule = typeof onReassignSchedule === 'function';
    const isValidReassignTarget = trimmedReassignTarget ? isEmail(trimmedReassignTarget) : false;
    const isSameAsTeacher = trimmedReassignTarget === teacherEmail;
    const scheduleSelectionCount = selectedScheduleIds.length;
    const disableReassignAction = !canManageSchedule || !isValidReassignTarget || isSameAsTeacher || scheduleSelectionCount === 0 || isReassigningSchedule;

    const timeOptions = useMemo(() => {
        if (minMinutes == null || maxMinutes == null || !Number.isFinite(timeStep)) return [];
        const opts = [];
        for (let mins = minMinutes; mins <= maxMinutes; mins += timeStep) {
            opts.push({ value: minutesToTime(mins), label: minutesToLabel(mins) });
        }
        return opts;
    }, [minMinutes, maxMinutes, timeStep]);

    if (!isOpen || !teacher) return null;

    const setFieldSynced = (k, v) => {
        setDirty(true);
        setFormData((prev) => {
            const next = { ...prev, [k]: v };
            if (k === 'location') next.office = parseOfficeFromLocation(v) || prev.office || '';
            return ensureProfileShape(next);
        });
        if (isYou) {
            setSelfProfile((prev) => {
                const next = { ...prev, [k]: v };
                if (k === 'location') next.office = parseOfficeFromLocation(v) || prev.office || '';
                return ensureProfileShape(next);
            });
        }
    };

    const setField = (k, v) => {
        setDirty(true);
        setFormData((prev) => ensureProfileShape({ ...prev, [k]: v }));
    };

    const safeClose = () => {
        if (isEditing && dirty && !window.confirm('Discard changes and close?')) return;
        onClose?.();
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const officeFromLocation = parseOfficeFromLocation(eff('location') || '');
            const payload = ensureProfileShape({
                ...formData,
                officeHours: effectiveOH,
                classesCount: clamp(formData.classesCount, 0, 12),
                yearsExperience: clamp(formData.yearsExperience, 0, 50),
                rating: clamp(formData.rating, 0, 5),
                email: eff('email'),
                phone: eff('phone'),
                location: eff('location'),
                office: officeFromLocation || formData.office || '',
                faculty: formData.faculty || 'FEI',
                department: formData.department || '',
                departmentCode: formData.departmentCode || '',
                program: formData.program || '',
                subjects: formData.subjects || [],
                academicDegree: formData.academicDegree || '',
                expertise: formData.expertise || [],
                researchInterests: formData.researchInterests || [],
                publications: formData.publications || [],
                languages: formData.languages || [],
                socialLinks: formData.socialLinks || {}
            });

            if (isYou) {
                const merged = ensureProfileShape({
                    ...selfProfile,
                    name: payload.name ?? selfProfile.name,
                    email: payload.email ?? selfProfile.email,
                    department: payload.department ?? selfProfile.department,
                    officeHours: payload.officeHours,
                    certifications: selfProfile.certifications,
                    phone: payload.phone ?? selfProfile.phone,
                    location: payload.location ?? selfProfile.location,
                    office: payload.office || parseOfficeFromLocation(payload.location || selfProfile.location || '') || selfProfile.office
                });
                setSelfProfile(() => merged);
                try { window.dispatchEvent(new CustomEvent('mais:profile-updated', { detail: merged })); } catch {}
                try { window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'profile' } })); } catch {}
            }

            await onSave?.(payload, { keepOpen: true });
            setIsEditing(false);
            setDirty(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (dirty && !window.confirm('Discard changes?')) return;
        setFormData(ensureProfileShape(teacher || {}));
        setIsEditing(false);
        setDirty(false);
    };

    const handleScheduleReassign = async () => {
        if (disableReassignAction) return;
        setIsReassigningSchedule(true);
        try {
            const result = await onReassignSchedule?.({
                targetEmail: trimmedReassignTarget,
                eventIds: selectedScheduleIds,
                sourceEmail: eff('email') || teacher?.email || '',
            });
            if (result?.ok) {
                setSelectedScheduleIds([]);
                setScheduleReloadKey((prev) => prev + 1);
            }
        } finally {
            setIsReassigningSchedule(false);
        }
    };

    const handleRateTeacher = async (rating) => {
        if (!teacher?.id || !userProfile?.studentId) return;
        
        try {
            await rateTeacher(teacher.id, {
                studentId: userProfile.studentId,
                rating: rating,
                comment: ''
            });
            
            // Reload user's rating
            const result = await getStudentRating(teacher.id, userProfile.studentId);
            setUserRating(result?.hasRated ? result : null);
            
            // Update teacher's overall rating in formData
            if (onSave) {
                setFormData(prev => ({ ...prev, rating: result?.averageRating || prev.rating }));
            }
        } catch (err) {
            console.error('[FacultyProfileModal] Failed to rate teacher:', err);
        }
    };

    const updateOH = (producer) => {
        setDirty(true);
        if (isYou) {
            setSelfProfile((prev) => {
                const prevOH = prev.officeHours || {};
                const nextOH = producer(prevOH);
                return ensureProfileShape({ ...prev, officeHours: nextOH });
            });
        }
        setFormData((prev) => {
            const prevOH = prev.officeHours || {};
            const nextOH = producer(prevOH);
            return ensureProfileShape({ ...prev, officeHours: nextOH });
        });
    };

    const renderProfileTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="min-w-0 w-full">
                            {isEditing ? (
                                <Input
                                    label="Full name"
                                    value={controlled(eff('name'))}
                                    onChange={(e) => setFieldSynced('name', e?.target?.value)}
                                    className={!String(eff('name') || '').trim() ? invalidCls : ''}
                                />
                            ) : (
                                <div>
                                    <label className="block text-sm text-muted-foreground">Full name</label>
                                    <div className="text-sm text-foreground truncate">{isYou ? displayNameSelf || eff('name') || '—' : eff('name') || '—'}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="min-w-0 w-full">
                            {isEditing ? (
                                <Input
                                    label="Email"
                                    type="email"
                                    value={controlled(eff('email'))}
                                    onChange={(e) => setFieldSynced('email', e?.target?.value)}
                                    className={!isEmail(eff('email') || '') ? invalidCls : ''}
                                />
                            ) : (
                                <div>
                                    <label className="block text-sm text-muted-foreground">Email</label>
                                    <a href={`mailto:${eff('email') || ''}`} className="text-sm text-foreground underline underline-offset-4 truncate">
                                        {eff('email') || '—'}
                                    </a>
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 w-full">
                            {isEditing ? (
                                <Input
                                    label="Phone"
                                    value={controlled(eff('phone'))}
                                    onChange={(e) => setFieldSynced('phone', e?.target?.value)}
                                />
                            ) : (
                                <div>
                                    <label className="block text-sm text-muted-foreground">Phone</label>
                                    <a href={`tel:${eff('phone') || ''}`} className="text-sm text-foreground truncate">
                                        {eff('phone') || '—'}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="min-w-0 w-full">
                        <label className="block text-sm font-medium text-foreground">Office / Location</label>
                        {isEditing ? (
                            <Select
                                value={controlled(eff('location'))}
                                onChange={(v) => setFieldSynced('location', v)}
                                options={[
                                    { value: '', label: 'Select office room...' },
                                    ...rooms.map(r => ({
                                        value: r.name,
                                        label: `${r.name}${r.building ? ` (${r.building})` : ''}${r.floor ? `, Floor ${r.floor}` : ''}`
                                    }))
                                ]}
                                placeholder="Select office room..."
                                searchable={true}
                            />
                        ) : (
                            <div className="text-sm text-foreground break-words">{eff('location') || '—'}</div>
                        )}
                        {isEditing && rooms.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                No rooms available. Please add rooms in Resource Management first.
                            </p>
                        )}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <Button size="xs" variant="ghost" iconName="Copy" onClick={() => navigator.clipboard?.writeText(String(eff('location') || ''))}>Copy</Button>
                            <a
                                className="text-xs underline text-muted-foreground hover:text-foreground"
                                href={`https://www.google.com/maps/search/${encodeURIComponent(eff('location') || '')}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open map
                            </a>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="min-w-0">
                            {isEditing ? (
                                <Select
                                    label="Faculty"
                                    value={controlled(formData?.faculty)}
                                    onChange={(v) => setField('faculty', v)}
                                    options={facultyOptions.filter(f => f.active).map(f => ({ 
                                        value: f.code, 
                                        label: `${f.code} - ${f.nameEn}` 
                                    }))}
                                    placeholder="Select faculty..."
                                    searchable={true}
                                    clearable={false}
                                />
                            ) : (
                                <>
                                    <label className="block text-sm font-medium text-foreground">Faculty</label>
                                    <div className="text-sm text-foreground mt-1">
                                        {(() => {
                                            const fac = facultyOptions.find(f => f.code === formData?.faculty);
                                            return fac ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">
                                                    {fac.code} - {fac.nameEn}
                                                </span>
                                            ) : formData?.faculty ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">
                                                    {formData.faculty}
                                                </span>
                                            ) : '—';
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="min-w-0">
                            {isEditing ? (
                                <Select
                                    label="Department"
                                    value={controlled(formData?.department)}
                                    onChange={(v) => {
                                        const dept = departments.find(d => d.name === v);
                                        setField('department', v);
                                        setField('departmentCode', dept?.code || '');
                                    }}
                                    options={filteredDepartments.map(d => ({ value: d.name, label: d.name }))}
                                    placeholder="Select department..."
                                    searchable={true}
                                    clearable={true}
                                />
                            ) : (
                                <>
                                    <label className="block text-sm font-medium text-foreground">Department</label>
                                    <div className="text-sm text-foreground break-words mt-1">
                                        {formData?.department || '—'}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="min-w-0">
                            {isEditing ? (
                                <Select
                                    label="Program"
                                    value={controlled(formData?.program)}
                                    onChange={(v) => setField('program', v)}
                                    options={filteredPrograms.map(p => ({ value: p.name, label: p.name }))}
                                    placeholder="Select program..."
                                    searchable={true}
                                    clearable={true}
                                />
                            ) : (
                                <>
                                    <label className="block text-sm font-medium text-foreground">Program</label>
                                    <div className="text-sm text-foreground break-words mt-1">
                                        {formData?.program || '—'}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="min-w-0 w-full">
                        {isEditing ? (
                            <MultiSelect
                                label="Subjects (Courses)"
                                value={formData?.subjects || []}
                                onChange={(vals) => setField('subjects', vals)}
                                options={filteredCourses}
                                placeholder={formData?.program ? "Select courses for this program..." : "Select program first to see available courses"}
                                disabled={!formData?.program}
                            />
                        ) : (
                            <>
                                <label className="block text-sm font-medium text-foreground">Subjects (Courses)</label>
                                <div className="text-sm text-foreground break-words mt-1">
                                    {(formData?.subjects || []).length > 0 ? (
                                        (formData?.subjects || []).map(subj => {
                                            const course = coursesOptions.find(c => c.value === subj);
                                            return course ? course.label : subj;
                                        }).join(', ')
                                    ) : '—'}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <span className="block text-sm text-muted-foreground">Employment Type</span>
                            {isEditing ? (
                                <Select options={typeOpts} value={controlled(formData?.employmentType) || 'full-time'} onChange={(v) => setField('employmentType', v)} className="mt-1 w-full" />
                            ) : (
                                <div className="mt-2 text-sm capitalize">{formData?.employmentType || '—'}</div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-6 sm:mt-8">
                            <StatusBadge status={formData?.status} />
                            <span className="text-xs text-muted-foreground">Status</span>
                        </div>
                    </div>

                    <div>
                        {isEditing ? (
                            <Textarea
                                label="About"
                                minRows={4}
                                value={controlled(eff('about'))}
                                onChange={(e) => setFieldSynced('about', e?.target?.value)}
                            />
                        ) : (
                            <>
                                <label className="block text-sm font-medium mb-1 text-foreground">About</label>
                                <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                                    {eff('about') || '—'}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <span className="text-sm text-muted-foreground">Employee ID</span>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-sm font-mono lowercase truncate">{formData?.employeeId || '—'}</span>
                                <Button type="button" size="xs" variant="ghost" onClick={() => navigator.clipboard?.writeText(formData?.employeeId || '')}>
                                    Copy
                                </Button>
                            </div>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Last Activity</span>
                            <div className="mt-1 text-sm text-muted-foreground">
                                {lastActivityTimestamp ? fmtDateLong(lastActivityTimestamp) : '—'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Social Links */}
            <div className="border-t border-border pt-6">
                <h4 className="text-base font-semibold text-foreground mb-4">Social Links</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        {isEditing ? (
                            <Input
                                label="LinkedIn"
                                value={controlled(formData?.socialLinks?.linkedin)}
                                onChange={(e) => setField('socialLinks', { ...formData?.socialLinks, linkedin: e.target.value })}
                                placeholder="https://linkedin.com/in/..."
                            />
                        ) : formData?.socialLinks?.linkedin ? (
                            <>
                                <span className="text-sm text-muted-foreground">LinkedIn</span>
                                <div className="mt-1">
                                    <a href={formData.socialLinks.linkedin} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                                        {formData.socialLinks.linkedin}
                                    </a>
                                </div>
                            </>
                        ) : null}
                    </div>
                    <div>
                        {isEditing ? (
                            <Input
                                label="ResearchGate"
                                value={controlled(formData?.socialLinks?.researchgate)}
                                onChange={(e) => setField('socialLinks', { ...formData?.socialLinks, researchgate: e.target.value })}
                                placeholder="https://researchgate.net/profile/..."
                            />
                        ) : formData?.socialLinks?.researchgate ? (
                            <>
                                <span className="text-sm text-muted-foreground">ResearchGate</span>
                                <div className="mt-1">
                                    <a href={formData.socialLinks.researchgate} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                                        {formData.socialLinks.researchgate}
                                    </a>
                                </div>
                            </>
                        ) : null}
                    </div>
                    <div>
                        {isEditing ? (
                            <Input
                                label="ORCID"
                                value={controlled(formData?.socialLinks?.orcid)}
                                onChange={(e) => setField('socialLinks', { ...formData?.socialLinks, orcid: e.target.value })}
                                placeholder="https://orcid.org/..."
                            />
                        ) : formData?.socialLinks?.orcid ? (
                            <>
                                <span className="text-sm text-muted-foreground">ORCID</span>
                                <div className="mt-1">
                                    <a href={formData.socialLinks.orcid} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                                        {formData.socialLinks.orcid}
                                    </a>
                                </div>
                            </>
                        ) : null}
                    </div>
                    <div>
                        {isEditing ? (
                            <Input
                                label="Google Scholar"
                                value={controlled(formData?.socialLinks?.googleScholar)}
                                onChange={(e) => setField('socialLinks', { ...formData?.socialLinks, googleScholar: e.target.value })}
                                placeholder="https://scholar.google.com/..."
                            />
                        ) : formData?.socialLinks?.googleScholar ? (
                            <>
                                <span className="text-sm text-muted-foreground">Google Scholar</span>
                                <div className="mt-1">
                                    <a href={formData.socialLinks.googleScholar} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                                        {formData.socialLinks.googleScholar}
                                    </a>
                                </div>
                            </>
                        ) : null}
                    </div>
                    <div className="md:col-span-2">
                        {isEditing ? (
                            <Input
                                label="Personal Website"
                                value={controlled(formData?.socialLinks?.website)}
                                onChange={(e) => setField('socialLinks', { ...formData?.socialLinks, website: e.target.value })}
                                placeholder="https://..."
                            />
                        ) : formData?.socialLinks?.website ? (
                            <>
                                <span className="text-sm text-muted-foreground">Personal Website</span>
                                <div className="mt-1">
                                    <a href={formData.socialLinks.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                                        {formData.socialLinks.website}
                                    </a>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Expertise */}
            {(isEditing || (formData?.expertise && formData.expertise.length > 0)) && (
                <div className="border-t border-border pt-6">
                    <h4 className="text-base font-semibold text-foreground mb-3">Areas of Expertise</h4>
                    {isEditing ? (
                        <Input
                            label="Enter expertise areas (comma-separated)"
                            value={controlled((formData?.expertise || []).join(', '))}
                            onChange={(e) => setField('expertise', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="Forensic Analysis, Network Security, Ethical Hacking..."
                        />
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {formData.expertise.map((exp, idx) => (
                                <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                    {exp}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Research Interests */}
            {(isEditing || (formData?.researchInterests && formData.researchInterests.length > 0)) && (
                <div className="border-t border-border pt-6">
                    <h4 className="text-base font-semibold text-foreground mb-3">Research Interests</h4>
                    {isEditing ? (
                        <Input
                            label="Enter research interests (comma-separated)"
                            value={controlled((formData?.researchInterests || []).join(', '))}
                            onChange={(e) => setField('researchInterests', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="Digital Forensics, Network Security, Malware Analysis..."
                        />
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {formData.researchInterests.map((interest, idx) => (
                                <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                    {interest}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Publications */}
            {formData?.publications && Array.isArray(formData.publications) && formData.publications.length > 0 && (
                <div className="border-t border-border pt-6">
                    <h4 className="text-base font-semibold text-foreground mb-3">Publications</h4>
                    <div className="space-y-3">
                        {formData.publications.map((pub, idx) => (
                            <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border">
                                <div className="font-medium text-sm text-foreground">{pub.title}</div>
                                {pub.journal && <div className="text-xs text-muted-foreground mt-1">{pub.journal}</div>}
                                {pub.year && <div className="text-xs text-muted-foreground mt-0.5">Year: {pub.year}</div>}
                                {pub.url && (
                                    <a href={pub.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">
                                        View publication
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Languages */}
            {formData?.languages && Array.isArray(formData.languages) && formData.languages.length > 0 && (
                <div className="border-t border-border pt-6">
                    <h4 className="text-base font-semibold text-foreground mb-3">Languages</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {formData.languages.map((lang, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border">
                                <span className="text-sm font-medium text-foreground">{lang.language}</span>
                                <span className="text-xs text-muted-foreground">{lang.proficiency}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderEmploymentTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isEditing && (
                    <div>
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Select options={statusOpts} value={controlled(formData?.status) || 'active'} onChange={(v) => setField('status', v)} className="mt-1 w-full" />
                    </div>
                )}
                <div>
                    <span className="text-sm text-muted-foreground">Employment Type</span>
                    {isEditing ? (
                        <Select options={typeOpts} value={controlled(formData?.employmentType) || 'full-time'} onChange={(v) => setField('employmentType', v)} className="mt-1 w-full" />
                    ) : (
                        <div className="mt-2 capitalize text-sm">{formData?.employmentType || '—'}</div>
                    )}
                </div>
                <div>
                    <span className="text-sm text-muted-foreground">Classes Load</span>
                    {isEditing ? (
                        <Input
                            type="number"
                            value={formData?.classesCount ?? 0}
                            onChange={(e) => setField('classesCount', clamp(e.target.value, 0, 12))}
                            onWheel={preventWheel}
                            onKeyDown={blockBadKeysInt}
                            min={0}
                            max={12}
                            className="mt-1"
                        />
                    ) : (
                        <div className="mt-2 text-sm">{formData?.classesCount ?? '—'}</div>
                    )}
                </div>
                <div>
                    <span className="text-sm text-muted-foreground">Hire Date</span>
                    {isEditing ? (
                        <Input type="date" value={controlled((formData?.hireDate || '').slice(0, 10))} onChange={(e) => setField('hireDate', e.target.value)} className="mt-1" />
                    ) : (
                        <div className="mt-2 text-sm">{fmtDateLong(formData?.hireDate)}</div>
                    )}
                </div>
                <div>
                    <span className="text-sm text-muted-foreground">Experience (years)</span>
                    {isEditing ? (
                        <Input
                            type="number"
                            value={formData?.yearsExperience ?? 0}
                            onChange={(e) => setField('yearsExperience', clamp(e.target.value, 0, 50))}
                            onWheel={preventWheel}
                            onKeyDown={blockBadKeysInt}
                            min={0}
                            max={50}
                            className="mt-1"
                        />
                    ) : (
                        <div className="mt-2 text-sm">{clamp(formData?.yearsExperience ?? 0, 0, 50)} yrs</div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderCertsTab = () => {
        const certsEffective = isYou ? selfProfile?.certifications || [] : Array.isArray(formData?.certifications) ? formData.certifications : [];
        const handleCertsChange = (next) => {
            if (isYou) setSelfProfile((prev) => ensureProfileShape({ ...prev, certifications: next }));
            setField('certifications', next);
        };
        return <CertificatesPanel certs={certsEffective} editable={isEditing} onChange={handleCertsChange} />;
    };

    const renderScheduleTab = () => (
        <div className="space-y-6">
            <div>
                <h4 className="text-sm font-medium mb-2">Teaching Schedule</h4>
                <TeachingSchedule email={eff('email') || teacher?.email || ''} refreshToken={scheduleReloadKey} />
            </div>
            <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h5 className="text-sm font-semibold">Reassign classes</h5>
                        <p className="text-xs text-muted-foreground">Move selected classes to another teacher (including yourself).</p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setScheduleReloadKey((prev) => prev + 1)}
                        disabled={isScheduleLoading}
                    >
                        {isScheduleLoading ? 'Refreshing…' : 'Refresh list'}
                    </Button>
                </div>
                {!canManageSchedule ? (
                    <div className="text-xs text-muted-foreground">Schedule reassignment is not available in this context.</div>
                ) : (
                    <>
                        {isScheduleLoading ? (
                            <div className="text-xs text-muted-foreground">Loading schedule…</div>
                        ) : scheduleOptions.length === 0 ? (
                            <div className="text-xs text-muted-foreground">No classes available for reassignment.</div>
                        ) : (
                            <MultiSelect
                                value={selectedScheduleIds}
                                onChange={setSelectedScheduleIds}
                                options={scheduleOptions}
                                placeholder="Select classes"
                            />
                        )}
                        <div className="space-y-1">
                            <Input
                                label="Target teacher email"
                                type="email"
                                value={controlled(reassignTargetEmail)}
                                onChange={(e) => setReassignTargetEmail(e?.target?.value)}
                                placeholder="teacher@example.com"
                                className={(!isValidReassignTarget && reassignTargetEmail) || isSameAsTeacher ? invalidCls : ''}
                            />
                            {isSameAsTeacher && (
                                <div className="text-xs text-destructive">Cannot reassign classes to the same teacher.</div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedScheduleIds([])}
                                disabled={selectedScheduleIds.length === 0 || isReassigningSchedule}
                            >
                                Clear selection
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => primaryEmail && primaryEmail.toLowerCase() !== teacherEmail && setReassignTargetEmail(primaryEmail)}
                                disabled={!primaryEmail || primaryEmail.toLowerCase() === teacherEmail || isReassigningSchedule}
                                title={primaryEmail?.toLowerCase() === teacherEmail ? "You are viewing your own profile" : undefined}
                            >
                                Assign to me
                            </Button>
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                iconName={isReassigningSchedule ? 'Loader2' : 'Share2'}
                                onClick={handleScheduleReassign}
                                disabled={disableReassignAction}
                            >
                                {isReassigningSchedule ? 'Assigning…' : 'Reassign classes'}
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {scheduleSelectionCount === 0
                                ? 'No classes selected.'
                                : `${scheduleSelectionCount} class${scheduleSelectionCount === 1 ? '' : 'es'} selected.`}
                        </div>
                    </>
                )}
            </div>
            <div>
                {!scheduleValidation.isValid && (
                    <div className="p-3 mb-2 rounded-md border border-warning/40 bg-warning/10 text-xs text-warning-foreground">Fix office hours errors before saving.</div>
                )}
                <div className="text-xs text-muted-foreground mb-2">
                    Office hours — allowed: {TEACHER_MIN}–{TEACHER_MAX}, min {MIN_STEP_MIN}m, max {MAX_DURATION_MIN / 60}h. Weekends: {ALLOW_WEEKENDS ? 'allowed' : 'not allowed'}.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {Days.map((d, index) => {
                        const raw = effectiveOH?.[d] || {};
                        const base = normalizeOH(raw);
                        const start = alignToStep(base.start || '09:00', { min: minMinutes, max: maxMinutes, step: timeStep }) || minutesToTime(minMinutes ?? 0);
                        const end = alignToStep(base.end || '11:00', { min: minMinutes, max: maxMinutes, step: timeStep }) || minutesToTime(Math.min((minMinutes ?? 0) + timeStep, maxMinutes ?? 0));
                        const on = !!base.enabled;
                        const weekend = d === 'Sat' || d === 'Sun';
                        const weekendBlocked = weekend && !ALLOW_WEEKENDS;
                        const canInteract = isEditing && !weekendBlocked;

                        const toggle = () => {
                            if (!canInteract) return;
                            updateOH((prev) => {
                                const prevDay = normalizeOH(prev[d] || {});
                                return { ...prev, [d]: { ...prevDay, enabled: !on, start, end } };
                            });
                        };
                        const setStart = (v) => {
                            const snapped = alignToStep(v, { min: minMinutes, max: maxMinutes, step: timeStep }) || minutesToTime(minMinutes ?? 0);
                            updateOH((prev) => {
                                const prevDay = normalizeOH(prev[d] || {});
                                return { ...prev, [d]: { ...prevDay, start: snapped, enabled: true } };
                            });
                        };
                        const setEnd = (v) => {
                            const snapped = alignToStep(v, { min: minMinutes, max: maxMinutes, step: timeStep }) || minutesToTime(Math.min((minMinutes ?? 0) + timeStep, maxMinutes ?? 0));
                            updateOH((prev) => {
                                const prevDay = normalizeOH(prev[d] || {});
                                return { ...prev, [d]: { ...prevDay, end: snapped, enabled: true } };
                            });
                        };

                        const err = scheduleValidation.errors[d];

                        return (
                            <motion.div
                                key={d}
                                className={`metric-card w-full p-3 sm:p-4 space-y-3 ${!canInteract ? 'opacity-80' : ''} ${err ? 'ring-1 ring-destructive/40 border-destructive/60' : ''}`}
                                initial={{ opacity: 0, y: 14 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.32, delay: index * 0.035, ease: 'easeOut' }}
                                whileHover={{ y: canInteract ? -3 : 0, scale: canInteract ? 1.01 : 1 }}
                                whileTap={{ scale: 0.995 }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{DAY_LABELS[d] || d}</span>
                                            {weekend && <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">Weekend</span>}
                                        </div>
                                        {on && !weekendBlocked && !err?.length && (
                                            <div className="mt-1 text-xs text-muted-foreground">{formatTimeRange(start, end)}</div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggle}
                                        disabled={!canInteract}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? 'bg-primary' : 'bg-muted'} ${!canInteract ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        aria-pressed={on ? 'true' : 'false'}
                                        aria-label={`Toggle office hours for ${DAY_LABELS[d] || d}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-background transition ${on ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Select
                                        options={timeOptions}
                                        value={start}
                                        onChange={(v) => setStart(v)}
                                        disabled={!on || !canInteract}
                                        placeholder="Start"
                                        className={`w-full ${err ? invalidCls : ''}`}
                                        size="sm"
                                    />
                                    <Select
                                        options={timeOptions}
                                        value={end}
                                        onChange={(v) => setEnd(v)}
                                        disabled={!on || !canInteract}
                                        placeholder="End"
                                        className={`w-full ${err ? invalidCls : ''}`}
                                        size="sm"
                                    />
                                </div>
                                <div className="text-xs">
                                    {weekendBlocked && <div className="text-destructive">Weekends are not allowed</div>}
                                    {!on && !weekendBlocked && <div className="text-muted-foreground">No office hours</div>}
                                    {on && !weekendBlocked && err?.length > 0 && (
                                        <div className="text-destructive">{err.join(' • ')}</div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderActivityTab = () => {
        const activities = activityData.length > 0 ? activityData : (formData?.activity || []);
        const iconMap = {
            submissions: 'FileText',
            communications: 'MessageCircle',
            attendance: 'Users',
            grades: 'Award',
            announcements: 'Bell',
            schedule: 'Calendar'
        };
        
        return (
            <div className="space-y-4">
                <h4 className="text-lg font-medium text-foreground">Recent Activity</h4>
                {isActivityLoading ? (
                    <div className="text-sm text-muted-foreground py-4">Loading activities...</div>
                ) : activities.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">No recent activity</div>
                ) : (
                    <ul className="space-y-2">
                        {activities.map((a) => (
                            <li key={a.id || a.ts} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                                <div className="w-8 h-8 bg-primary rounded-full grid place-items-center flex-shrink-0">
                                    <Icon name={iconMap[a.type] || a.icon || 'Activity'} size={16} className="text-primary-foreground" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm text-foreground">{a.title || a.text || 'Activity'}</div>
                                    {a.description && <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>}
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {new Date(a.timestamp || a.ts || a.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'profile':
                return renderProfileTab();
            case 'employment':
                return renderEmploymentTab();
            case 'certs':
                return renderCertsTab();
            case 'schedule':
                return renderScheduleTab();
            case 'activity':
                return renderActivityTab();
            default:
                return renderProfileTab();
        }
    };

    return (
        <div className="fixed inset-0 z-110 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-6 pb-24 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-background/80 backdrop-blur-sm" onClick={safeClose} />
                <div className="relative inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border">
                    <div className="absolute top-2 right-2 md:top-3 md:right-3 z-40">
                        <Button variant="ghost" size="icon" onClick={safeClose} aria-label="Close dialog">
                            <Icon name="X" size={20} />
                        </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pl-5 pr-14 md:pl-6 md:pr-16 py-4 md:py-5 border-b border-border sticky top-0 z-30 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <div className="min-w-0 flex items-center gap-3">
                            <Avatar 
                                name={(eff('name') || `${eff('firstName') || ''} ${eff('lastName') || ''}` || '').trim() || '—'} 
                                src={eff('avatarUrl') || null} 
                                size={48} 
                                rounded 
                                className="ring-2 ring-border flex-shrink-0" 
                            />
                            <div className="min-w-0">
                                <h3 className="text-lg md:text-xl font-semibold text-foreground truncate">
                                    {(eff('name') || `${eff('firstName') || ''} ${eff('lastName') || ''}` || '').trim() || '—'}
                                </h3>
                                <div className="text-xs text-muted-foreground truncate">
                                    {(eff('department') || 'Department')} • {(formData?.employmentType || 'full-time').replace('-', ' ')}
                                </div>
                                {/* Teacher Rating - Always visible */}
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map((star) => {
                                            const avgRating = formData?.rating || 0;
                                            const currentRating = userRating?.rating || 0;
                                            const displayRating = isYou ? avgRating : (hoverRating || currentRating || avgRating);
                                            const isFilled = star <= displayRating;
                                            
                                            return (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => !isYou && handleRateTeacher(star)}
                                                    onMouseEnter={() => !isYou && setHoverRating(star)}
                                                    onMouseLeave={() => !isYou && setHoverRating(0)}
                                                    className={`p-0.5 transition-transform ${!isYou ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
                                                    disabled={isYou || isRatingLoading}
                                                >
                                                    <Icon 
                                                        name="Star"
                                                        size={14} 
                                                        className={isFilled ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-muted-foreground stroke-2'} 
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {formData?.rating ? `${Number(formData.rating).toFixed(1)} avg` : 'Not rated'}
                                    </span>
                                    {!isYou && userRating?.rating && (
                                        <span className="text-xs text-primary">
                                            (Your rating: {userRating.rating})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:ml-auto">
                            {!NON_EDIT_TABS.includes(activeTab) && !readOnly && (
                                isEditing ? (
                                    <>
                                        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                                        <Button variant="default" onClick={handleSave} iconName={isSaving ? 'Loader2' : 'Save'}>
                                            {isSaving ? 'Saving…' : 'Save Changes'}
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="outline" iconName="Edit" onClick={() => setIsEditing(true)}>
                                        Edit
                                    </Button>
                                )
                            )}
                        </div>
                    </div>

                    <div className="border-b border-border bg-card">
                        <div className="relative">
                            <div className="overflow-x-auto md:overflow-x-visible overscroll-contain px-4" role="tablist" aria-label="Profile tabs">
                                <div className="flex md:flex-wrap items-center gap-4 min-w-max md:min-w-0">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            role="tab"
                                            aria-selected={activeTab === tab.id ? 'true' : 'false'}
                                            className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                                                activeTab === tab.id
                                                    ? 'border-primary text-primary'
                                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                                            }`}
                                        >
                                            <Icon name={tab.icon} size={16} />
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-5 md:px-6 py-5 md:py-6 max-h-[66vh] overflow-y-auto thin-scrollbar">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FacultyProfileModal;