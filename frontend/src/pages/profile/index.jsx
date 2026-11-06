// src/pages/profile/ProfilePage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Icon from '../../components/AppIcon';
import ProfileHeader from './components/ProfileHeader';
import ProfileInfoForm from './components/ProfileInfoForm';
import OfficeHours from './components/OfficeHours';
import DndPanel from './components/DndPanel';
import ThemePanel from './components/ThemePanel';
import DevicesPanel from './components/DevicesPanel';
import DangerZone from './components/DangerZone';
import CertificatesPanel from '../../components/profile/CertificatesPanel';
import TitlesPanel from './components/TitlesPanel';
import LanguageSwitcher from './components/LanguageSwitcher';
import BankAccountsPanel from './components/BankAccountsPanel';
import VariableSymbolsPanel from './components/VariableSymbolsPanel';
import CookieSettingsPanel from './components/CookieSettingsPanel';
import {
    dayOrder, labelForDay,
    splitCSV, timeAgo, nextWeekdayUTC, fmtICS,
    loadDevices, fmtDate
} from './utils/utils';
import { displayNameFrom } from '../../utils/displayName';
import { DEFAULT_PROFILE } from './utils/utils';
import { updateStudentProfileByEmail, updateFacultyProfileByEmail, fetchStudentByEmail, fetchFaculty, fetchCourses } from '../../data/maisApiAdapter';
import DataLoader from '../../components/ui/DataLoader';
import { formatLastLogin } from '../../utils/datetime';
import { motion } from 'framer-motion';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import useDataUpdates from '../../hooks/useDataUpdates';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import api from '../../utils/apiClient';

const readTitles = (src = {}) => {
    const t = src.titles || {};
    const prefixes = Array.isArray(src.titlesPrefix) ? src.titlesPrefix : Array.isArray(t.prefix) ? t.prefix : [];
    const suffixes = Array.isArray(src.titlesSuffix) ? src.titlesSuffix : Array.isArray(t.suffix) ? t.suffix : [];
    const history = Array.isArray(src.titleHistory) ? src.titleHistory : [];
    return { prefixes, suffixes, history };
};

const splitName = (full = '') => {
    const parts = String(full).trim().split(/\s+/);
    const knownPref = new Set(['Bc.', 'Ing.', 'Mgr.', 'RNDr.', 'PaedDr.', 'Mgr.', 'doc.', 'prof.']);
    const knownSuf = new Set(['PhD.', 'CSc.', 'ThDr.']);
    const filtered = parts.filter(p => !knownPref.has(p) && !knownSuf.has(p));
    if (filtered.length === 0) return { first: '', last: '' };
    if (filtered.length === 1) return { first: filtered[0], last: '' };
    return { first: filtered[0], last: filtered.slice(1).join(' ') };
};

const buildStudentDefault = (user, userProfile) => {
    const email = user?.email || '';
    const full = user?.full_name || userProfile?.full_name || '';
    const { first, last } = splitName(full || email.split('@')[0]);
    const about = [
        userProfile?.faculty ? `Student at ${userProfile.faculty}` : null,
        userProfile?.program ? `Program: ${userProfile.program}` : null,
        Number.isFinite(userProfile?.year) ? `Year ${userProfile.year}` : null,
        userProfile?.degree ? `Degree: ${userProfile.degree}` : null
    ].filter(Boolean).join(' • ');
    return {
        role: 'student',
        firstName: first,
        lastName: last,
        email,
        phone: '',
        location: '',
        about,
        advisor: '',
        gpa: null,
        credits: null,
        officeHours: {},
        preferences: { showEmailOnProfile: true, showPhoneOnProfile: false },
        certifications: [],
        studentId: '',
    };
};

const seedCommonFinance = (p0 = {}) => {
    const p = { ...p0 };
    if (!Array.isArray(p.bankAccounts)) p.bankAccounts = [];
    if (!p.paymentSymbols) {
        p.paymentSymbols = {
            accommodation: [],
            study: [],
            other: [],
        };
    }
    return p;
};

const seedStudentMissing = (p) => {
    const base = seedCommonFinance(p);
    if ((base.role || 'student') !== 'student') return base;
    const next = { ...base };
    if (!next.student) {
        next.student = {
            className: '',
            parentName: '',
            isicCardNumber: '',
            studentNumber: '',
            studyNumber: '',
            birthDate: '',
            birthPlace: '',
            nationality: '',
            passportId: '',
            familyStatus: '',
            healthStatus: '',
            address: '',
            consentPersonalData: false,
            consentCompanyOffers: false,
            studentId: '',
        };
    } else {
        next.student.className = next.student.className || '';
        next.student.parentName = next.student.parentName || '';
        next.student.consentPersonalData = !!next.student.consentPersonalData;
        next.student.consentCompanyOffers = !!next.student.consentCompanyOffers;
        next.student.studentId = next.student.studentId || '';
    }
    next.studentId = next.studentId || next.student.studentId || '';
    if (!next.student.studentId && next.studentId) next.student.studentId = next.studentId;
    return next;
};

const ProfilePageInner = () => {
    const { user, userProfile, loading } = useAuth();
    const navigate = useNavigate();
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();
    const toastLocks = useRef({});
    const guardedNotify = useCallback((key, type, message, opts = {}) => {
        if (key) {
            const now = Date.now();
            const lock = opts.lockMs ?? 2800;
            const prev = toastLocks.current[key] ?? 0;
            if (now - prev < lock) return;
            toastLocks.current[key] = now;
        }
        notify(type, message, opts);
    }, [notify]);

    const baseDefault = useMemo(() => {
        if (user?.role === 'teacher') return seedCommonFinance(DEFAULT_PROFILE);
        return seedCommonFinance(buildStudentDefault(user, userProfile));
    }, [user?.role, user?.email, user?.full_name, userProfile]);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [profile, setProfile] = useState(() => seedStudentMissing(baseDefault));
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(profile);
    const [privacy, setPrivacy] = useState(false);
    const [avatarDataUrl, setAvatarDataUrl] = useState(null);
    const [themePref, setThemePref] = useState('system');
    const [saving, setSaving] = useState(false);
    const [devices, setDevices] = useState([]);
    const [coursesOptions, setCoursesOptions] = useState([]);
    const [now, setNow] = useState(Date.now());
    const [loadingRemoteProfile, setLoadingRemoteProfile] = useState(false);
    const [loadingFacultyLookup, setLoadingFacultyLookup] = useState(false);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const fileRef = useRef(null);
    const facultyDataLoadedRef = useRef(false);
    const studentDataLoadedRef = useRef(false);

    useEffect(() => {
        if (loading) return;
        // Reset data loaded flags when user changes
        facultyDataLoadedRef.current = false;
        studentDataLoadedRef.current = false;
        const seeded = seedStudentMissing(baseDefault);
        setProfile(seeded);
        setDraft(seeded);
        
        // Load devices from backend
        const userId = user?.email || user?.studentId || '';
        if (userId) {
            loadDevices(userId).then(devs => setDevices(devs)).catch(() => setDevices([]));
        }
        
        // Load courses for subjects dropdown
        fetchCourses().then(courses => {
            const options = (courses || [])
                .sort((a, b) => {
                    const programCompare = (a.program || 'ZZZ').localeCompare(b.program || 'ZZZ');
                    if (programCompare !== 0) return programCompare;
                    return (a.code || '').localeCompare(b.code || '');
                })
                .map(c => ({
                    value: c.code,
                    label: `${c.code} - ${c.nameEn || c.nameSk || c.name || c.code}`,
                    faculty: c.faculty,
                    program: c.program,
                }));
            setCoursesOptions(options);
        }).catch(() => setCoursesOptions([]));
    }, [loading, baseDefault]);

    // Load student profile details from backend by email and merge into local state
    useEffect(() => {
        if (loading) {
            return;
        }
        const email = String(user?.email || '').trim();
        if (!email) {
            return;
        }
        if ((user?.role || 'student') !== 'student') {
            return;
        }
        // Skip if already loaded
        if (studentDataLoadedRef.current) {
            return;
        }
        let cancelled = false;
        setLoadingRemoteProfile(true);
        (async () => {
            try {
                const item = await fetchStudentByEmail(email);
                if (!item || cancelled) {
                    return;
                }
                const first = String(item.firstName || item.givenName || '').trim();
                const last = String(item.lastName || item.familyName || '').trim();
                const full = String(item.fullName || '').trim() || `${first} ${last}`.trim() || email.split('@')[0];
                
                // Build degree display from awarded degree or titlesSuffix
                const awardedDegree = item.awardedDegree || item.degree || '';
                const titlesSuffix = Array.isArray(item.titlesSuffix) ? item.titlesSuffix : [];
                const degreeDisplay = awardedDegree || (titlesSuffix.length > 0 ? titlesSuffix.join(', ') : '');
                
                const about = [
                    item.faculty ? `Student at ${item.faculty}` : null,
                    item.program ? `Program: ${item.program}` : null,
                    Number.isFinite(item.studyYear) ? `Year ${item.studyYear}` : null,
                    degreeDisplay ? `Degree: ${degreeDisplay}` : null,
                ].filter(Boolean).join(' • ');

                const next = seedStudentMissing({
                    ...profile,
                    role: 'student',
                    firstName: first || profile.firstName,
                    lastName: last || profile.lastName,
                    fullName: full,
                    email: email,
                    phone: item.phone || profile.phone || '',
                    phone2: item.phone2 || profile.phone2 || '',
                    altEmail: item.altEmail || profile.altEmail || '',
                    about: about || profile.about || '',
                    faculty: item.faculty || profile.faculty || '',
                    program: item.program || profile.program || '',
                    departmentCode: item.departmentCode || profile.departmentCode || '',
                    location: item.location || profile.location || '',
                    studentId: item.id || profile.studentId || '',
                    titlesPrefix: Array.isArray(item.titlesPrefix) ? item.titlesPrefix : profile.titlesPrefix || [],
                    titlesSuffix: titlesSuffix.length > 0 ? titlesSuffix : profile.titlesSuffix || [],
                    student: {
                        ...(profile.student || {}),
                        className: item.className || (profile.student || {}).className || '',
                        isicCardNumber: item.isicCardNumber || (profile.student || {}).isicCardNumber || '',
                        studentNumber: item.studentNumber || (profile.student || {}).studentNumber || '',
                        studyNumber: item.studyNumber || (profile.student || {}).studyNumber || '',
                        passportId: item.passportId || (profile.student || {}).passportId || '',
                        birthDate: (item.birthDate ? String(item.birthDate).slice(0,10) : (profile.student || {}).birthDate || ''),
                        birthPlace: item.birthPlace || (profile.student || {}).birthPlace || '',
                        nationality: item.nationality || (profile.student || {}).nationality || '',
                        familyStatus: item.familyStatus || (profile.student || {}).familyStatus || '',
                        healthStatus: item.healthStatus || (profile.student || {}).healthStatus || '',
                        parentName: item.parentName || (profile.student || {}).parentName || '',
                        address: item.address || (profile.student || {}).address || '',
                        about: item.about || (profile.student || {}).about || '',
                        faculty: item.faculty || (profile.student || {}).faculty || '',
                        program: item.program || (profile.student || {}).program || '',
                        consentPersonalData: typeof item.consentPersonalData === 'boolean' ? item.consentPersonalData : !!((profile.student || {}).consentPersonalData),
                        consentCompanyOffers: typeof item.consentCompanyOffers === 'boolean' ? item.consentCompanyOffers : !!((profile.student || {}).consentCompanyOffers),
                        studentId: item.id || (profile.student || {}).studentId || '',
                    },
                });

                // Derive display name and persist locally for consistency
                const toSave = {
                    ...next,
                    displayName: displayNameFrom(next, { privacy: false }),
                    fullName: displayNameFrom(next, { privacy: false }),
                };
                setProfile(toSave);
                setDraft(toSave);
                studentDataLoadedRef.current = true;
                // Load avatar if exists
                if (item.avatarUrl) {
                    setAvatarDataUrl(item.avatarUrl);
                }
                window.dispatchEvent(new CustomEvent('mais:profile-updated', { detail: toSave }));
                window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'profile' } }));
            } catch {}
            finally {
                if (!cancelled) setLoadingRemoteProfile(false);
            }
        })();
        return () => { cancelled = true; };
    }, [loading, user?.email, user?.role]);

    useEffect(() => {
        if (loading) return;
        if ((user?.role || 'student') !== 'teacher') return;
        const email = String(user?.email || '').trim().toLowerCase();
        if (!email) return;
        // Skip if already loaded
        if (facultyDataLoadedRef.current) return;
        let cancelled = false;
        setLoadingFacultyLookup(true);
        (async () => {
            try {
                const list = await fetchFaculty({ q: email, page: 1, pageSize: 50 });
                if (cancelled) return;
                const item = (list || []).find(f => String(f.email || '').trim().toLowerCase() === email);
                if (!item) return;
                const empIdRaw = String(item.id || item.employeeId || '').trim().toLowerCase();
                const dept = item.department || (Array.isArray(item.departments) && item.departments[0]) || profile.department || '';
                
                // Ensure departments is an array
                let departmentsArray = [];
                if (Array.isArray(item.departments)) {
                    departmentsArray = item.departments;
                } else if (item.department) {
                    departmentsArray = [item.department];
                } else if (Array.isArray(profile.departments)) {
                    departmentsArray = profile.departments;
                } else if (profile.department) {
                    departmentsArray = [profile.department];
                }
                
                // Map all fields from faculty JSON
                const next = {
                    ...profile,
                    role: 'teacher',
                    employeeId: empIdRaw || profile.employeeId || '',
                    department: dept || profile.department,
                    departments: departmentsArray,
                    titlesPrefix: Array.isArray(item.titlesPrefix) ? item.titlesPrefix : profile.titlesPrefix || [],
                    titlesSuffix: Array.isArray(item.titlesSuffix) ? item.titlesSuffix : profile.titlesSuffix || [],
                    firstName: item.givenName || item.firstName || profile.firstName || '',
                    lastName: item.familyName || item.lastName || profile.lastName || '',
                    phone: item.phone || profile.phone || '',
                    location: item.office || profile.location || '',
                    about: item.about || profile.about || '',
                    yearsExperience: item.yearsExperience ?? profile.yearsExperience,
                    faculty: item.faculty || profile.faculty || '',
                    program: item.program || profile.program || '',
                    departmentCode: item.departmentCode || profile.departmentCode || '',
                    status: item.status || profile.status || '',
                    employmentType: item.employmentType || profile.employmentType || '',
                    classesCount: item.classesCount ?? profile.classesCount,
                    hireDate: item.hireDate || profile.hireDate || '',
                    lastActivity: item.lastActivity || profile.lastActivity || '',
                    academicDegree: item.academicDegree || profile.academicDegree || '',
                    degreeField: item.degreeField || profile.degreeField || '',
                    almaMater: item.almaMater || item.alma_mater || profile.almaMater || '',
                    // Arrays and objects
                    subjects: Array.isArray(item.subjects) ? item.subjects : profile.subjects || [],
                    expertise: Array.isArray(item.expertise) ? item.expertise : profile.expertise || [],
                    publications: Array.isArray(item.publications) ? item.publications : profile.publications || [],
                    researchInterests: Array.isArray(item.researchInterests) ? item.researchInterests : profile.researchInterests || [],
                    languages: Array.isArray(item.languages) ? item.languages : profile.languages || [],
                    certifications: Array.isArray(item.certifications) ? item.certifications : profile.certifications || [],
                    socialLinks: item.socialLinks || profile.socialLinks || {},
                    officeHours: item.officeHours || profile.officeHours || {},
                    workingHours: item.workingHours || profile.workingHours || {},
                };
                const toSave = {
                    ...next,
                    displayName: displayNameFrom(next, { privacy: false }),
                    fullName: displayNameFrom(next, { privacy: false }),
                };
                setProfile(toSave);
                setDraft(toSave);
                facultyDataLoadedRef.current = true;
                // Load avatar if exists
                if (item.avatarUrl) {
                    setAvatarDataUrl(item.avatarUrl);
                }
                window.dispatchEvent(new CustomEvent('mais:profile-updated', { detail: toSave }));
                window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'profile' } }));
            } catch {}
            finally {
                if (!cancelled) setLoadingFacultyLookup(false);
            }
        })();
        return () => { cancelled = true; };
    }, [loading, user?.email, user?.role, profile]);

    // SignalR real-time profile updates
    const handleDataUpdate = useCallback((payload) => {
        if (!payload?.type) return;
        if (payload.type === 'profile.updated' || payload.type === 'student.updated' || payload.type === 'faculty.updated') {
            const email = String(user?.email || '').trim();
            if (!email) return;
            
            // Reload profile data based on role
            (async () => {
                try {
                    if ((user?.role || 'student') === 'student') {
                        const item = await fetchStudentByEmail(email);
                        if (item) {
                            const first = String(item.firstName || item.givenName || '').trim();
                            const last = String(item.lastName || item.familyName || '').trim();
                            const full = String(item.fullName || '').trim() || `${first} ${last}`.trim();
                            setProfile(prev => seedStudentMissing({ ...prev, firstName: first, lastName: last, fullName: full }));
                            guardedNotify('profile-updated', 'info', 'Profile updated', { lockMs: 2000 });
                        }
                    } else {
                        const facList = await fetchFaculty({ q: email, page: 1, pageSize: 1 });
                        const item = (Array.isArray(facList) ? facList : []).find(f => (f.email || '').toLowerCase() === email.toLowerCase());
                        if (item) {
                            setProfile(prev => ({ ...prev, department: item.department || prev.department }));
                            guardedNotify('profile-updated', 'info', 'Profile updated', { lockMs: 2000 });
                        }
                    }
                } catch (err) {
                    // Silent fail for real-time updates
                }
            })();
        }
    }, []); // Empty dependencies - user data fetched inline

    useDataUpdates(handleDataUpdate);

    // Check if user should be prompted to change password on first login
    // Shows toast ONCE per session until password is changed
    useEffect(() => {
        if (loading) return;
        const email = user?.email;
        if (!email) return;
        
        let cancelled = false;
        
        (async () => {
            try {
                const response = await api.get('/users/password-status');
                if (cancelled) return;
                
                const { shouldChangePassword, isActivated, lastPasswordChange } = response;
                
                // Only show toast if:
                // 1. User should change password (FirstLoginCompleted = false)
                // 2. User is activated (not a pending invitation)
                // 3. User has never changed password (lastPasswordChange is null/empty)
                const hasNeverChangedPassword = !lastPasswordChange || lastPasswordChange === null;
                
                if (shouldChangePassword && isActivated && hasNeverChangedPassword) {
                    // Check if toast was already shown this session (sessionStorage)
                    // Once password is changed, backend returns shouldChangePassword=false
                    // so this check is only for avoiding duplicate toasts in same session
                    const sessionKey = `pwd-toast-shown-session-${email}`;
                    const wasShownThisSession = sessionStorage.getItem(sessionKey);
                    
                    if (!wasShownThisSession) {
                        // Show toast notification for first-time login with temporary password
                        guardedNotify(
                            'first-login-password-change',
                            'warning',
                            'For security reasons, please change your temporary password.',
                            {
                                title: '🔐 Welcome! Change Your Password',
                                duration: 12000,
                                action: {
                                    label: 'Change Now',
                                    onClick: () => setShowChangePasswordModal(true),
                                },
                            }
                        );
                        // Mark as shown for this session only
                        sessionStorage.setItem(sessionKey, 'true');
                    }
                }
            } catch (error) {
                // Silent fail - password check is not critical
            }
        })();
        
        return () => { cancelled = true; };
    }, [loading, user?.email, navigate, guardedNotify]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-light', 'theme-dark');
        if (themePref === 'light') root.classList.add('theme-light');
        if (themePref === 'dark') root.classList.add('theme-dark');
    }, [themePref]);

    const isTeacher = (isEditing ? draft.role : profile.role) === 'teacher';
    const isStudent = !isTeacher;

    const titlesEffective = useMemo(
        () => readTitles(isEditing ? draft : profile),
        [isEditing, draft, profile]
    );

    const titleHistory = titlesEffective.history;

    const fullNameStruct = isEditing
        ? { firstName: draft.firstName, lastName: draft.lastName }
        : { firstName: profile.firstName, lastName: profile.lastName };

    const displayFullName = useMemo(() => {
        const base = {
            firstName: fullNameStruct.firstName,
            lastName: fullNameStruct.lastName,
            titlesPrefix: titlesEffective.prefixes,
            titlesSuffix: titlesEffective.suffixes,
        };
        return displayNameFrom(base, { privacy });
    }, [fullNameStruct, titlesEffective, privacy]);

    const completeness = useMemo(() => {
        const required = ['firstName', 'lastName', 'email', 'about', 'location'];
        const src0 = isEditing ? draft : profile;
        const filled = required.filter(k => String((src0[k] || '')).trim().length > 0).length;
        const bonus = (avatarDataUrl ? 1 : 0) + (src0.phone ? 1 : 0);
        const total = required.length + 2;
        return Math.round(((filled + bonus) / total) * 100);
    }, [profile, draft, isEditing, avatarDataUrl]);

    const [dndUntil, setDndUntil] = useState(null);

    const dndActive = dndUntil && dndUntil > now;
    const dndUntilLabel = dndUntil
        ? `${fmtDate(dndUntil)} ${new Date(dndUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '';

    const startEdit = () => setIsEditing(true);
    const cancelEdit = () => { setDraft(seedStudentMissing(profile)); setIsEditing(false); };

    const handleSave = async () => {
        setSaving(true);
        try {
            const toSave = {
                ...seedStudentMissing(draft),
                displayName: displayNameFrom(draft, { privacy: false }),
                fullName: displayNameFrom(draft, { privacy: false }),
                avatarUrl: avatarDataUrl || profile.avatarUrl || null,
            };
            setProfile(toSave);
            window.dispatchEvent(new CustomEvent('mais:profile-updated', { detail: toSave }));
            window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'profile' } }));
            // Persist to backend
            try {
                const email = String(user?.email || '').trim();
                if (email) {
                    if ((toSave.role || 'student') === 'teacher') {
                        await updateFacultyProfileByEmail(email, {
                            phone: toSave.phone,
                            office: toSave.location,
                            avatarUrl: toSave.avatarUrl,
                            subjects: Array.isArray(toSave.subjects) ? toSave.subjects : undefined,
                            departments: Array.isArray(toSave.departments) ? toSave.departments : (toSave.department ? [toSave.department] : undefined),
                            officeHours: toSave.officeHours,
                        });
                    } else {
                        await updateStudentProfileByEmail(email, {
                            ...toSave,
                            avatarUrl: toSave.avatarUrl,
                        });
                    }
                    setTimeout(() => {
                        guardedNotify('profile-save-success', 'success', 'Profile saved successfully', { title: 'Profile updated' });
                    }, 300);
                }
            } catch (e) {
                setTimeout(() => {
                    guardedNotify('profile-save-error', 'error', 'Failed to save profile', { title: 'Save failed' });
                }, 100);
            }
            await new Promise(r => setTimeout(r, 250));
        } finally {
            setSaving(false);
            setIsEditing(false);
        }
    };

    const handleReset = () => {
        if (!window.confirm('Reset profile to defaults?')) return;
        const base = seedStudentMissing(baseDefault);
        const toSave = {
            ...base,
            displayName: displayNameFrom(base, { privacy: false }),
            fullName: displayNameFrom(base, { privacy: false }),
        };
        const mixed = toSave;
        setProfile(mixed);
        setDraft(mixed);
        setAvatarDataUrl(null);
        window.dispatchEvent(new CustomEvent('mais:profile-updated', { detail: mixed }));
        window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'profile' } }));
    };

    const handleAvatarPick = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const url = String(reader.result || '');
            setAvatarDataUrl(url);
        };
        reader.readAsDataURL(file);
    };

    const removeAvatar = async () => {
        if (!window.confirm('Remove avatar image?')) return;
        setAvatarDataUrl(null);
        // Clear avatar from backend
        if (profile) {
            try {
                if (currentUser.role === 'teacher') {
                    await updateFacultyProfileByEmail(currentUser.email, { avatarUrl: null });
                } else if (currentUser.role === 'student') {
                    await updateStudentProfileByEmail(currentUser.email, { avatarUrl: null });
                }
            } catch (error) {
                console.error('Failed to remove avatar from backend:', error);
            }
        }
    };

    const togglePrivacy = () => {
        const next = !privacy;
        setPrivacy(next);
        window.dispatchEvent(new CustomEvent('mais:profile-updated', { detail: { ...profile } }));
        window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'profile' } }));
    };

    const exportProfileJSON = () => {
        const payload = {
            profile,
            avatar: !!avatarDataUrl,
            exportedAt: new Date().toISOString(),
            role: profile.role,
            dndUntil,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `profile_${Date.now()}.json`; a.click();
        URL.revokeObjectURL(url);
    };

    const exportOfficeHoursICS = () => {
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//MAIS//Profile Office Hours//EN',
        ];
        const today = new Date();
        const year = today.getUTCFullYear();

        dayOrder.forEach((dKey, idx) => {
            const oh = profile.officeHours?.[dKey];
            if (!oh?.enabled) return;
            const byweekday = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][idx];
            const uid = `${dKey}-${Date.now()}@mais`;
            const [sh, sm] = String(oh.start || '10:00').split(':').map(n => parseInt(n, 10));
            const [eh, em] = String(oh.end || '11:00').split(':').map(n => parseInt(n, 10));
            const startDate = nextWeekdayUTC(idx);
            const dtStart = fmtICS(startDate, sh, sm);
            const dtEnd = fmtICS(startDate, eh, em);

            lines.push(
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `SUMMARY:${displayNameFrom(profile, { privacy: false }) || 'Office Hours'} • ${labelForDay(dKey)} Office Hours`,
                `DTSTART:${dtStart}`,
                `DTEND:${dtEnd}`,
                `RRULE:FREQ=WEEKLY;BYDAY=${byweekday};UNTIL=${year}1231T235900Z`,
                `DESCRIPTION:${profile.department ? `${profile.department} Department` : 'Office hours'}`,
                'END:VEVENT'
            );
        });

        lines.push('END:VCALENDAR');

        const blob = new Blob([lines.join('\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `office_hours_${Date.now()}.ics`; a.click();
        URL.revokeObjectURL(url);
    };

    const applyDndFor = (minutes) => {
        const until = Date.now() + minutes * 60000;
        setDndUntil(until);
        setNow(Date.now());
    };
    const applyDndUntilTomorrow = () => {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        t.setHours(8, 0, 0, 0);
        setDndUntil(+t);
        setNow(Date.now());
    };
    const clearDnd = () => {
        setDndUntil(null);
        setNow(Date.now());
    };

    const signOutDevice = async (id) => {
        if (!window.confirm('Sign out this device?')) return;
        try {
            const response = await fetch(`/api/students/sessions/${encodeURIComponent(id)}`, { 
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                setDevices(list => list.filter(d => d.id !== id));
                guardedNotify('device-signed-out', 'success', 'Device signed out successfully');
            }
        } catch (err) {
            guardedNotify('device-signout-failed', 'error', 'Failed to sign out device');
        }
    };
    const signOutAllDevices = async () => {
        if (!window.confirm('Sign out from all devices?')) return;
        try {
            // Delete all device sessions for this user
            const userId = user?.email || user?.studentId || '';
            if (!userId) return;
            
            const deletePromises = devices.map(d => 
                fetch(`/api/students/sessions/${encodeURIComponent(d.id)}`, { 
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                })
            );
            
            await Promise.all(deletePromises);
            setDevices([]);
            guardedNotify('all-devices-signed-out', 'success', 'All devices signed out');
        } catch (err) {
            guardedNotify('signout-all-failed', 'error', 'Failed to sign out all devices');
        }
    };

    const handleLogout = () => navigate('/');

    const roleOptions = isEditing
        ? (draft.role === 'teacher'
            ? [{ value: 'teacher', label: 'Teacher (locked)' }]
            : [{ value: 'student', label: 'Student' }, { value: 'teacher', label: 'Teacher' }])
        : [{ value: profile.role, label: profile.role === 'teacher' ? 'Teacher' : 'Student' }];

    const onRoleChange = (next) => {
        if (!isEditing) return;
        if (draft.role === 'teacher' && next === 'student') return;
        setDraft(prev => seedStudentMissing({ ...prev, role: next }));
    };

    const locationValid = /^Room\s+\S+\s*·\s*.+$/.test((isEditing ? draft : profile).location || '');

    const copyLocation = async () => {
        try { await navigator.clipboard?.writeText((isEditing ? draft : profile).location || ''); } catch {}
    };

    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    if (loading) return null;

    return (
        <div className="min-h-screen bg-background overflow-x-hidden thin-scrollbar">
            <Header
                userRole={profile.role}
                userName={displayFullName}
                onLogout={handleLogout}
            />

            <RoleSidebar
                userRole={profile.role}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Profile">
                <main className="flex-1">
                    <div className="px-6 pt-3 pb-6">
                        <NavigationBreadcrumb />
                        {(loadingRemoteProfile || loadingFacultyLookup) && (
                          <DataLoader
                            label="Syncing profile from MAIS…"
                            description="Refreshing identity, contact, and academic details."
                            details={[
                              'Primary profile snapshot • titles • contact channels',
                              'Faculty lookup & role-specific metadata alignment',
                              'Security preferences • session devices • avatar state',
                            ]}
                            fullScreen
                          />
                        )}

                        <Reveal as={motion.section} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true} aria-labelledby="profile-header">
                            <h2 id="profile-header" className="sr-only">Profile header</h2>
                            <ProfileHeader
                                privacy={privacy}
                                togglePrivacy={togglePrivacy}
                                avatarDataUrl={avatarDataUrl}
                                onPickAvatar={() => fileRef.current?.click()}
                                fileInputRef={fileRef}
                                handleAvatarPick={handleAvatarPick}
                                fullName={displayFullName}
                                profileRole={profile.role}
                                isTeacher={isTeacher}
                                department={profile.department}
                                about={(isEditing ? draft?.about : profile?.about) || ''}
                                isEditing={isEditing}
                                startEdit={startEdit}
                                cancelEdit={cancelEdit}
                                saving={saving}
                                handleSave={handleSave}
                                exportProfileJSON={exportProfileJSON}
                                exportOfficeHoursICS={exportOfficeHoursICS}
                                identifier={isTeacher ? (profile.employeeId || '').trim() : (profile.studentId || (profile.student || {}).studentId || '').trim()}
                                identifierLabel={isTeacher ? 'Employee ID' : 'Student ID'}
                            />
                        </Reveal>

                        {dndActive && (
                            <Reveal as={motion.div} delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="keycap" waitForLoaders={true}
                                className="mt-4 sm:mt-5 mb-4 sm:mb-6 p-3 rounded-md border border-warning/40 bg-warning/10 text-warning flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                                role="status"
                                aria-live="polite"
                            >
                                <div className="flex items-center gap-2">
                                    <Icon name="BellOff" size={16} />
                                    <span className="text-sm">
                    Do Not Disturb enabled — until {dndUntilLabel}
                  </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={clearDnd}>Turn off</Button>
                                    <Button size="sm" variant="ghost" onClick={() => applyDndFor(30)}>+30 min</Button>
                                </div>
                            </Reveal>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
                            <Reveal as={motion.div} className="xl:col-span-8 space-y-4 sm:space-y-6 min-w-0" delay={ANIMATION_DELAYS.FILTERS} variant="keycap" waitForLoaders={true}>
                                <section aria-labelledby="profile-info">
                                    <h3 id="profile-info" className="sr-only">Profile info</h3>
                                    <ProfileInfoForm
                                        isEditing={isEditing}
                                        draft={draft}
                                        profile={profile}
                                        setDraft={setDraft}
                                        completeness={completeness}
                                        roleOptions={roleOptions}
                                        onRoleChange={onRoleChange}
                                        privacy={privacy}
                                        splitCSV={splitCSV}
                                        locationValid={locationValid}
                                        onCopyLocation={copyLocation}
                                        coursesOptions={coursesOptions}
                                        user={user}
                                        showChangePasswordModal={showChangePasswordModal}
                                        setShowChangePasswordModal={setShowChangePasswordModal}
                                    />
                                </section>

                                {isTeacher && (
                                    <>
                                        <Reveal as={motion.section} aria-labelledby="titles-panel" delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="keycap" waitForLoaders={true}>
                                            <h3 id="titles-panel" className="sr-only">Titles</h3>
                                            <TitlesPanel
                                                editable={isEditing}
                                                prefixes={titlesEffective.prefixes}
                                                suffixes={titlesEffective.suffixes}
                                                titleHistory={titleHistory}
                                                baseName={`${fullNameStruct.firstName || ''} ${fullNameStruct.lastName || ''}`.trim()}
                                                onChange={({ prefixes, suffixes }) => {
                                                    setDraft(prev => ({
                                                        ...prev,
                                                        titlesPrefix: prefixes,
                                                        titlesSuffix: suffixes,
                                                        titles: { prefix: prefixes, suffix: suffixes },
                                                    }));
                                                }}
                                            />
                                        </Reveal>

                                        <Reveal as={motion.section} aria-labelledby="certificates-panel" delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                                            <h3 id="certificates-panel" className="sr-only">Certificates</h3>
                                            <CertificatesPanel
                                                certs={isEditing ? (draft.certifications || []) : (profile.certifications || [])}
                                                editable={isEditing}
                                                onChange={(next) => setDraft(prev => ({ ...prev, certifications: next }))}
                                            />
                                        </Reveal>

                                        {/* Academic Background */}
                                        {(profile.academicDegree || profile.degreeField || profile.almaMater) && (
                                            <Reveal as={motion.section} aria-labelledby="academic-background" delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                                                <div className="card">
                                                    <h3 id="academic-background" className="text-base font-semibold text-foreground mb-4">Academic Background</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {profile.academicDegree && (
                                                            <div>
                                                                <span className="text-sm text-muted-foreground">Degree</span>
                                                                <div className="mt-1 text-sm text-foreground">{profile.academicDegree}</div>
                                                            </div>
                                                        )}
                                                        {profile.degreeField && (
                                                            <div>
                                                                <span className="text-sm text-muted-foreground">Field</span>
                                                                <div className="mt-1 text-sm text-foreground">{profile.degreeField}</div>
                                                            </div>
                                                        )}
                                                        {profile.almaMater && (
                                                            <div>
                                                                <span className="text-sm text-muted-foreground">Alma Mater</span>
                                                                <div className="mt-1 text-sm text-foreground">{profile.almaMater}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Reveal>
                                        )}

                                        {/* Expertise */}
                                        {profile.expertise && profile.expertise.length > 0 && (
                                            <Reveal as={motion.section} aria-labelledby="expertise" delay={ANIMATION_DELAYS.MAIN_CONTENT + 0.02} variant="keycap" waitForLoaders={true}>
                                                <div className="card">
                                                    <h3 id="expertise" className="text-base font-semibold text-foreground mb-3">Areas of Expertise</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {profile.expertise.map((exp, idx) => (
                                                            <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                                                {exp}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </Reveal>
                                        )}

                                        {/* Research Interests */}
                                        {profile.researchInterests && profile.researchInterests.length > 0 && (
                                            <Reveal as={motion.section} aria-labelledby="research-interests" delay={ANIMATION_DELAYS.MAIN_CONTENT + 0.04} variant="keycap" waitForLoaders={true}>
                                                <div className="card">
                                                    <h3 id="research-interests" className="text-base font-semibold text-foreground mb-3">Research Interests</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {profile.researchInterests.map((interest, idx) => (
                                                            <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                                                {interest}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </Reveal>
                                        )}

                                        {/* Publications */}
                                        {profile.publications && Array.isArray(profile.publications) && profile.publications.length > 0 && (
                                            <Reveal as={motion.section} aria-labelledby="publications" delay={ANIMATION_DELAYS.MAIN_CONTENT + 0.06} variant="keycap" waitForLoaders={true}>
                                                <div className="card">
                                                    <h3 id="publications" className="text-base font-semibold text-foreground mb-3">Publications</h3>
                                                    <div className="space-y-3">
                                                        {profile.publications.map((pub, idx) => (
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
                                            </Reveal>
                                        )}

                                        {/* Languages */}
                                        {profile.languages && Array.isArray(profile.languages) && profile.languages.length > 0 && (
                                            <Reveal as={motion.section} aria-labelledby="languages" delay={ANIMATION_DELAYS.MAIN_CONTENT + 0.08} variant="keycap" waitForLoaders={true}>
                                                <div className="card">
                                                    <h3 id="languages" className="text-base font-semibold text-foreground mb-3">Languages</h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                        {profile.languages.map((lang, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border">
                                                                <span className="text-sm font-medium text-foreground">{lang.language}</span>
                                                                <span className="text-xs text-muted-foreground">{lang.proficiency}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </Reveal>
                                        )}

                                        <Reveal as={motion.section} aria-labelledby="office-hours" delay={ANIMATION_DELAYS.PAGINATION} variant="keycap" waitForLoaders={true}>
                                            <h3 id="office-hours" className="sr-only">Office hours</h3>
                                            <OfficeHours
                                                isEditing={isEditing}
                                                officeHours={(isEditing ? draft : profile).officeHours || {}}
                                                onToggle={(day) => setDraft(prev => {
                                                    const prevOH = prev.officeHours?.[day] || { enabled: false, start: '10:00', end: '11:00' };
                                                    return { ...prev, officeHours: { ...(prev.officeHours || {}), [day]: { ...prevOH, enabled: !prevOH.enabled } } };
                                                })}
                                                onStartChange={(day, v) => setDraft(prev => ({ ...prev, officeHours: { ...(prev.officeHours || {}), [day]: { ...((prev.officeHours || {})[day] || {}), start: v } } }))}
                                                onEndChange={(day, v) => setDraft(prev => ({ ...prev, officeHours: { ...(prev.officeHours || {}), [day]: { ...((prev.officeHours || {})[day] || {}), end: v } } }))}
                                                role="teacher"
                                            />
                                        </Reveal>
                                    </>
                                )}

                                <Reveal as={motion.div} delay={ANIMATION_DELAYS.PAGINATION + 0.04} variant="keycap" waitForLoaders={true}>
                                    <BankAccountsPanel
                                        studentId={profile.id || profile.studentId}
                                        isEditing={isEditing}
                                    />
                                </Reveal>
                            </Reveal>

                            <Reveal as={motion.div} className="xl:col-span-4 space-y-4 sm:space-y-6" delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="keycap" waitForLoaders={true}>
                                <section aria-labelledby="dnd-panel">
                                    <h3 id="dnd-panel" className="sr-only">Do Not Disturb</h3>
                                    <DndPanel
                                        dndActive={!!dndActive}
                                        dndUntil={dndUntil}
                                        applyDndFor={applyDndFor}
                                        applyDndUntilTomorrow={applyDndUntilTomorrow}
                                        clearDnd={clearDnd}
                                    />
                                </section>

                                <section aria-labelledby="theme-panel">
                                    <h3 id="theme-panel" className="sr-only">Appearance</h3>
                                    <ThemePanel themePref={themePref} setThemePref={setThemePref} />
                                </section>

                                <Reveal as={motion.section} aria-labelledby="language-panel" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + 0.03} variant="keycap" waitForLoaders={true}>
                                    <h3 id="language-panel" className="sr-only">Language</h3>
                                    <LanguageSwitcher />
                                </Reveal>

                                <Reveal as={motion.section} aria-labelledby="cookie-settings-panel" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + 0.04} variant="keycap" waitForLoaders={true}>
                                    <h3 id="cookie-settings-panel" className="sr-only">Cookie Settings</h3>
                                    <CookieSettingsPanel />
                                </Reveal>

                                <Reveal as={motion.section} aria-labelledby="devices-panel" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + 0.06} variant="keycap" waitForLoaders={true}>
                                    <h3 id="devices-panel" className="sr-only">Devices</h3>
                                    <DevicesPanel
                                        devices={devices}
                                        timeAgo={timeAgo}
                                        signOutAllDevices={signOutAllDevices}
                                        signOutDevice={signOutDevice}
                                    />
                                </Reveal>

                                <Reveal as={motion.section} aria-labelledby="danger-zone" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + 0.09} variant="keycap" waitForLoaders={true}>
                                    <h3 id="danger-zone" className="sr-only">Danger zone</h3>
                                    <DangerZone removeAvatar={removeAvatar} handleReset={handleReset} />
                                </Reveal>

                                <Reveal as={motion.section} aria-labelledby="variable-symbols" delay={ANIMATION_DELAYS.PAGINATION} variant="keycap" waitForLoaders={true}>
                                    <h3 id="variable-symbols" className="sr-only">Variable Symbols</h3>
                                    <VariableSymbolsPanel
                                        isEditing={isEditing}
                                        canEdit={isTeacher}
                                        symbols={(isEditing ? draft : profile).paymentSymbols || { accommodation: [], study: [], other: [] }}
                                        onChange={(next) => setDraft(p => ({ ...p, paymentSymbols: next }))}
                                    />
                                </Reveal>

                            </Reveal>
                        </div>

                    </div>
                </main>

                <PageFooter
                    left={[
                        `MAIS 2.0 • ${profile.role === 'teacher' ? 'Teacher' : 'Student'} Portal`,
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
                    containerClassName="px-6"
                    borderClassName="border-top border-t border-border"
                    actionsWrapperClassName="flex items-center gap-3"
                />
            </div>
        </div>
    );
};

const ProfilePage = () => {
    return (
        <ToastsProvider>
            <ProfilePageInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default ProfilePage;