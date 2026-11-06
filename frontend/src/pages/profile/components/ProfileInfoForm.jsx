// src/pages/profile/components/ProfileInfoForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Textarea from '../../../components/ui/Textarea';
import MultiSelect from '../../../components/ui/MultiSelect';
import { Checkbox } from '../../../components/ui/Checkbox';
import Icon from '../../../components/AppIcon';
import ChangePasswordModal from '../../../components/ui/ChangePasswordModal';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchFacultyOptions } from '../../../data/facultyOptionsApi';
import { fetchPrograms } from '../../../data/programsApi';
import { fetchDepartments } from '../../../data/departmentsApi';
import { fetchCoursesForManagement } from '../../../data/maisApiAdapter';
import { fetchRooms } from '../../../data/roomsApi';
import useDataUpdates from '../../../hooks/useDataUpdates';

const PERSONAL_DATA_PDF = '/assets/docs/Osobny/SuhlasSoSpracovanimOsobnychUdajovAbsolventa.pdf';

const SectionTitle = ({ children, right }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2">
        <h3 className="text-base font-semibold text-foreground">{children}</h3>
        {right}
    </div>
);

const Row = ({ children }) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;

const ProfileInfoForm = ({
                             isEditing,
                             draft,
                             profile,
                             setDraft,
                             completeness,
                             roleOptions,
                             onRoleChange,
                             privacy,
                             splitCSV,
                             locationValid,
                             onCopyLocation,
                             coursesOptions = [],
                             user,
                             showChangePasswordModal = false,
                             setShowChangePasswordModal = () => {},
                         }) => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [faculties, setFaculties] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [rooms, setRooms] = useState([]);
    
    const src = isEditing ? draft : profile;
    const student = src.student || {};
    const setStudent = (patch) => setDraft((p) => ({ ...p, student: { ...(p.student || {}), ...patch } }));
    const full = 'min-w-0 w-full [&_input]:w-full [&_textarea]:w-full [&_select]:w-full';

    const role = (isEditing ? draft.role : profile.role) || 'student';
    const isTeacher = role === 'teacher';

    const studentEditable = new Set([
        'firstName',
        'lastName',
        'email',
        'phone',
        'phone2',
        'altEmail',
        'location',
        'about',
        'faculty',
        'program',
        'departmentCode',
        'address',
        'birthDate',
        'birthPlace',
        'nationality',
        'parentName',
        'className',
        'isicCardNumber',
        'studentNumber',
        'studyNumber',
        'passportId',
        'familyStatus',
        'healthStatus',
        'consentPersonalData',
        'consentCompanyOffers',
    ]);

    const canEdit = (key) => {
        if (!isEditing) return false;
        if (isTeacher) return true;
        return studentEditable.has(key);
    };

    // Load faculties, departments, and programs from backend
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [facultiesData, departmentsData, coursesData, roomsData] = await Promise.all([
                    fetchFacultyOptions(),
                    fetchDepartments(),
                    fetchCoursesForManagement({ ttl: 0 }),
                    fetchRooms()
                ]);
                if (!cancelled) {
                    setFaculties(Array.isArray(facultiesData) ? facultiesData : []);
                    setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
                    setCourses(Array.isArray(coursesData) ? coursesData : []);
                    setRooms(Array.isArray(roomsData) ? roomsData.filter(r => r.active !== false) : []);
                }
            } catch (err) {
                console.error('[ProfileInfoForm] Failed to load data:', err);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Load programs when faculty or department changes
    useEffect(() => {
        const faculty = src.faculty || student.faculty || '';
        const departmentCode = src.departmentCode || student.departmentCode || '';
        if (!faculty && !departmentCode) {
            setPrograms([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const filters = {};
                if (faculty) filters.faculty = faculty;
                if (departmentCode) filters.departmentId = departmentCode;
                const programsData = await fetchPrograms(filters);
                if (!cancelled) {
                    setPrograms(Array.isArray(programsData) ? programsData : []);
                }
            } catch (err) {
                console.error('[ProfileInfoForm] Failed to load programs:', err);
                if (!cancelled) setPrograms([]);
            }
        })();
        return () => { cancelled = true; };
    }, [src.faculty, student.faculty, src.departmentCode, student.departmentCode]);
    
    // Listen for room updates via SignalR
    const handleDataUpdate = useCallback(async (payload) => {
        if (payload?.type === 'room.updated') {
            console.log('[ProfileInfoForm] Room updated via SignalR, reloading rooms...');
            try {
                const roomsData = await fetchRooms();
                setRooms(Array.isArray(roomsData) ? roomsData.filter(r => r.active !== false) : []);
            } catch (err) {
                console.error('[ProfileInfoForm] Failed to reload rooms:', err);
            }
        }
    }, []);
    
    useDataUpdates(handleDataUpdate);

    return (
        <section className="bg-card rounded-lg border border-border p-4 sm:p-6 space-y-4 thin-scrollbar">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <h2 className="text-lg font-semibold">Profile Information</h2>
                <div className="text-sm text-muted-foreground">
                    Completeness: <span className="font-medium text-foreground">{completeness}%</span>
                </div>
            </div>

            <div className={`space-y-3 ${!isEditing ? 'opacity-90' : ''}`}>
                <Row>
                    <div className={full}>
                        <Input
                            label="First name"
                            value={src.firstName}
                            onChange={(e) => setDraft((p) => ({ ...p, firstName: e.target.value }))}
                            disabled={!canEdit('firstName')}
                        />
                    </div>
                    <div className={full}>
                        <Input
                            label="Last name"
                            value={src.lastName}
                            onChange={(e) => setDraft((p) => ({ ...p, lastName: e.target.value }))}
                            disabled={!canEdit('lastName')}
                        />
                    </div>
                </Row>

                <Row>
                    <div className={full}>
                        <Input
                            label="Email"
                            type="email"
                            value={src.email}
                            onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                            disabled={!canEdit('email')}
                        />
                    </div>
                    <div className={full}>
                        <Input
                            label="Phone"
                            value={src.phone}
                            onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                            disabled={!canEdit('phone')}
                        />
                    </div>
                </Row>

                {/* Password Field with Show/Hide and Change Button */}
                <div className="sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <label className="block text-sm font-medium text-foreground">Password</label>
                        <Button 
                            size="xs" 
                            variant="primary" 
                            onClick={() => setShowChangePasswordModal(true)}
                            iconName="lock"
                        >
                            Change Password
                        </Button>
                    </div>
                    <div className={`${full} relative`}>
                        <Input
                            type={showPassword ? 'text' : 'password'}
                            value="••••••••••••"
                            disabled={true}
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Your password is encrypted and cannot be displayed. Click "Change Password" to update it.
                    </p>
                </div>

                <div className="sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="block text-sm font-medium text-foreground">Office / Location</label>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button size="xs" variant="ghost" iconName="Copy" onClick={onCopyLocation}>Copy</Button>
                            {src.location && (
                                <a
                                    className="text-xs underline text-muted-foreground hover:text-foreground"
                                    href={`https://www.google.com/maps/search/${encodeURIComponent(src.location || '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open map
                                </a>
                            )}
                        </div>
                    </div>
                    <div className={full}>
                        {isEditing && isTeacher ? (
                            <Select
                                value={src.location ?? ''}
                                onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                                options={[
                                    { value: '', label: 'Select office room...' },
                                    ...rooms
                                        .filter(r => r.active !== false)
                                        .map(r => ({
                                            value: r.name,
                                            label: `${r.name}${r.building ? ` (${r.building})` : ''}${r.floor ? `, Floor ${r.floor}` : ''}`
                                        }))
                                ]}
                                disabled={!canEdit('location')}
                            />
                        ) : (
                            <Input
                                value={src.location ?? ''}
                                onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                                placeholder="Room 205 · Main Building"
                                disabled={!canEdit('location')}
                            />
                        )}
                    </div>
                    {isEditing && isTeacher && rooms.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                            No rooms available. Please add rooms in Resource Management first.
                        </p>
                    )}
                    {!isEditing && !isTeacher && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                                className={`text-[11px] px-2 py-0.5 rounded border ${
                                    locationValid
                                        ? 'bg-success/10 text-success border-success/20'
                                        : 'bg-destructive/10 text-destructive border-destructive/20'
                                }`}
                            >
                              {locationValid ? 'Valid format' : 'Format: Room {ID} · {Building}'}
                            </span>
                        </div>
                    )}
                </div>

                <div className={`sm:col-span-2 ${full}`}>
                    <Select
                        label="Role"
                        value={src.role}
                        onChange={onRoleChange}
                        options={roleOptions}
                        disabled={!isTeacher || !isEditing}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                        {isTeacher ? 'Teacher role can modify all fields.' : 'Students can edit phone, emails, address, consents, photo, and bank connections.'}
                    </p>
                </div>

                <div className={`sm:col-span-2 ${full}`}>
                    <Textarea
                        label="About"
                        minRows={4}
                        value={role === 'student' ? (student.about || '') : (src.about || '')}
                        onChange={(e) => {
                            if (role === 'student') {
                                setStudent({ about: e.target.value });
                            } else {
                                setDraft((p) => ({ ...p, about: e.target.value }));
                            }
                        }}
                        disabled={!canEdit('about')}
                    />
                </div>

                {(isEditing ? draft.role : profile.role) === 'teacher' && (
                    <>
                        <SectionTitle>Academic Information</SectionTitle>
                        <Row>
                            <div className={full}>
                                <Select
                                    label="Faculty"
                                    options={faculties.map(f => ({ value: f.code || f.Code, label: f.nameEn || f.NameEn || f.code }))}
                                    value={src.faculty || ''}
                                    onChange={(v) => {
                                        const val = typeof v === 'string' ? v : v?.value || '';
                                        setDraft((p) => ({ ...p, faculty: val }));
                                    }}
                                    clearable={true}
                                    placeholder="Select faculty"
                                    disabled={!isEditing}
                                />
                            </div>
                            <div className={full}>
                                <Select
                                    label="Program"
                                    options={programs.map(p => ({ value: p.name || p.Name, label: p.name || p.Name }))}
                                    value={src.program || ''}
                                    onChange={(v) => {
                                        const val = typeof v === 'string' ? v : v?.value || '';
                                        setDraft((p) => ({ ...p, program: val }));
                                    }}
                                    clearable={true}
                                    placeholder={!src.faculty ? "Select faculty first" : "Select program"}
                                    disabled={!isEditing || !src.faculty}
                                />
                            </div>
                        </Row>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                            <div className={full}>
                                <MultiSelect
                                    label="Departments"
                                    value={(() => {
                                        // Handle both array of strings and single department value
                                        let deptValues = [];
                                        if (Array.isArray(src.departments)) {
                                            deptValues = src.departments;
                                        } else if (src.department) {
                                            deptValues = [src.department];
                                        }
                                        // Extract department names (handle "Name (CODE)" format)
                                        return deptValues.map(d => {
                                            if (typeof d === 'string') {
                                                // Extract just the name part before (CODE) if present
                                                const match = d.match(/^(.+?)\s*\([^)]+\)$/);
                                                return match ? match[1].trim() : d.trim();
                                            }
                                            return d;
                                        });
                                    })()}
                                    onChange={(vals) => setDraft((p) => ({ ...p, departments: vals }))}
                                    options={departments.map(d => ({ 
                                        value: d.name || d.Name, 
                                        label: `${d.name || d.Name}${d.code ? ` (${d.code})` : ''}` 
                                    }))}
                                    placeholder="Select departments..."
                                    disabled={!isEditing}
                                />
                            </div>
                            <div className={full}>
                                <MultiSelect
                                    label="Subjects (Courses)"
                                    value={src.subjects || []}
                                    onChange={(vals) => setDraft((p) => ({ ...p, subjects: vals }))}
                                    options={courses.map(c => ({ value: c.code || c.Code, label: `${c.code || c.Code} - ${c.name || c.Name || c.nameEn || 'Untitled'}` }))}
                                    placeholder="Select courses..."
                                    disabled={!isEditing}
                                />
                            </div>
                            <div className={full}>
                                <Input
                                    label="Years of experience"
                                    type="number"
                                    value={src.yearsExperience || ''}
                                    onChange={(e) => setDraft((p) => ({ ...p, yearsExperience: parseInt(e.target.value || '0', 10) }))}
                                    disabled={!isEditing}
                                />
                            </div>
                        </div>
                    
                    <div className="space-y-4 pt-4 border-t border-border mt-4">
                        <SectionTitle>Research & Expertise</SectionTitle>
                        <div className={full}>
                            <MultiSelect
                                label="Expertise Areas"
                                value={src.expertise || []}
                                onChange={(vals) => setDraft((p) => ({ ...p, expertise: vals }))}
                                options={[]}
                                placeholder="Add expertise areas..."
                                creatable={true}
                                disabled={!isEditing}
                            />
                            {!isEditing && (src.expertise || []).length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {(src.expertise || []).map((exp, idx) => (
                                        <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                            {exp}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={full}>
                            <MultiSelect
                                label="Research Interests"
                                value={src.researchInterests || []}
                                onChange={(vals) => setDraft((p) => ({ ...p, researchInterests: vals }))}
                                options={[]}
                                placeholder="Add research interests..."
                                creatable={true}
                                disabled={!isEditing}
                            />
                            {!isEditing && (src.researchInterests || []).length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {(src.researchInterests || []).map((interest, idx) => (
                                        <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                            {interest}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-border mt-4">
                        <SectionTitle>Languages</SectionTitle>
                        <div className={full}>
                            {isEditing ? (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-foreground">Languages & Proficiency</label>
                                    <p className="text-xs text-muted-foreground mb-2">Format: Language - Proficiency (e.g., "Slovak - Native")</p>
                                    {(src.languages || []).map((lang, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <Input
                                                placeholder="Language (e.g., Slovak)"
                                                value={lang.language || ''}
                                                onChange={(e) => {
                                                    const updated = [...(src.languages || [])];
                                                    updated[idx] = { ...updated[idx], language: e.target.value };
                                                    setDraft((p) => ({ ...p, languages: updated }));
                                                }}
                                            />
                                            <Input
                                                placeholder="Proficiency (e.g., Native)"
                                                value={lang.proficiency || ''}
                                                onChange={(e) => {
                                                    const updated = [...(src.languages || [])];
                                                    updated[idx] = { ...updated[idx], proficiency: e.target.value };
                                                    setDraft((p) => ({ ...p, languages: updated }));
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = (src.languages || []).filter((_, i) => i !== idx);
                                                    setDraft((p) => ({ ...p, languages: updated }));
                                                }}
                                                className="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = [...(src.languages || []), { language: '', proficiency: '' }];
                                            setDraft((p) => ({ ...p, languages: updated }));
                                        }}
                                        className="px-4 py-2 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-md"
                                    >
                                        + Add Language
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {(src.languages || []).map((lang, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                                            <span className="text-sm font-medium text-foreground">{lang.language}</span>
                                            <span className="text-xs text-muted-foreground">{lang.proficiency}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-border mt-4">
                        <SectionTitle>Publications</SectionTitle>
                        <div className={full}>
                            {isEditing ? (
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-foreground">Academic Publications</label>
                                    {(src.publications || []).map((pub, idx) => (
                                        <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                                            <Input
                                                placeholder="Publication Title"
                                                value={pub.title || ''}
                                                onChange={(e) => {
                                                    const updated = [...(src.publications || [])];
                                                    updated[idx] = { ...updated[idx], title: e.target.value };
                                                    setDraft((p) => ({ ...p, publications: updated }));
                                                }}
                                            />
                                            <Input
                                                placeholder="Journal/Conference"
                                                value={pub.journal || ''}
                                                onChange={(e) => {
                                                    const updated = [...(src.publications || [])];
                                                    updated[idx] = { ...updated[idx], journal: e.target.value };
                                                    setDraft((p) => ({ ...p, publications: updated }));
                                                }}
                                            />
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Year"
                                                    type="number"
                                                    value={pub.year || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(src.publications || [])];
                                                        updated[idx] = { ...updated[idx], year: e.target.value };
                                                        setDraft((p) => ({ ...p, publications: updated }));
                                                    }}
                                                />
                                                <Input
                                                    placeholder="URL (optional)"
                                                    value={pub.url || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(src.publications || [])];
                                                        updated[idx] = { ...updated[idx], url: e.target.value };
                                                        setDraft((p) => ({ ...p, publications: updated }));
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = (src.publications || []).filter((_, i) => i !== idx);
                                                        setDraft((p) => ({ ...p, publications: updated }));
                                                    }}
                                                    className="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = [...(src.publications || []), { title: '', journal: '', year: '', url: '' }];
                                            setDraft((p) => ({ ...p, publications: updated }));
                                        }}
                                        className="px-4 py-2 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-md"
                                    >
                                        + Add Publication
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(src.publications || []).map((pub, idx) => (
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
                            )}
                        </div>
                    </div>
                    </>
                )}

                {(isEditing ? draft.role : profile.role) === 'student' && (
                    <div className="space-y-4 pt-2 border-t border-border">
                        <SectionTitle>Academic Information</SectionTitle>
                        
                        <Row>
                            <div className={full}>
                                {canEdit('faculty') ? (
                                    <Select
                                        label="Faculty"
                                        options={faculties.map(f => ({ value: f.code || f.Code, label: f.nameEn || f.NameEn || f.code }))}
                                        value={student.faculty || src.faculty || ''}
                                        onChange={(v) => {
                                            const val = typeof v === 'string' ? v : v?.value || '';
                                            setStudent({ faculty: val });
                                            setDraft((p) => ({ ...p, faculty: val }));
                                        }}
                                        clearable={true}
                                        placeholder="Select faculty"
                                        disabled={!isEditing}
                                    />
                                ) : (
                                    <>
                                        <label className="block text-sm font-medium text-foreground">Faculty</label>
                                        <div className="mt-1 text-sm text-foreground">
                                            {student.faculty || src.faculty || '—'}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className={full}>
                                {canEdit('program') ? (
                                    <Select
                                        label="Program"
                                        options={programs.map(p => ({ value: p.name || p.Name, label: p.name || p.Name }))}
                                        value={student.program || src.program || ''}
                                        onChange={(v) => {
                                            const val = typeof v === 'string' ? v : v?.value || '';
                                            setStudent({ program: val });
                                            setDraft((p) => ({ ...p, program: val }));
                                        }}
                                        clearable={true}
                                        placeholder={!student.faculty && !src.faculty ? "Select faculty first" : "Select program"}
                                        disabled={!isEditing || (!student.faculty && !src.faculty)}
                                    />
                                ) : (
                                    <>
                                        <label className="block text-sm font-medium text-foreground">Program</label>
                                        <div className="mt-1 text-sm text-foreground">
                                            {student.program || src.program || '—'}
                                        </div>
                                    </>
                                )}
                            </div>
                        </Row>
                        
                        <SectionTitle>Student Identifiers</SectionTitle>

                        <Row>
                            <div className={full}>
                                <Input
                                    label="Class"
                                    value={student.className || ''}
                                    onChange={(e) => setStudent({ className: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                            <div className={full}>
                                <Input
                                    label="ISIC Card Number"
                                    value={student.isicCardNumber || ''}
                                    onChange={(e) => setStudent({ isicCardNumber: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                        </Row>

                        <Row>
                            <div className={full}>
                                <Input
                                    label="Student Number"
                                    value={student.studentNumber || ''}
                                    onChange={(e) => setStudent({ studentNumber: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                            <div className={full}>
                                <Input
                                    label="Study Number"
                                    value={student.studyNumber || ''}
                                    onChange={(e) => setStudent({ studyNumber: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                        </Row>

                        <Row>
                            <div className={full}>
                                <Input
                                    label="Passport / ID"
                                    value={student.passportId || ''}
                                    onChange={(e) => setStudent({ passportId: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                        </Row>

                        <SectionTitle>Personal Details</SectionTitle>
                        <Row>
                            <div className={full}>
                                <Input
                                    label="Birth Date"
                                    type="date"
                                    value={student.birthDate || ''}
                                    onChange={(e) => setStudent({ birthDate: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                            <div className={full}>
                                <Input
                                    label="Birth Place"
                                    value={student.birthPlace || ''}
                                    onChange={(e) => setStudent({ birthPlace: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                        </Row>
                        <Row>
                            <div className={full}>
                                <Input
                                    label="Nationality"
                                    value={student.nationality || ''}
                                    onChange={(e) => setStudent({ nationality: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                            <div className={full}>
                                <Input
                                    label="Family Status"
                                    value={student.familyStatus || ''}
                                    onChange={(e) => setStudent({ familyStatus: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                        </Row>
                        <Row>
                            <div className={full}>
                                <Input
                                    label="Health Status"
                                    value={student.healthStatus || ''}
                                    onChange={(e) => setStudent({ healthStatus: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                            <div className={full}>
                                <Input
                                    label="Permanent Address"
                                    value={student.address || ''}
                                    onChange={(e) => setStudent({ address: e.target.value })}
                                    disabled={!canEdit('address')}
                                />
                            </div>
                        </Row>

                        <SectionTitle>Contacts</SectionTitle>
                        <Row>
                            <div className={full}>
                                <Input
                                    label="Secondary Phone"
                                    value={draft.phone2 || ''}
                                    onChange={(e) => setDraft((p) => ({ ...p, phone2: e.target.value }))}
                                    disabled={!canEdit('phone2')}
                                />
                            </div>
                            <div className={full}>
                                <Input
                                    label="Personal Email"
                                    type="email"
                                    value={draft.altEmail || ''}
                                    onChange={(e) => setDraft((p) => ({ ...p, altEmail: e.target.value }))}
                                    disabled={!canEdit('altEmail')}
                                />
                            </div>
                        </Row>
                        <Row>
                            <div className={full}>
                                <Input
                                    label="Parent"
                                    value={student.parentName || ''}
                                    onChange={(e) => setStudent({ parentName: e.target.value })}
                                    disabled={!isTeacher || !isEditing}
                                />
                            </div>
                        </Row>

                        <SectionTitle>Consents</SectionTitle>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-center justify-between gap-2">
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={!!student.consentPersonalData}
                                        onChange={(e) => setStudent({ consentPersonalData: !!e?.target?.checked })}
                                        disabled={!canEdit('consentPersonalData')}
                                    />
                                    <a
                                        href={PERSONAL_DATA_PDF}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="underline text-muted-foreground hover:text-foreground"
                                    >
                                        Consent to the processing of graduate’s personal data
                                    </a>
                                </label>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={!!student.consentCompanyOffers}
                                    onChange={(e) => setStudent({ consentCompanyOffers: !!e?.target?.checked })}
                                    disabled={!canEdit('consentCompanyOffers')}
                                />
                                <span>Consent to receiving company offers</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <ChangePasswordModal
                open={showChangePasswordModal}
                onClose={() => setShowChangePasswordModal(false)}
                onSuccess={() => {
                    // Clear the password change toast flag so it won't show again
                    if (user?.email) {
                        localStorage.removeItem(`pwd-toast-shown-${user.email}`);
                    }
                    // After successful password change, log out user to re-login with new password
                    setTimeout(() => {
                        logout();
                        navigate('/login', { state: { message: 'Password changed successfully. Please log in with your new password.' } });
                    }, 1500);
                }}
            />
        </section>
    );
};

export default ProfileInfoForm;