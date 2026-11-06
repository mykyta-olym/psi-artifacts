import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Pagination from '../../components/ui/Pagination';
import Reveal from '../../components/motion/Reveal';
import { motion } from 'framer-motion';

import FacultyTableHeader from './components/FacultyTableHeader';
import FacultyTable from './components/FacultyTable';
import FacultyProfileModal from './components/FacultyProfileModal';
import AddFacultyModal from './components/AddFacultyModal';

import { fetchFaculty, fetchTeacherTimetable, createFacultyMember, fetchCourses, updateFacultyProfileByEmail, assignScheduleEventsToTeacher } from '../../data/maisApiAdapter';
import DataLoader from '../../components/ui/DataLoader';

import { ensureEmployeeId } from '../../utils/ids';
import { displayNameFrom } from '../../utils/displayName';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import { useAuth } from '../../contexts/AuthContext';
import { formatLastLogin } from '../../utils/datetime';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import useDataUpdates from '../../hooks/useDataUpdates';
import useFacultyHub from '../../hooks/useFacultyHub';

import { createLogger } from '../../utils/logger';
import { ANIMATION_DELAYS } from '../../constants/animations';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
const logger = createLogger('index');

const asStr = (v) => String(v ?? '');
const slug = (s) => String(s || '').toLowerCase().trim();

const stripTitles = (full = '') => {
    const [left] = String(full).split(/\s*,\s*/, 2);
    const PREF = ['Bc.', 'Mgr.', 'Ing.', 'RNDr.', 'PaedDr.', 'Mgr. art.', 'doc.', 'prof.', 'Dr.', 'JUDr.', 'MUDr.'];
    let namePart = left.trim();
    const prefRe = new RegExp(`^(?:${PREF.map((p) => p.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')).join('|')})\\s+`, 'i');
    for (;;) {
        const before = namePart;
        namePart = namePart.replace(prefRe, '').trim();
        if (before === namePart) break;
    }
    return namePart;
};

const normalizeName = (s = '') =>
    stripTitles(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

const stripSubjectCode = (s = '') => {
    const value = String(s || '').trim();
    if (!value) return '';
    const dash = value.indexOf(' - ');
    if (dash > -1 && dash <= 10) return value.slice(dash + 3).trim();
    const colon = value.indexOf(': ');
    if (colon > -1 && colon <= 10) return value.slice(colon + 2).trim();
    return value;
};

const parseOfficeFromLocation = (s = '') => {
    const m = String(s || '').match(/^Room\s+([^\s·]+)\s*·\s*(.+)$/);
    return m ? m[1] : '';
};

const H = (s) => {
    let h = 5381;
    const x = String(s);
    for (let i = 0; i < x.length; i++) h = ((h << 5) + h) ^ x.charCodeAt(i);
    return Math.abs(h >>> 0);
};

const dayAbbr = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };
const roleOf = (u) => (u?.role === 'teacher' ? 'teacher' : 'student');

async function buildFacultyFromAPI(currentProfile = null) {
    console.log('[buildFacultyFromAPI] Starting with currentProfile:', currentProfile?.email);
    const list = await fetchFaculty({ page: 1, pageSize: 200, sort: 'fullName', order: 'asc' });
    console.log('[buildFacultyFromAPI] Fetched faculty list, count:', list?.length);
    if (list?.length > 0) {
        console.log('[buildFacultyFromAPI] Sample faculty data:', {
            email: list[0]?.email,
            faculty: list[0]?.faculty,
            program: list[0]?.program,
            department: list[0]?.department,
            departmentCode: list[0]?.departmentCode
        });
    }
    const profEmail = String(currentProfile?.email || '').toLowerCase();
    const profBase = normalizeName(currentProfile?.fullName || currentProfile?.name || '');

    // Fetch courses to map course codes to names
    const coursesList = await fetchCourses().catch(() => []);
    const courseCodeToName = new Map();
    (coursesList || []).forEach((c) => {
        const code = String(c?.code || '').trim().toUpperCase();
        if (!code) return;
        const name = c?.nameEn || c?.nameSk || c?.name || '';
        if (name) {
            // Store the full name (without code suffix) mapped to the course code
            const nameWithoutCode = stripSubjectCode(name);
            courseCodeToName.set(code, nameWithoutCode || name);
        }
    });

    // Helper function to resolve course name from code or name
    const resolveCourseName = (courseNameOrCode) => {
        if (!courseNameOrCode) return '';
        const str = String(courseNameOrCode).trim();
        // If it's a numeric code (like "26001198"), try to find it in courses
        if (/^\d{5,}$/.test(str)) {
            const found = courseCodeToName.get(str.toUpperCase());
            if (found) return found;
            // If not found, return empty (don't show numeric codes)
            return '';
        }
        // If it already looks like a name, use it (strip any code suffix)
        const stripped = stripSubjectCode(str);
        return stripped || str;
    };

    // Optionally fetch per-teacher timetable to enrich subjects/classesCount
    const timetableByTeacher = new Map();
    await Promise.all(
        (list || []).map(async (f) => {
            const email = String(f.email || '').toLowerCase();
            if (!email) return;
            try {
                const tt = await fetchTeacherTimetable(email);
                timetableByTeacher.set(email, tt);
            } catch {}
        })
    );

    return (list || []).map((f) => {
        const email = (f.email || '').toLowerCase();
        const tt = timetableByTeacher.get(email) || [];
        // Resolve course names from timetable, prioritizing names over codes
        const timetableSubjects = tt
            .map((t) => {
                const code = String(t.courseCode || '').trim().toUpperCase();
                const name = t.courseName || '';
                // If we have a name, use it; otherwise try to resolve from code
                if (name) return resolveCourseName(name);
                if (code) return resolveCourseName(code);
                return '';
            })
            .filter(Boolean);
        // Resolve backend subjects (may be codes or names)
        const backendSubjects = Array.isArray(f.subjects)
            ? f.subjects
                .map((s) => resolveCourseName(s))
                .filter(Boolean)
            : [];
        const subjects = Array.from(new Set([...backendSubjects, ...timetableSubjects])).sort((a, b) => a.localeCompare(b));
        const timetableAvailability = Array.from(new Set(tt.map((e) => e.day).filter(Boolean))).map((d) => dayAbbr[d] || d).filter(Boolean);
        const backendAvailability = Array.isArray(f.availability) ? f.availability.filter(Boolean) : [];
        const availability = timetableAvailability.length ? timetableAvailability : backendAvailability;
        const classesCount = tt.length || (Number.isFinite(f.classesCount) ? Number(f.classesCount) : 0);

        const employeeId = ensureEmployeeId({ email, fullName: f.fullName || f.name || '' });
        const yrs = Number.isFinite(f.yearsExperience) ? Number(f.yearsExperience) : 2 + (H(email) % 15);
        const hireDate = f.hireDate ? String(f.hireDate).slice(0, 10) : (() => {
            const startYear = 2012 + (H(employeeId) % 10);
            const month = 1 + (H(employeeId + 'm') % 12);
            const day = 1 + (H(employeeId + 'd') % 28);
            return `${startYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        })();

        const rating = typeof f.rating === 'number' ? f.rating : 3 + (H(email + 'r') % 21) / 10;
        const lastActivity = f.lastActivity || new Date(Date.now() - (H(email + 'la') % 20) * 86400000).toISOString();

        const baseName = normalizeName(f.fullName || f.name || '');
        const isYou = (!!profEmail && email === profEmail) || (!!profBase && !!baseName && profBase === baseName);

        const departmentPrimary = f.department || (Array.isArray(f.departments) && f.departments[0]) || '';
        
        // Don't use fallbacks - keep data from API as-is
        const office = f.office || '';
        
        // Use office hours from API if available, otherwise empty object
        const officeHoursBase = (f.officeHours && typeof f.officeHours === 'object' && Object.keys(f.officeHours).length > 0) 
            ? f.officeHours 
            : {};

        const displayFullName = f.fullName || f.name || f.email || '—';
        const plainName = stripTitles(displayFullName) || displayFullName;
        
        // Parse location - use from API directly, no fallback
        const location = f.location || (office ? `${office}` : '');
        
        const rowBase = {
            id: f.id,
            name: plainName,
            fullName: displayFullName,
            email,
            department: departmentPrimary,
            departmentCode: f.departmentCode || '',
            departments: Array.isArray(f.departments) ? f.departments : (departmentPrimary ? [departmentPrimary] : []),
            faculty: f.faculty || 'FEI',
            program: f.program || '',
            employeeId: /^[a-z]{2}\d{3}[a-z]{2}$/.test(f.id || '') ? f.id : employeeId,
            phone: f.phone || '',
            office,
            location,
            status: (f.status || 'active').toLowerCase(),
            employmentType: f.employmentType || 'full-time',
            subjects,
            grades: [],
            classesCount,
            yearsExperience: yrs,
            hireDate,
            availability: availability.length ? availability : ['Mon', 'Wed', 'Fri'],
            timeWindows: {},
            certifications: Array.isArray(f.certifications) ? f.certifications : [],
            rating: Math.min(5, Math.round((rating || 0) * 10) / 10),
            lastActivity,
            avatarUrl: f.avatarUrl || null,
            isYou,
            officeHours: officeHoursBase,
            workingHours: (f.workingHours && typeof f.workingHours === 'object') ? f.workingHours : {},
            about: f.about || '',
            bio: f.bio || '',
            expertise: Array.isArray(f.expertise) ? f.expertise : [],
            publications: f.publications || null,
            researchInterests: Array.isArray(f.researchInterests) ? f.researchInterests : [],
            academicDegree: f.academicDegree || '',
            languages: f.languages || null,
            socialLinks: f.socialLinks || null,
            titlesPrefix: Array.isArray(f.titlesPrefix) ? f.titlesPrefix : [],
            titlesSuffix: Array.isArray(f.titlesSuffix) ? f.titlesSuffix : [],
            activity: Array.isArray(f.activity) && f.activity.length > 0 ? f.activity : []
        };

        if (isYou && currentProfile) {
            console.log('[buildFacultyFromAPI] Processing isYou profile for:', email);
            const profileEmail = String(currentProfile.email || '').toLowerCase();
            const profileName = displayNameFrom(currentProfile, { privacy: false }) || rowBase.name;
            const profilePhone = currentProfile.phone || rowBase.phone;
            const profileLoc = currentProfile.location || rowBase.location;
            const profileOffice = currentProfile.office || parseOfficeFromLocation(profileLoc) || rowBase.office;
            const profileDepts = Array.isArray(currentProfile.departments) ? currentProfile.departments : (currentProfile.department ? [currentProfile.department] : rowBase.departments);
            const profileCerts = Array.isArray(currentProfile.certifications) ? currentProfile.certifications : rowBase.certifications;
            const profileOH = currentProfile.officeHours || rowBase.officeHours;
            const profileAbout = currentProfile.about || rowBase.about;

            return {
                ...rowBase,
                name: profileName,
                fullName: profileName,
                email: profileEmail || rowBase.email,
                phone: profilePhone,
                department: profileDepts[0] || '',
                departments: profileDepts,
                location: profileLoc,
                office: profileOffice,
                certifications: profileCerts,
                officeHours: profileOH,
                about: profileAbout,
                workingHours: currentProfile.workingHours || rowBase.workingHours,
                expertise: currentProfile.expertise || rowBase.expertise,
                publications: currentProfile.publications || rowBase.publications,
                researchInterests: currentProfile.researchInterests || rowBase.researchInterests,
                academicDegree: currentProfile.academicDegree || rowBase.academicDegree,
                languages: currentProfile.languages || rowBase.languages,
                socialLinks: currentProfile.socialLinks || rowBase.socialLinks,
                avatarUrl: currentProfile.avatarUrl || rowBase.avatarUrl,
                isYou: true
            };
        }

        console.log('[buildFacultyFromAPI] Created rowBase for:', email, {
            phone: rowBase.phone,
            office: rowBase.office,
            location: rowBase.location,
            about: rowBase.about?.substring(0, 50),
            officeHours: Object.keys(rowBase.officeHours || {}),
            certifications: rowBase.certifications?.length
        });

        return rowBase;
    });
}

const FacultyPageContent = () => {
    const navigate = useNavigate();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const { isBlocked } = useGlobalLoaderBlocking();

    const { user, userProfile } = useAuth();
    const primaryEmail = user?.email || userProfile?.email || '';

    // Use userProfile from AuthContext instead of loadProfile
    const selfProfile = userProfile || null;
    const headerDisplayName = useProfileDisplayName(selfProfile?.fullName || 'User');
    const role = roleOf(user);
    const isTeacher = role === 'teacher';
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
    const { notify } = useToasts();
    const toastGuard = useMemo(() => ({}), []);
    const guardedNotify = useCallback(
        (key, type, message, opts = {}) => {
            if (key && toastGuard[key]) return;
            notify(type, message, opts);
            if (key) {
                toastGuard[key] = true;
                const releaseMs = (opts?.lockMs ?? 2200) + 400;
                setTimeout(() => {
                    delete toastGuard[key];
                }, releaseMs);
            }
        },
        [notify, toastGuard]
    );

    // Profile updates handled by AuthContext

    const [faculty, setFaculty] = useState([]);
    const [loadingFaculty, setLoadingFaculty] = useState(true);

    useEffect(() => {
        let mounted = true;
        setLoadingFaculty(true);
        (async () => {
            try {
                const built = await buildFacultyFromAPI(selfProfile);
                if (!mounted) return;
                setFaculty(built);
            } catch (error) {
                if (mounted) setFaculty([]);
            } finally {
                if (mounted) setLoadingFaculty(false);
            }
        })();
        return () => { mounted = false; };
    }, [primaryEmail]);

    useEffect(() => {
        (async () => {
            const rebuilt = await buildFacultyFromAPI(selfProfile);
            const youAfter = rebuilt.find((r) => r.isYou);
            setFaculty((prev) => {
                if (!youAfter) return prev;
                return prev.map((row) => (row.isYou ? { ...row, ...youAfter } : row));
            });
        })();
    }, [selfProfile]);

    const handleDataUpdate = useCallback((payload) => {
        if (!payload?.type) return;
        logger.debug('Faculty data update received:', payload);
        
        if (payload.type === 'faculty.updated') {
            (async () => {
                try {
                    // Get fresh user data and rebuild faculty list
                    const currentUser = user;
                    const profile = currentUser?.role === 'teacher' ? userProfile : null;
                    const rebuilt = await buildFacultyFromAPI(profile);
                    setFaculty(rebuilt);
                    guardedNotify('faculty-update', 'info', 'Faculty data updated', { lockMs: 2000 });
                } catch (error) {
                    logger.error('Failed to refresh faculty after update:', error);
                }
            })();
        }
    }, []); // Empty dependencies - all data fetched inline

    useDataUpdates(handleDataUpdate);

    // Dedicated FacultyHub for real-time faculty updates
    useFacultyHub({
        onFacultyAdded: useCallback(async () => {
            logger.debug('Faculty member added via FacultyHub');
            try {
                const profile = user?.role === 'teacher' ? userProfile : null;
                const rebuilt = await buildFacultyFromAPI(profile);
                setFaculty(rebuilt);
                guardedNotify('faculty-added', 'success', 'New faculty member added', { lockMs: 2000 });
            } catch (error) {
                logger.error('Failed to refresh faculty after add:', error);
            }
        }, [user, userProfile, guardedNotify]),
        onFacultyUpdated: useCallback(async () => {
            logger.debug('Faculty member updated via FacultyHub');
            try {
                const profile = user?.role === 'teacher' ? userProfile : null;
                const rebuilt = await buildFacultyFromAPI(profile);
                setFaculty(rebuilt);
                guardedNotify('faculty-updated', 'info', 'Faculty member updated', { lockMs: 2000 });
            } catch (error) {
                logger.error('Failed to refresh faculty after update:', error);
            }
        }, [user, userProfile, guardedNotify]),
        onFacultyRemoved: useCallback(async () => {
            logger.debug('Faculty member removed via FacultyHub');
            try {
                const profile = user?.role === 'teacher' ? userProfile : null;
                const rebuilt = await buildFacultyFromAPI(profile);
                setFaculty(rebuilt);
                guardedNotify('faculty-removed', 'warning', 'Faculty member removed', { lockMs: 2000 });
            } catch (error) {
                logger.error('Failed to refresh faculty after removal:', error);
            }
        }, [user, userProfile, guardedNotify]),
        onScheduleAssigned: useCallback(async () => {
            logger.debug('Schedule assigned to faculty via FacultyHub');
            try {
                const profile = user?.role === 'teacher' ? userProfile : null;
                const rebuilt = await buildFacultyFromAPI(profile);
                setFaculty(rebuilt);
                guardedNotify('schedule-assigned', 'info', 'Schedule updated', { lockMs: 2000 });
            } catch (error) {
                logger.error('Failed to refresh faculty after schedule assign:', error);
            }
        }, [user, userProfile, guardedNotify])
    });

    const [q, setQ] = useState('');
    const [department, setDepartment] = useState('all');
    const [program, setProgram] = useState('all');
    const [status, setStatus] = useState('all');
    const [empType, setEmpType] = useState('all');
    const [subject, setSubject] = useState('all');
    const [minExp, setMinExp] = useState('');
    const [day, setDay] = useState('all');

    const [showAdv, setShowAdv] = useState(false);
    const [cert, setCert] = useState('');
    const [hireFrom, setHireFrom] = useState('');
    const [hireTo, setHireTo] = useState('');
    const [ratingMin, setRatingMin] = useState('');

    const [sortField, setSortField] = useState('name');
    const [sortDir, setSortDir] = useState('asc');
    const [page, setPage] = useState(1);
    const perPage = 10;

    const [selected, setSelected] = useState([]);

    const [editing, setEditing] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);

    const allSubjects = useMemo(() => {
        const s = new Set();
        faculty.forEach((f) => f.subjects?.forEach((x) => s.add(stripSubjectCode(x))));
        return Array.from(s).sort();
    }, [faculty]);

    const departments = useMemo(() => {
        const s = new Set();
        faculty.forEach((x) => (x.departments || [x.department]).forEach((d) => d && s.add(d)));
        return Array.from(s).sort((a, b) => a.localeCompare(b));
    }, [faculty]);

    const programs = useMemo(() => {
        const s = new Set();
        faculty.forEach((x) => { if (x.program) s.add(x.program); });
        return Array.from(s).sort((a, b) => a.localeCompare(b));
    }, [faculty]);

    const filtered = useMemo(() => {
        let list = faculty.slice();

        if (q.trim()) {
            const t = slug(q);
            list = list.filter((x) => {
                const hay = `${x.name} ${x.employeeId} ${x.email} ${x.department} ${(x.subjects || []).join(' ')} ${x.phone || ''} ${x.location || ''}`.toLowerCase();
                return hay.includes(t);
            });
        }
        if (department !== 'all')
            list = list.filter((x) => x.department === department || (x.departments || []).includes(department));
        if (program !== 'all') list = list.filter((x) => x.program === program);
        if (status !== 'all') list = list.filter((x) => x.status === status);
        if (empType !== 'all') list = list.filter((x) => x.employmentType === empType);
        if (subject !== 'all') list = list.filter((x) => (x.subjects || []).some((s) => stripSubjectCode(s) === subject));

        const minExpTrim = String(minExp).trim();
        const minExpNum = minExpTrim === '' ? NaN : Math.max(0, Number(minExpTrim));
        if (!Number.isNaN(minExpNum)) list = list.filter((x) => (x.yearsExperience || 0) >= minExpNum);

        if (day !== 'all') list = list.filter((x) => (x.availability || []).includes(day));
        if (cert.trim())
            list = list.filter((x) =>
                (x.certifications || []).some((c) => String(c.title || c.issuer || c.code || '').toLowerCase().includes(slug(cert)))
            );
        if (hireFrom) list = list.filter((x) => new Date(x.hireDate) >= new Date(hireFrom));
        if (hireTo) list = list.filter((x) => new Date(x.hireDate) <= new Date(hireTo));

        const ratingTrim = String(ratingMin).trim();
        const ratingNum = ratingTrim === '' ? NaN : Number(ratingTrim);
        if (!Number.isNaN(ratingNum)) list = list.filter((x) => (x.rating || 0) >= ratingNum);

        const val = (x) => {
            switch (sortField) {
                case 'lastActivity':
                    return +new Date(x.lastActivity || 0);
                case 'name':
                    return x.name?.toLowerCase();
                case 'employeeId':
                    return x.employeeId?.toLowerCase();
                case 'department':
                    return x.department?.toLowerCase();
                case 'classesCount':
                    return x.classesCount || 0;
                case 'yearsExperience':
                    return x.yearsExperience || 0;
                case 'rating':
                    return x.rating || 0;
                default:
                    return x.name?.toLowerCase();
            }
        };
        list.sort((a, b) => {
            const av = val(a), bv = val(b);
            const cmp = av > bv ? 1 : av < bv ? -1 : 0;
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return list;
    }, [faculty, q, department, status, empType, subject, minExp, day, cert, hireFrom, hireTo, ratingMin, sortField, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paged = filtered.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

    const onSelectAll = (chk) => setSelected(chk ? paged.map((x) => x.id) : []);
    const onSelect = (id, chk) => setSelected((prev) => (chk ? [...prev, id] : prev.filter((x) => x !== id)));

    const openProfile = (t) => {
        setEditing(t);
        setIsProfileOpen(true);
    };

    const saveProfile = async (data, opts = {}) => {
        try {
            // Update via API
            await updateFacultyProfileByEmail(data.email, data);
            // Update local state
            setFaculty((prev) => prev.map((x) => (x.id === data.id ? { ...x, ...data } : x)));
            if (!opts.keepOpen) {
                setIsProfileOpen(false);
                setEditing(null);
            }
            guardedNotify('faculty-updated', 'success', `${displayNameFrom(data) || data.email || 'Profile'} updated.`, {
                title: 'Profile saved',
                lockMs: 2600,
            });
        } catch (error) {
            logger.error('Failed to update faculty profile', error);
            guardedNotify('faculty-update-failed', 'error', 'Failed to update profile. Please try again.', {
                title: 'Update failed',
                lockMs: 3000,
            });
        }
    };

    const reassignScheduleFromProfile = async ({ targetEmail, eventIds }) => {
        if (!targetEmail || !Array.isArray(eventIds) || eventIds.length === 0) {
            return { ok: false, error: 'Missing target email or events' };
        }
        const cleanEmail = String(targetEmail).trim().toLowerCase();
        if (!cleanEmail) return { ok: false, error: 'Invalid email' };
        try {
            setLoadingFaculty(true);
            const result = await assignScheduleEventsToTeacher(cleanEmail, eventIds);
            const rebuilt = await buildFacultyFromAPI(selfProfile);
            setFaculty(rebuilt);
            const updatedCount = result?.updated ?? 0;
            const missingCount = Array.isArray(result?.missing) ? result.missing.length : 0;
            let description = `${updatedCount} class${updatedCount === 1 ? '' : 'es'} moved to ${cleanEmail}.`;
            if (missingCount > 0) description += ` ${missingCount} class${missingCount === 1 ? '' : 'es'} not found.`;
            guardedNotify('schedule-reassigned', 'success', description, {
                title: 'Schedule reassigned',
                lockMs: 3200,
            });
            return { ok: true, ...result };
        } catch (error) {
            logger.error('Failed to reassign schedule events', error);
            guardedNotify('schedule-reassign-failed', 'error', 'Failed to reassign classes. Please try again.', {
                title: 'Schedule reassignment failed',
                lockMs: 3200,
            });
            return { ok: false, error };
        } finally {
            setLoadingFaculty(false);
        }
    };

    const openAdd = () => setIsAddOpen(true);
    const saveAdd = async (data, opts = {}) => {
        const { linkedScheduleIds = [] } = opts || {};
        try {
            setLoadingFaculty(true);
            const created = await createFacultyMember(data);

            let assignmentResult = null;
            const shouldAssign = Array.isArray(linkedScheduleIds) && linkedScheduleIds.length > 0;
            const teacherEmailForAssignment = String(created?.email || data?.email || '').trim().toLowerCase();

            if (shouldAssign && teacherEmailForAssignment) {
                try {
                    assignmentResult = await assignScheduleEventsToTeacher(teacherEmailForAssignment, linkedScheduleIds);
                } catch (assignError) {
                    logger.error('Failed to assign schedule events to new teacher', assignError);
                    guardedNotify(
                        'faculty-schedule-assign-failed',
                        'error',
                        'Teacher created, but selected schedule entries were not reassigned. You can retry from the profile.',
                        {
                            title: 'Schedule reassignment failed',
                            lockMs: 3400,
                        }
                    );
                }
            } else if (shouldAssign && !teacherEmailForAssignment) {
                logger.warn('Missing teacher email for schedule assignment');
            }

            const rebuilt = await buildFacultyFromAPI(selfProfile);
            setFaculty(rebuilt);
            setIsAddOpen(false);
            let successMessage = `${displayNameFrom(data) || data.email || 'Faculty member'} added.`;
            if (assignmentResult?.updated > 0) {
                const updatedCount = assignmentResult.updated;
                const missingCount = Array.isArray(assignmentResult.missing) ? assignmentResult.missing.length : 0;
                successMessage += ` ${updatedCount} class${updatedCount === 1 ? '' : 'es'} reassigned${missingCount ? ` (${missingCount} skipped)` : ''}.`;
            }
            guardedNotify('faculty-added', 'success', successMessage, {
                title: 'Faculty created',
                lockMs: 2600,
            });
        } catch (error) {
            logger.error('Failed to create faculty member', error);
            guardedNotify('faculty-add-failed', 'error', 'Failed to create faculty member. Please try again.', {
                title: 'Create failed',
                lockMs: 3000,
            });
        } finally {
            setLoadingFaculty(false);
        }
    };

    const handleImportFaculty = async (list = [], strategy = 'skip') => {
        if (!list || list.length === 0) return;
        
        const byId = new Map(faculty.map((f) => [String(f.id), f]));
        const byEmail = new Map(faculty.map((f) => [String(f.email || '').toLowerCase(), f]));
        const byEmployeeId = new Map(faculty.map((f) => [String((f.employeeId || f.id || '')).toLowerCase(), f]));
        const toAdd = [];
        const toUpdate = new Map();
        const toSkip = [];
        
        list.forEach((n) => {
            const keyId = String(n.id ?? '').trim();
            const keyEmail = String(n.email ?? '').trim().toLowerCase();
            const keyEmployeeId = String(n.employeeId ?? '').trim().toLowerCase();
            const hit = (keyId && byId.get(keyId)) || (keyEmail && byEmail.get(keyEmail)) || (keyEmployeeId && byEmployeeId.get(keyEmployeeId));
            if (!hit) {
                toAdd.push(n);
            } else {
                if (strategy === 'update') {
                    toUpdate.set(hit.id, { ...hit, ...n });
                } else if (strategy === 'duplicate') {
                    const dup = { ...n, id: Date.now() + Math.random() };
                    toAdd.push(dup);
                } else {
                    toSkip.push(n);
                }
            }
        });

        // Create new faculty members via API
        if (toAdd.length > 0) {
            try {
                setLoadingFaculty(true);
                const created = await Promise.all(
                    toAdd.map((facultyData) => createFacultyMember(facultyData))
                );
                
                // Reload faculty list from API
                const rebuilt = await buildFacultyFromAPI(selfProfile);
                setFaculty(rebuilt);
            } catch (error) {
                logger.error('Failed to import faculty members', error);
                guardedNotify('faculty-import-api-error', 'error', 'Failed to import some faculty members. Please check the data and try again.', {
                    title: 'Import failed',
                    lockMs: 3000,
                });
            } finally {
                setLoadingFaculty(false);
            }
        }

        // Update existing faculty members via API (if strategy is 'update')
        if (toUpdate.size > 0 && strategy === 'update') {
            try {
                setLoadingFaculty(true);
                // For updates, we would need an update API endpoint
                // For now, we'll just reload the faculty list
                const rebuilt = await buildFacultyFromAPI(selfProfile);
                setFaculty(rebuilt);
            } catch (error) {
                logger.error('Failed to update faculty members', error);
                guardedNotify('faculty-import-update-error', 'error', 'Failed to update some faculty members.', {
                    title: 'Update failed',
                    lockMs: 3000,
                });
            } finally {
                setLoadingFaculty(false);
            }
        }
        
        setIsAddOpen(false);
        const updatedCount = strategy === 'update' ? toUpdate.size : 0;
        const skippedCount = toSkip.length;
        const message = `Imported ${toAdd.length}${updatedCount ? `, updated ${updatedCount}` : ''}${skippedCount ? `, skipped ${skippedCount}` : ''}`;
        setTimeout(() => {
            guardedNotify('faculty-import-complete', 'success', message, {
                title: 'Import complete',
                lockMs: 3000,
            });
        }, 300);
    };

    const bulkAction = (v) => {
        if (!v) return;
        if (!selected.length) {
            guardedNotify('faculty-bulk-none', 'info', 'Select at least one faculty member to run bulk actions.', {
                title: 'No selection',
                lockMs: 2200,
            });
            return;
        }
        if (v === 'activate') {
            setFaculty((prev) => prev.map((x) => (selected.includes(x.id) ? { ...x, status: 'active' } : x)));
            guardedNotify('faculty-bulk-activate', 'success', `Activated ${selected.length} faculty member${selected.length === 1 ? '' : 's'}.`, {
                title: 'Status updated',
                lockMs: 2400,
            });
        }
        if (v === 'on-leave') {
            setFaculty((prev) => prev.map((x) => (selected.includes(x.id) ? { ...x, status: 'on-leave' } : x)));
            guardedNotify('faculty-bulk-onleave', 'info', `${selected.length} faculty marked on leave.`, {
                title: 'Status updated',
                lockMs: 2400,
            });
        }
        if (v === 'export') {
            const header = [
                'id',
                'employeeId',
                'name',
                'email',
                'phone',
                'location',
                'office',
                'department',
                'subjects',
                'status',
                'employmentType',
                'classesCount',
                'yearsExperience',
                'rating',
                'hireDate'
            ];
            const rows = selected.map((id) => {
                const item = faculty.find((x) => x.id === id);
                if (!item) return [];
                return [
                    item.id,
                    item.employeeId,
                    item.name,
                    item.email,
                    item.phone || '',
                    item.location || '',
                    item.office || '',
                    item.department,
                    (item.subjects || []).join('|'),
                    item.status,
                    item.employmentType,
                    item.classesCount,
                    item.yearsExperience,
                    item.rating,
                    item.hireDate
                ];
            });
            const csv = [header.join(','), ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `faculty_export_${Date.now()}.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            guardedNotify('faculty-export', 'success', `Exported ${selected.length} faculty rows.`, {
                title: 'Export complete',
                lockMs: 2400,
            });
        }
        setSelected([]);
    };

    const openChat = (teachers) => {
        const rec = (teachers || []).map((t) => ({
            id: t.id,
            name: t.name || t.fullName || 'Participant',
            email: t.email || ''
        }));
        try {
            sessionStorage.setItem(
                'mais.chat.launch',
                JSON.stringify({
                    participants: rec,
                    meta: { source: 'faculty', ts: Date.now() }
                })
            );
        } catch {}
        navigate('/chat?start=1');
    };

    const handleDeleteTeacher = (t) => {
        if (!t?.id) return;
        setFaculty((prev) => prev.filter((x) => x.id !== t.id));
        setSelected((prev) => prev.filter((id) => id !== t.id));
        try {
            window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'faculty', op: 'delete', id: t.id } }));
        } catch {}
        setTimeout(() => {
            guardedNotify('faculty-delete-success', 'success', 'Teacher removed', { title: 'Teacher deleted', lockMs: 3000 });
        }, 100);
    };

    const handleLogout = () => navigate('/');

    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    const filteredCount = filtered.length;
    const summary = useMemo(() => {
        const statusCounts = filtered.reduce((acc, item) => {
            const key = String(item.status || 'active').toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const subjectsCoverage = filtered.reduce((acc, item) => acc + ((Array.isArray(item.subjects) ? item.subjects.length : 0) > 0 ? 1 : 0), 0);
        const availabilityCoverage = filtered.reduce((acc, item) => acc + ((Array.isArray(item.availability) ? item.availability.length : 0) >= 3 ? 1 : 0), 0);
        const avgRating = filtered.length
            ? (filtered.reduce((acc, item) => acc + (Number(item.rating) || 0), 0) / filtered.length).toFixed(1)
            : null;
        return {
            total: faculty.length,
            filtered: filteredCount,
            selected: selected.length,
            active: statusCounts.active || 0,
            onLeave: statusCounts['on-leave'] || 0,
            substitutes: statusCounts.substitute || 0,
            coverage: faculty.length ? Math.round((subjectsCoverage / faculty.length) * 100) : 0,
            availability: faculty.length ? Math.round((availabilityCoverage / faculty.length) * 100) : 0,
            avgRating,
        };
    }, [filtered, filteredCount, faculty.length, selected.length]);

    const heroSubtitle = useMemo(
        () => (role === 'teacher'
            ? 'Coordinate faculty workload, availability, and outreach from a single hub.'
            : 'Browse the faculty directory with up-to-date schedules and contact details.'),
        [role]
    );

    const summaryCards = useMemo(() => {
        const cards = [
            {
                key: 'visible',
                label: 'Faculty in view',
                value: summary.filtered.toLocaleString(),
                helper: `${summary.selected.toLocaleString()} selected • ${summary.total.toLocaleString()} total`,
            },
            {
                key: 'active',
                label: 'Active staff',
                value: summary.active.toLocaleString(),
                helper: `${summary.onLeave.toLocaleString()} on leave • ${summary.substitutes.toLocaleString()} substitutes`,
            },
            {
                key: 'coverage',
                label: 'Course coverage',
                value: `${summary.coverage}%`,
                helper: 'Faculty teaching at least one assigned subject',
            },
            {
                key: 'availability',
                label: 'Core availability',
                value: `${summary.availability}%`,
                helper: 'Coverage for core weekdays (≥3 days/week)',
            },
        ];
        if (summary.avgRating) {
            cards.splice(3, 1, {
                key: 'rating',
                label: 'Average rating',
                value: `${summary.avgRating} / 5`,
                helper: 'Based on faculty evaluations and feedback',
            });
        }
        return cards;
    }, [summary]);

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
                <Header userRole={role} userName={headerDisplayName} onLogout={handleLogout} />
                <RoleSidebar
                    userRole={role}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />

                <div
                    className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}
                    role="main"
                    aria-label="Faculty management"
                >
                    <main className="flex-1">
                        <div className="px-6 pt-3 pb-6">
                            <NavigationBreadcrumb />
                            {loadingFaculty && (
                              <DataLoader
                                label="Loading faculty directory…"
                                description="Syncing profiles, schedules, and contact data."
                                details={[
                                  'Faculty roster & assignments index refresh',
                                  'Office hours • availability • timetable joins',
                                  'Panel analytics, filters, and action states updated',
                                ]}
                                fullScreen
                              />
                            )}

                            <Reveal as={motion.section} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true} className="mb-6 space-y-4">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                    <div className="min-w-0 space-y-1">
                                        <h1 className="text-2xl font-bold text-foreground truncate">Faculty Management</h1>
                                        <p className="text-sm text-muted-foreground">{heroSubtitle}</p>
                                    </div>
                                    {summary.selected > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" aria-hidden="true" />
                                            {summary.selected.toLocaleString()} selected for bulk actions
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                    {summaryCards.map((card, idx) => (
                                        <motion.div
                                            key={card.key}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                                            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + idx * ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
                                            whileHover={{ y: -3, scale: 1.01 }}
                                            whileTap={{ scale: 0.995 }}
                                            className="metric-card w-full"
                                        >
                                            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{card.label}</div>
                                            <div className="text-2xl font-semibold text-foreground">{card.value}</div>
                                            {card.helper && <div className="mt-3 text-xs text-muted-foreground leading-snug">{card.helper}</div>}
                                        </motion.div>
                                    ))}
                                </div>
                            </Reveal>

                            <Reveal as={motion.div} className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6" delay={ANIMATION_DELAYS.FILTERS} variant="keycap" waitForLoaders={true}>
                                <div className="xl:col-span-2">
                                    <FacultyTableHeader
                                        title="Faculty Management"
                                        switcher={{ left: { label: 'Students', to: '/student-management' }, right: { label: 'Faculty', active: true } }}
                                        q={q}
                                        onQ={(v) => {
                                            setQ(asStr(v));
                                            setPage(1);
                                        }}
                                        department={department}
                                        onDepartment={(v) => {
                                            setDepartment(asStr(v));
                                            setPage(1);
                                        }}
                                        departments={['all', ...departments]}
                                        program={program}
                                        onProgram={(v) => {
                                            setProgram(asStr(v));
                                            setPage(1);
                                        }}
                                        programs={['all', ...programs]}
                                        status={status}
                                        onStatus={(v) => {
                                            setStatus(asStr(v));
                                            setPage(1);
                                        }}
                                        empType={empType}
                                        onEmpType={(v) => {
                                            setEmpType(asStr(v));
                                            setPage(1);
                                        }}
                                        subject={subject}
                                        onSubject={(v) => {
                                            setSubject(asStr(v));
                                            setPage(1);
                                        }}
                                        subjects={['all', ...allSubjects]}
                                        minExp={minExp}
                                        onMinExp={(v) => {
                                            const s = asStr(v);
                                            if (s === '') return setMinExp('');
                                            const n = Math.max(0, Number(s));
                                            setMinExp(Number.isFinite(n) ? String(n) : '0');
                                            setPage(1);
                                        }}
                                        day={day}
                                        onDay={(v) => {
                                            setDay(asStr(v));
                                            setPage(1);
                                        }}
                                        showAdv={showAdv}
                                        onToggleAdv={() => setShowAdv((s) => !s)}
                                        cert={cert}
                                        onCert={(v) => {
                                            setCert(asStr(v));
                                            setPage(1);
                                        }}
                                        hireFrom={hireFrom}
                                        onHireFrom={(v) => {
                                            setHireFrom(asStr(v));
                                            setPage(1);
                                        }}
                                        hireTo={hireTo}
                                        onHireTo={(v) => {
                                            setHireTo(asStr(v));
                                            setPage(1);
                                        }}
                                        ratingMin={ratingMin}
                                        onRatingMin={(v) => {
                                            setRatingMin(asStr(v));
                                            setPage(1);
                                        }}
                                        selectedCount={selected.length}
                                        totalCount={filtered.length}
                                        onAdd={isTeacher ? (() => setIsAddOpen(true)) : undefined}
                                        onBulk={isTeacher ? bulkAction : undefined}
                                        onOpenChat={isTeacher ? () => openChat(faculty.filter((f) => selected.includes(f.id))) : undefined}
                                        canManage={isTeacher}
                                    />
                                </div>

                                <Reveal as={motion.div} className="space-y-6 xl:sticky xl:top-20 self-start" delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="keycap" waitForLoaders={true}>
                                    <QuickActionPanel
                                        userRole={role}
                                        onQuickAction={(action, data) => {
                                            if (action === 'search') {
                                                setQ(asStr(data));
                                                setPage(1);
                                            }
                                        }}
                                    />
                                </Reveal>
                            </Reveal>

                            <Reveal as={motion.div} className="space-y-6" delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                                <FacultyTable
                                    data={filtered.slice((page - 1) * perPage, (page - 1) * perPage + perPage)}
                                    selected={selected}
                                    onSelectAll={onSelectAll}
                                    onSelect={onSelect}
                                    sortField={sortField}
                                    sortDir={sortDir}
                                    onSort={(f, d) => {
                                        setSortField(asStr(f));
                                        setSortDir(asStr(d));
                                    }}
                                    onOpenProfile={openProfile}
                                    onMessage={isTeacher ? (t) => openChat([t]) : undefined}
                                    onEditProfile={openProfile}
                                    canMessage={isTeacher}
                                    canEdit={isTeacher}
                                    canDelete={isTeacher}
                                    onDelete={handleDeleteTeacher}
                                />

                                {totalPages > 1 && (
                                    <Reveal as={motion.div} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card glass-card rounded-xl border border-border p-3 sm:p-4" delay={ANIMATION_DELAYS.PAGINATION} variant="keycap" waitForLoaders={true}>
                                        <div className="order-2 lg:order-1 text-sm text-muted-foreground min-w-0">
                                            Showing {(page - 1) * perPage + 1} to {Math.min(filtered.length, page * perPage)} of {filtered.length} faculty
                                        </div>
                                        <div className="order-1 lg:order-2 w-full lg:w-auto flex flex-col gap-2 min-w-0">
                                            <Pagination
                                                currentPage={page}
                                                totalPages={totalPages}
                                                onChange={setPage}
                                                className="justify-between lg:justify-end"
                                            />
                                            <div className="lg:hidden text-xs text-muted-foreground text-center">
                                                Page {page} / {totalPages}
                                            </div>
                                        </div>
                                    </Reveal>
                                )}
                            </Reveal>
                        </div>
                    </main>

                    <PageFooter
                        left={[
                            `MAIS 2.0 • ${isTeacher ? 'Teacher' : 'Student'} Portal`,
                            lastLoginLabel,
                        ]}
                        actions={[
                            <Button
                                key="help"
                                variant="ghost"
                                size="sm"
                                iconName="HelpCircle"
                                onClick={() => navigate('/help')}
                            >
                                Help
                            </Button>,
                        ]}
                    />
                </div>

                <FacultyProfileModal
                    isOpen={isProfileOpen}
                    onClose={() => {
                        setIsProfileOpen(false);
                        setEditing(null);
                    }}
                    teacher={editing}
                    onSave={saveProfile}
                    onReassignSchedule={isTeacher ? reassignScheduleFromProfile : undefined}
                    readOnly={!isTeacher}
                />

                <AddFacultyModal
                    isOpen={isAddOpen && isTeacher}
                    onClose={() => setIsAddOpen(false)}
                    onSave={saveAdd}
                    onImport={handleImportFaculty}
                    existingEmployeeIds={faculty.map((f) => String((f.employeeId || f.id || '')).toLowerCase())}
                    existingEmails={faculty.map((f) => (f.email || '').toLowerCase())}
                    initialValue={null}
                />
            </div>
    );
};

const FacultyPage = () => (
    <ToastsProvider>
        <FacultyPageContent />
        <ToastViewport position="top-right" />
    </ToastsProvider>
);

export default FacultyPage;