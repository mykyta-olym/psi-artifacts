// src/pages/terminy/TeacherExamTerms.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import TabBar from '../../components/ui/TabBar';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import { asString, to2 } from './utils/terminyUtils';
import { listTeacherTerms, createExamTerm, updateExamTerm, deleteExamTerm, listRegistrationsForTerm } from '../../data/examsApi';
import { fetchTeacherCourses, fetchFaculty, fetchTeacherTimetable } from '../../data/maisApiAdapter';
import { fetchRooms } from '../../data/roomsApi';
import DataLoader from '../../components/ui/DataLoader';
import { useAuth } from '../../contexts/AuthContext';
import { formatLastLogin } from '../../utils/datetime';
import { extractApiErrorMessage } from '../../utils/apiErrors';
import useDataUpdates from '../../hooks/useDataUpdates';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';

function toLocalInput(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const y = d.getFullYear();
  const mo = to2(d.getMonth() + 1);
  const da = to2(d.getDate());
  const h = to2(d.getHours());
  const m = to2(d.getMinutes());
  return `${y}-${mo}-${da}T${h}:${m}`;
}
function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return d.toISOString();
}

const emptyDraft = {
  id: null,
  courseCode: '',
  courseName: '',
  credits: '',
  startAt: '',
  endAt: '',
  room: '',
  examiner: '',
  capacity: 0,
};

const TeacherExamTermsInner = () => {
  const { notify } = useToasts();
  const { user } = useAuth();
  const { isBlocked } = useGlobalLoaderBlocking();
  const toastGuards = useRef({});
  const guardedNotify = useCallback(
    (key, type, message, opts = {}) => {
      if (key) {
        const now = Date.now();
        const lock = opts.lockMs ?? 3200;
        const prev = toastGuards.current[key] ?? 0;
        if (now - prev < lock) return;
        toastGuards.current[key] = now;
      }
      notify(type, message, opts);
    },
    [notify]
  );
  const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingExaminers, setLoadingExaminers] = useState(true);

  const [range, setRange] = useState('all');
  const [search, setSearch] = useState('');
  
  // Filters for Terms tab
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterExaminer, setFilterExaminer] = useState('all');
  const [filterRoom, setFilterRoom] = useState('all'); // 'all', 'yes', 'no'
  
  const [courseOptions, setCourseOptions] = useState([]);
  const [courseByCode, setCourseByCode] = useState(new Map());
  const [coursesByExaminer, setCoursesByExaminer] = useState(new Map()); // email -> courses
  const [roomOptions, setRoomOptions] = useState([]);
  const [examinerOptions, setExaminerOptions] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [regFor, setRegFor] = useState(null);
  const [regs, setRegs] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [activeTab, setActiveTab] = useState('terms');
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [loadingAllRegs, setLoadingAllRegs] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  
  // Filters for Registrations tab
  const [regFilterCourse, setRegFilterCourse] = useState('all');
  const [regFilterStudent, setRegFilterStudent] = useState('all');
  const [regFilterDateFrom, setRegFilterDateFrom] = useState('');
  const [regFilterDateTo, setRegFilterDateTo] = useState('');
  const [examinerNames, setExaminerNames] = useState(() => new Map()); // email -> fullName
  const [scheduleConflicts, setScheduleConflicts] = useState([]);
  const [teacherSchedule, setTeacherSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [showTimeSlots, setShowTimeSlots] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await listTeacherTerms({ range });
      setTerms(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = extractApiErrorMessage(e, 'Failed to load terms');
      guardedNotify('teacher-terms-load', 'error', msg, { title: 'Server error', lockMs: 4000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload();   }, [range]);

  // Listen for data updates via SignalR
  const handleDataUpdate = useCallback((payload) => {
    if (!payload || !payload.type) return;
    
    if (payload.type === 'exam.updated' || payload.type === 'exam.created' || payload.type === 'exam.deleted') {
      reload();
      
      // Reload teacher schedule when exam terms change
      if (draft.examiner) {
        fetchTeacherTimetable(draft.examiner)
          .then(schedule => {
            console.log('[TeacherExamTerms] Schedule reloaded after SignalR update:', schedule);
            setTeacherSchedule(Array.isArray(schedule) ? schedule : []);
          })
          .catch(err => console.warn('[TeacherExamTerms] Failed to reload schedule after update:', err));
      }
    }
  }, [reload, draft.examiner]);

  useDataUpdates(handleDataUpdate);

  // Load rooms from resource management
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRooms(true);
        const rooms = await fetchRooms({ active: true });
        if (cancelled) return;
        const opts = (rooms || []).map(r => ({
          value: r.name || r.Name,
          label: `${r.name || r.Name}${r.building ? ` (${r.building})` : ''}${r.capacity ? ` [${r.capacity}]` : ''}`,
          _meta: { building: r.building, capacity: r.capacity }
        }));
        setRoomOptions(opts);
      } catch {}
      finally {
        setLoadingRooms(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load examiners (faculty)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingExaminers(true);
        const faculty = await fetchFaculty({});
        if (cancelled) return;
        const opts = (faculty || []).map(f => ({
          value: f.email,
          label: `${f.fullName || f.FullName} (${f.email})`,
          _meta: { fullName: f.fullName || f.FullName, email: f.email }
        }));
        console.log('[TeacherExamTerms] Loaded examiners:', opts);
        setExaminerOptions(opts);
      } catch {}
      finally {
        setLoadingExaminers(false);
        setLoadingCourses(false); // Courses will be loaded when examiner is selected
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load teacher schedule when examiner changes
  useEffect(() => {
    if (!draft.examiner) {
      setTeacherSchedule([]);
      setCourseOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const examinerEmail = draft.examiner;
        console.log('[TeacherExamTerms] Loading data for examiner:', examinerEmail);
        if (!examinerEmail) return;
        
        // Load schedule
        const schedule = await fetchTeacherTimetable(examinerEmail);
        if (cancelled) return;
        console.log('[TeacherExamTerms] Loaded schedule:', schedule);
        setTeacherSchedule(Array.isArray(schedule) ? schedule : []);
        
        // Load courses for this examiner
        const list = await fetchTeacherCourses(examinerEmail);
        if (cancelled) return;
        console.log('[TeacherExamTerms] Raw courses from API:', list);
        
        const opts = (list || []).map(c => ({
          value: c.code || c.Code || c.id || c.Id,
          label: `${c.nameEn || c.NameEn || c.nameSk || c.NameSk || c.code} (${c.code || c.Code})`,
          _meta: { 
            credits: c.credits ?? c.Credits ?? null, 
            nameEn: c.nameEn ?? c.NameEn, 
            nameSk: c.nameSk ?? c.NameSk,
            examiner: examinerEmail
          }
        }));
        console.log('[TeacherExamTerms] Processed course options:', opts);
        
        setCoursesByExaminer(prev => {
          const next = new Map(prev);
          next.set(examinerEmail, opts);
          return next;
        });
        setCourseOptions(opts);
        const map = new Map();
        for (const o of opts) {
          map.set(String(o.value), o);
        }
        setCourseByCode(map);
      } catch (err) {
        console.error('[TeacherExamTerms] Failed to load data for examiner:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [draft.examiner]); // Removed coursesByExaminer from deps

  // Check for schedule conflicts when dates change
  useEffect(() => {
    if (!draft.startAt || !draft.endAt || !teacherSchedule.length) {
      setScheduleConflicts([]);
      return;
    }
    
    const examStart = new Date(draft.startAt);
    const examEnd = new Date(draft.endAt);
    
    if (isNaN(examStart.getTime()) || isNaN(examEnd.getTime())) {
      setScheduleConflicts([]);
      return;
    }

    // Check for conflicts with teacher's regular schedule (exclude exam terms)
    const conflicts = [];
    const examDay = examStart.getDay(); // 0=Sunday, 1=Monday, etc.
    const examStartTime = examStart.getHours() * 60 + examStart.getMinutes();
    const examEndTime = examEnd.getHours() * 60 + examEnd.getMinutes();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const examDayName = dayNames[examDay];

    teacherSchedule.forEach(slot => {
      // Skip exam terms - only check conflicts with regular classes
      if (slot.type === 'EXAM' || slot.Type === 'EXAM') return;
      
      if (slot.day === examDayName) {
        // Parse time slots (e.g., "08:00" to minutes)
        const parseTime = (timeStr) => {
          const [h, m] = (timeStr || '00:00').split(':').map(Number);
          return h * 60 + m;
        };
        
        const slotStart = parseTime(slot.start);
        const slotEnd = parseTime(slot.end);
        
        // Check if times overlap
        if (examStartTime < slotEnd && examEndTime > slotStart) {
          conflicts.push({
            course: slot.courseName || slot.courseCode,
            time: `${slot.start} - ${slot.end}`,
            day: slot.day,
            room: slot.room
          });
        }
      }
    });

    setScheduleConflicts(conflicts);
  }, [draft.startAt, draft.endAt, teacherSchedule]);

  // Extract unique rooms from terms
  const termsRooms = useMemo(() => {
    const set = new Set();
    (Array.isArray(terms) ? terms : []).forEach(t => {
      if (t.room) set.add(t.room);
    });
    return Array.from(set).sort();
  }, [terms]);

  // Extract unique courses from terms
  const termsCourses = useMemo(() => {
    const set = new Set();
    (Array.isArray(terms) ? terms : []).forEach(t => {
      if (t.courseCode) set.add(t.courseCode);
    });
    return Array.from(set).sort();
  }, [terms]);

  // Extract unique examiners from terms
  const termsExaminers = useMemo(() => {
    const set = new Set();
    (Array.isArray(terms) ? terms : []).forEach(t => {
      if (t.examiner) set.add(t.examiner);
    });
    return Array.from(set).sort();
  }, [terms]);

  // Extract unique students from registrations
  const registrationStudents = useMemo(() => {
    const set = new Set();
    (Array.isArray(allRegistrations) ? allRegistrations : []).forEach(r => {
      if (r.studentEmail) set.add(r.studentEmail);
    });
    return Array.from(set).sort();
  }, [allRegistrations]);

  // Extract unique courses from registrations
  const registrationCourses = useMemo(() => {
    const set = new Set();
    (Array.isArray(allRegistrations) ? allRegistrations : []).forEach(r => {
      if (r.courseCode) set.add(r.courseCode);
    });
    return Array.from(set).sort();
  }, [allRegistrations]);

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase();
    let list = Array.isArray(terms) ? terms : [];
    
    // Text search
    if (q) {
      list = list.filter(t =>
        String(t.courseName || '').toLowerCase().includes(q) ||
        String(t.courseCode || '').toLowerCase().includes(q) ||
        String(t.examiner || '').toLowerCase().includes(q) ||
        String(t.room || '').toLowerCase().includes(q) ||
        String(t.building || '').toLowerCase().includes(q)
      );
    }
    
    // Course filter
    if (filterCourse !== 'all') {
      list = list.filter(t => t.courseCode === filterCourse);
    }
    
    // Examiner filter
    if (filterExaminer !== 'all') {
      list = list.filter(t => t.examiner === filterExaminer);
    }
    
    // Room filter
    if (filterRoom !== 'all') {
      list = list.filter(t => t.room === filterRoom);
    }
    
    return list;
  }, [terms, search, filterCourse, filterExaminer, filterRoom]);

  // Resolve examiner emails to full names using faculty search; cache results
  useEffect(() => {
    let cancelled = false;
    const emails = new Set();
    (Array.isArray(terms) ? terms : []).forEach(t => {
      const ex = String(t.examiner || '').trim();
      if (ex.includes('@') && !examinerNames.has(ex.toLowerCase())) emails.add(ex.toLowerCase());
    });
    const run = async () => {
      for (const email of emails) {
        try {
          const list = await fetchFaculty({ q: email });
          if (cancelled) return;
          const match = (Array.isArray(list) ? list : []).find(f => String(f.email || '').toLowerCase() === email);
          const fullName = match?.fullName || (Array.isArray(list) && list[0]?.fullName) || null;
          if (fullName) {
            setExaminerNames(prev => {
              const next = new Map(prev);
              next.set(email, fullName);
              return next;
            });
          } else {
            // Cache negative to avoid repeated calls
            setExaminerNames(prev => {
              const next = new Map(prev);
              next.set(email, null);
              return next;
            });
          }
        } catch {}
      }
    };
    if (emails.size) run();
    return () => { cancelled = true; };
  }, [terms, examinerNames]);

  const examinerDisplay = (value) => {
    const v = String(value || '').trim();
    if (!v) return '-';
    if (!v.includes('@')) return v; // already a name
    const cached = examinerNames.get(v.toLowerCase());
    return cached || v;
  };

  // Generate available time slots for exam scheduling
  const getAvailableTimeSlots = (dateStr) => {
    if (!dateStr) return [];
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];
    
    // Standard exam slots (8:00 - 18:00, 2-hour blocks)
    const standardSlots = [
      { start: '08:00', end: '10:00', label: '08:00 - 10:00' },
      { start: '10:00', end: '12:00', label: '10:00 - 12:00' },
      { start: '12:00', end: '14:00', label: '12:00 - 14:00' },
      { start: '14:00', end: '16:00', label: '14:00 - 16:00' },
      { start: '16:00', end: '18:00', label: '16:00 - 18:00' },
    ];
    
    // Check which slots conflict with teacher's schedule
    return standardSlots.map(slot => {
      const parseTime = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };
      
      const slotStart = parseTime(slot.start);
      const slotEnd = parseTime(slot.end);
      
      const conflicts = teacherSchedule.filter(scheduleItem => {
        if (scheduleItem.day !== dayName) return false;
        const schedStart = parseTime(scheduleItem.start);
        const schedEnd = parseTime(scheduleItem.end);
        return slotStart < schedEnd && slotEnd > schedStart;
      });
      
      return {
        ...slot,
        available: conflicts.length === 0,
        conflicts: conflicts.map(c => `${c.courseName || c.courseCode} (${c.start}-${c.end})`)
      };
    });
  };

  const onNew = () => {
    const email = String(user?.email || '').trim();
    setDraft({ ...emptyDraft, examiner: email });
    setEditingId(null);
    setSelectedDate('');
    setShowTimeSlots(false);
    setShowForm(true);
  };

  const onEdit = (t) => {
    setEditingId(t.id);
    // If examiner is a name, try to find the email from examinerNames map
    let examinerValue = t.examiner || '';
    if (examinerValue && !examinerValue.includes('@')) {
      // It's a full name, try to find email
      const found = Array.from(examinerNames.entries()).find(([email, name]) => name === examinerValue);
      if (found) examinerValue = found[0];
    }
    setDraft({
      id: t.id,
      courseCode: t.courseCode || '',
      courseName: t.courseName || '',
      credits: t.credits ?? '',
      startAt: toLocalInput(t.startAt),
      endAt: toLocalInput(t.endAt),
      room: t.room || '',
      examiner: examinerValue,
      capacity: t.capacity ?? 0,
    });
    // Set date for calendar view
    if (t.startAt) {
      const date = new Date(t.startAt);
      const dateStr = date.toISOString().split('T')[0];
      setSelectedDate(dateStr);
      setShowTimeSlots(true);
    }
    setShowForm(true);
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this term? Registrations will be removed.')) return;
    try {
      await deleteExamTerm(id);
      reload();
      
      // Reload teacher schedule to remove deleted exam from schedule
      if (draft.examiner) {
        try {
          const schedule = await fetchTeacherTimetable(draft.examiner);
          console.log('[TeacherExamTerms] Reloaded schedule after delete:', schedule);
          setTeacherSchedule(Array.isArray(schedule) ? schedule : []);
        } catch (err) {
          console.warn('[TeacherExamTerms] Failed to reload schedule:', err);
        }
      }
      
      setTimeout(() => {
        notify('success', 'Term deleted', { title: 'Exam Terms' });
      }, 100);
    } catch (e) {
      const msg = extractApiErrorMessage(e, 'Delete failed');
      setTimeout(() => {
        guardedNotify('teacher-term-delete-failed', 'error', msg, { title: 'Server error', lockMs: 3200 });
      }, 100);
    }
  };

  const onSave = async () => {
    // Validate examiner is selected
    if (!draft.examiner || !draft.examiner.trim()) {
      guardedNotify('teacher-term-validation', 'error', 'Examiner is required', { title: 'Validation', lockMs: 3200 });
      return;
    }

    const sel = courseByCode.get(String(draft.courseCode));
    const selectedName = sel?.label?.split(' (')[0] || sel?._meta?.nameEn || sel?._meta?.nameSk || '';
    // Keep examiner as email for backend (don't convert to full name)
    const examinerEmail = (draft.examiner || '').trim();

    const payload = {
      courseCode: (draft.courseCode || '').trim(),
      // Send courseName derived from selection; backend will fallback to code if empty
      courseName: (draft.courseName || selectedName || '').trim(),
      startAt: fromLocalInput(draft.startAt),
      endAt: fromLocalInput(draft.endAt),
      room: (draft.room || '').trim() || null,
      examiner: examinerEmail || null,  // Send email, not full name
      capacity: Number(draft.capacity || 0),
    };
    if (!payload.courseCode || !payload.startAt || !payload.endAt) {
      guardedNotify('teacher-term-validation', 'error', 'Examiner, course and dates are required', { title: 'Validation', lockMs: 3200 });
      return;
    }

    // Validate dates
    const startDate = new Date(payload.startAt);
    const endDate = new Date(payload.endAt);
    if (endDate <= startDate) {
      guardedNotify('teacher-term-validation', 'error', 'End time must be after start time', { title: 'Validation', lockMs: 3200 });
      return;
    }

    // Warn about schedule conflicts
    if (scheduleConflicts.length > 0) {
      const conflictMsg = scheduleConflicts.map(c => `${c.course} (${c.time})`).join(', ');
      const confirmMsg = `Warning: This exam conflicts with the teacher's schedule:\n${conflictMsg}\n\nContinue anyway?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }
    try {
      if (editingId) {
        await updateExamTerm(editingId, payload);
        notify('success', 'Term updated', { title: 'Exam Terms' });
      } else {
        await createExamTerm(payload);
        notify('success', 'Term created', { title: 'Exam Terms' });
      }
      setShowForm(false);
      setEditingId(null);
      setDraft(emptyDraft);
      reload();
      
      // Reload teacher schedule to show newly created exam in schedule
      if (draft.examiner) {
        try {
          const schedule = await fetchTeacherTimetable(draft.examiner);
          console.log('[TeacherExamTerms] Reloaded schedule after save:', schedule);
          setTeacherSchedule(Array.isArray(schedule) ? schedule : []);
        } catch (err) {
          console.warn('[TeacherExamTerms] Failed to reload schedule:', err);
        }
      }
    } catch (e) {
      const msg = extractApiErrorMessage(e, 'Request failed');
      guardedNotify('teacher-term-save-error', 'error', typeof msg === 'string' ? msg : 'Request failed', { title: 'Server error', lockMs: 3600 });
    }
  };

  const openRegistrations = async (t) => {
    setRegFor(t);
    setLoadingRegs(true);
    try {
      const list = await listRegistrationsForTerm(t.id);
      setRegs(Array.isArray(list) ? list : []);
    } catch (e) {
      setRegs([]);
      const msg = extractApiErrorMessage(e, 'Failed to load registrations');
      guardedNotify('teacher-term-regs', 'error', msg, { title: 'Server error', lockMs: 3600 });
    } finally {
      setLoadingRegs(false);
    }
  };

  const loadAllRegistrations = async () => {
    setLoadingAllRegs(true);
    try {
      // Load registrations for all terms
      const termsList = Array.isArray(terms) ? terms : [];
      const allRegsData = [];
      
      for (const term of termsList) {
        try {
          const list = await listRegistrationsForTerm(term.id);
          const regsWithTerm = (Array.isArray(list) ? list : []).map(r => ({
            ...r,
            termId: term.id,
            courseCode: term.courseCode,
            courseName: term.courseName,
            startAt: term.startAt,
            endAt: term.endAt,
            examiner: term.examiner,
            room: term.room,
            building: term.building,
          }));
          allRegsData.push(...regsWithTerm);
        } catch (err) {
          console.warn(`Failed to load registrations for term ${term.id}:`, err);
        }
      }
      
      setAllRegistrations(allRegsData);
    } catch (e) {
      const msg = extractApiErrorMessage(e, 'Failed to load registrations');
      guardedNotify('teacher-all-regs-load-err', 'error', msg, { title: 'Server error', lockMs: 3600 });
      setAllRegistrations([]);
    } finally {
      setLoadingAllRegs(false);
    }
  };

  // Load all registrations when switching to Registrations tab
  useEffect(() => {
    if (activeTab === 'registrations' && terms.length > 0) {
      loadAllRegistrations();
    }
  }, [activeTab, terms]);

  const dynamicSide = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header userRole="teacher" userName={user?.full_name || user?.email || ''} onLogout={() => {}} />
      <RoleSidebar userRole="teacher" isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />

      <div className={`${dynamicSide} ml-0 transition-all duration-300 mt-[var(--hdr-h)] min-h-[calc(100vh-var(--hdr-h))] flex flex-col`} role="main" aria-label="Exam Terms Management">
        <main className="flex-1">
          <div className="p-4 sm:p-6">
            <NavigationBreadcrumb />
            {(loading || loadingCourses || loadingRooms || loadingExaminers || loadingRegs) && (
              <DataLoader
                label="Syncing exam terms…"
                description="Updating exam slots, course metadata, and registrations."
                details={[
                  'Teacher course catalogue • credit & degree alignment',
                  'Exam term windows • room availability • capacity limits',
                  'Registration ledger • attendee roster • notification queue',
                ]}
                fullScreen
              />
            )}

            <Reveal as={motion.div} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true}>
              <div className="bg-card rounded-lg border border-border p-4 sm:p-5 mb-4">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Icon name="CalendarDays" size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Exam Terms (Teacher)</h1>
                      <p className="text-sm text-muted-foreground">Create, manage and review exam terms and registrations</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Tabs Navigation */}
            <Reveal as={motion.div} delay={ANIMATION_DELAYS.TABS} variant="keycap" waitForLoaders={true} className="mb-6">
              <div className="bg-card rounded-lg border border-border p-3">
                <TabBar
                  value={activeTab}
                  onChange={setActiveTab}
                  items={[
                    { value: 'terms', label: 'Terms', icon: 'Calendar' },
                    { value: 'registrations', label: 'Registrations', icon: 'ListOrdered' },
                  ]}
                  className="gap-2"
                />
              </div>
            </Reveal>

            {/* Filters and Actions */}
            <Reveal as={motion.div} delay={ANIMATION_DELAYS.FILTERS} variant="keycap" waitForLoaders={true}>
              <div className="bg-card rounded-lg border border-border p-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:w-auto mb-4">
                  <Input 
                    placeholder={activeTab === 'terms' ? 'Search terms...' : 'Search registrations...'} 
                    value={activeTab === 'terms' ? search : regSearch} 
                    onChange={(e) => activeTab === 'terms' ? setSearch(e.target.value) : setRegSearch(e.target.value)} 
                    className="w-full sm:w-64" 
                  />
                  {activeTab === 'terms' && <Button size="sm" iconName="PlusCircle" onClick={onNew}>New term</Button>}
                  {activeTab === 'registrations' && <Button size="sm" iconName="RefreshCw" onClick={loadAllRegistrations}>Refresh</Button>}
                </div>
                
                {/* Terms Filters */}
                {activeTab === 'terms' && (
                  <div className="border-t border-border pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <Select
                        label="Course"
                        options={[{ value: 'all', label: 'All Courses' }, ...termsCourses.map(c => ({ value: c, label: c }))]}
                        value={filterCourse}
                        onChange={(v) => setFilterCourse(asString(v))}
                        className="w-full"
                      />
                      <Select
                        label="Examiner"
                        options={[{ value: 'all', label: 'All Examiners' }, ...termsExaminers.map(e => ({ value: e, label: e }))]}
                        value={filterExaminer}
                        onChange={(v) => setFilterExaminer(asString(v))}
                        className="w-full"
                      />
                      <Select
                        label="Room"
                        options={[{ value: 'all', label: 'All Rooms' }, ...termsRooms.map(r => ({ value: r, label: r }))]}
                        value={filterRoom}
                        onChange={(v) => setFilterRoom(asString(v))}
                        className="w-full"
                      />
                    </div>
                    {(filterCourse !== 'all' || filterExaminer !== 'all' || filterRoom !== 'all') && (
                      <div className="mt-3">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setFilterCourse('all');
                            setFilterExaminer('all');
                            setFilterRoom('all');
                          }}
                        >
                          Clear Filters
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Registrations Filters */}
                {activeTab === 'registrations' && (
                  <div className="border-t border-border pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Select
                        label="Course"
                        options={[{ value: 'all', label: 'All Courses' }, ...registrationCourses.map(c => ({ value: c, label: c }))]}
                        value={regFilterCourse}
                        onChange={(v) => setRegFilterCourse(asString(v))}
                        className="w-full"
                      />
                      <Select
                        label="Student"
                        options={[{ value: 'all', label: 'All Students' }, ...registrationStudents.map(s => ({ value: s, label: s }))]}
                        value={regFilterStudent}
                        onChange={(v) => setRegFilterStudent(asString(v))}
                        className="w-full"
                      />
                      <Input
                        label="Exam Date From"
                        type="date"
                        value={regFilterDateFrom}
                        onChange={(e) => setRegFilterDateFrom(e.target.value)}
                        className="w-full"
                      />
                      <Input
                        label="Exam Date To"
                        type="date"
                        value={regFilterDateTo}
                        onChange={(e) => setRegFilterDateTo(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    {(regFilterCourse !== 'all' || regFilterStudent !== 'all' || regFilterDateFrom || regFilterDateTo) && (
                      <div className="mt-3">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setRegFilterCourse('all');
                            setRegFilterStudent('all');
                            setRegFilterDateFrom('');
                            setRegFilterDateTo('');
                          }}
                        >
                          Clear Filters
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Reveal>

            {showForm && (
              <Reveal as={motion.div} delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="keycap" waitForLoaders={true}>
                <div className="bg-card rounded-lg border border-border p-4 sm:p-5 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    label="Examiner"
                    options={examinerOptions}
                    value={draft.examiner}
                    onChange={(v) => {
                      const examinerEmail = typeof v === 'string' ? v : v?.value ?? v;
                      console.log('[TeacherExamTerms] Examiner selected:', examinerEmail);
                      setDraft({
                        ...draft,
                        examiner: examinerEmail,
                        // Reset course when examiner changes
                        courseCode: '',
                        courseName: '',
                      });
                    }}
                    searchable
                    required
                  />
                  <Select
                    label="Course"
                    options={courseOptions}
                    value={draft.courseCode}
                    onChange={(v) => {
                      const code = typeof v === 'string' ? v : v?.value ?? v;
                      const opt = courseByCode.get(String(code));
                      console.log('[TeacherExamTerms] Course selected:', code, opt);
                      setDraft({
                        ...draft,
                        courseCode: code,
                        courseName: opt?.label?.split(' (')[0] || code,
                      });
                    }}
                    searchable
                    required
                    disabled={!draft.examiner || courseOptions.length === 0}
                    placeholder={!draft.examiner ? "Select examiner first" : courseOptions.length === 0 ? "No courses available" : "Select course..."}
                  />
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-foreground mb-2">Exam Date & Time</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input 
                        label="Select Date" 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          setShowTimeSlots(true);
                          setDraft({ ...draft, startAt: '', endAt: '' });
                        }} 
                        required 
                      />
                      {selectedDate && showTimeSlots && (
                        <div className="md:col-span-1">
                          <p className="text-xs text-muted-foreground mb-2">Available time slots for {new Date(selectedDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                    {selectedDate && showTimeSlots && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                        {getAvailableTimeSlots(selectedDate).map((slot, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (slot.available) {
                                const date = new Date(selectedDate);
                                const [startH, startM] = slot.start.split(':').map(Number);
                                const [endH, endM] = slot.end.split(':').map(Number);
                                
                                const startDate = new Date(date);
                                startDate.setHours(startH, startM, 0, 0);
                                
                                const endDate = new Date(date);
                                endDate.setHours(endH, endM, 0, 0);
                                
                                setDraft({
                                  ...draft,
                                  startAt: toLocalInput(startDate.toISOString()),
                                  endAt: toLocalInput(endDate.toISOString())
                                });
                              }
                            }}
                            disabled={!slot.available}
                            className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                              draft.startAt && toLocalInput(new Date(selectedDate + 'T' + slot.start).toISOString()) === draft.startAt
                                ? 'bg-primary text-primary-foreground border-primary'
                                : slot.available
                                ? 'bg-card border-border hover:border-primary hover:bg-primary/5'
                                : 'bg-muted border-border text-muted-foreground cursor-not-allowed opacity-50'
                            }`}
                            title={!slot.available ? `Conflicts: ${slot.conflicts.join(', ')}` : 'Click to select this time slot'}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span>{slot.label}</span>
                              {!slot.available && (
                                <span className="text-xs">Conflict</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {draft.startAt && draft.endAt && (
                      <div className="mt-2 p-2 bg-primary/10 rounded text-sm text-primary">
                        Selected: {new Date(draft.startAt).toLocaleString()} - {new Date(draft.endAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                  <Select
                    label="Room"
                    options={roomOptions}
                    value={draft.room}
                    onChange={(v) => {
                      const roomName = typeof v === 'string' ? v : v?.value ?? v;
                      const opt = roomOptions.find(r => r.value === roomName);
                      setDraft({
                        ...draft,
                        room: roomName,
                        capacity: opt?._meta?.capacity || draft.capacity,
                      });
                    }}
                    searchable
                  />
                  <Input label="Capacity" type="number" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} />
                </div>
                
                {scheduleConflicts.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Icon name="AlertTriangle" size={16} className="text-yellow-600 dark:text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Schedule Conflicts Detected</p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                          This exam time conflicts with the teacher's regular schedule:
                        </p>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 space-y-1">
                          {scheduleConflicts.map((c, i) => (
                            <li key={i}>• {c.course} ({c.time}) in {c.room}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
                  <Button onClick={onSave} iconName="Save">{editingId ? 'Update' : 'Create'}</Button>
                </div>
              </div>
              </Reveal>
            )}

            {activeTab === 'terms' && (
              <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                {loading && <div className="text-sm text-muted-foreground">Loading terms…</div>}
                {!loading && filtered.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No terms.</div>
                )}
                {!loading && filtered.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium py-2 pr-2">Course</th>
                          <th className="text-left font-medium py-2 pr-2">Code</th>
                          <th className="text-left font-medium py-2 pr-2">Start</th>
                          <th className="text-left font-medium py-2 pr-2">End</th>
                          <th className="text-left font-medium py-2 pr-2">Examiner</th>
                          <th className="text-left font-medium py-2 pr-2">Room</th>
                          <th className="text-right font-medium py-2 pl-2">Capacity</th>
                          <th className="text-right font-medium py-2 pl-2">Registered</th>
                          <th className="text-right font-medium py-2 pl-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((t) => {
                          const st = t.startAt ? new Date(t.startAt) : (t.date ? new Date(t.date) : null);
                          const en = t.endAt ? new Date(t.endAt) : (t.endDate ? new Date(t.endDate) : null);
                          const cap = typeof t.capacity === 'number' ? t.capacity : 0;
                          const reg = typeof t.registered === 'number' ? t.registered : (typeof t.registrationsCount === 'number' ? t.registrationsCount : 0);
                          return (
                            <tr key={t.id} className="border-t border-border">
                              <td className="py-2 pr-2">{t.courseName || '-'}</td>
                              <td className="py-2 pr-2">{t.courseCode || '-'}</td>
                              <td className="py-2 pr-2">{st ? st.toLocaleString() : '-'}</td>
                              <td className="py-2 pr-2">{en ? en.toLocaleString() : '-'}</td>
                              <td className="py-2 pr-2">{t.examiner || '-'}</td>
                              <td className="py-2 pr-2">{[t.building, t.room].filter(Boolean).join(' ')}</td>
                              <td className="py-2 pl-2 text-right">{cap}</td>
                              <td className="py-2 pl-2 text-right">{reg}</td>
                              <td className="py-2 pl-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" iconName="Pencil" onClick={() => onEdit(t)}>Edit</Button>
                                  <Button size="sm" variant="destructive" iconName="Trash2" onClick={() => onDelete(t.id)}>Delete</Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </Reveal>
            )}

            {activeTab === 'registrations' && (
              <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
              <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                {loadingAllRegs && <div className="text-sm text-muted-foreground">Loading registrations…</div>}
                {!loadingAllRegs && allRegistrations.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No registrations yet.</div>
                )}
                {!loadingAllRegs && allRegistrations.length > 0 && (() => {
                  const q = (regSearch || '').toLowerCase();
                  let filteredRegs = allRegistrations;
                  
                  // Text search
                  if (q) {
                    filteredRegs = filteredRegs.filter(r =>
                      String(r.studentName || '').toLowerCase().includes(q) ||
                      String(r.studentEmail || '').toLowerCase().includes(q) ||
                      String(r.courseCode || '').toLowerCase().includes(q) ||
                      String(r.courseName || '').toLowerCase().includes(q)
                    );
                  }
                  
                  // Course filter
                  if (regFilterCourse !== 'all') {
                    filteredRegs = filteredRegs.filter(r => r.courseCode === regFilterCourse);
                  }
                  
                  // Student filter
                  if (regFilterStudent !== 'all') {
                    filteredRegs = filteredRegs.filter(r => r.studentEmail === regFilterStudent);
                  }
                  
                  // Exam date range filters
                  if (regFilterDateFrom) {
                    const fromDate = new Date(regFilterDateFrom);
                    filteredRegs = filteredRegs.filter(r => r.startAt && new Date(r.startAt) >= fromDate);
                  }
                  if (regFilterDateTo) {
                    const toDate = new Date(regFilterDateTo);
                    toDate.setHours(23, 59, 59, 999);
                    filteredRegs = filteredRegs.filter(r => r.startAt && new Date(r.startAt) <= toDate);
                  }
                  
                  return (
                    <div className="overflow-x-auto">
                      <div className="mb-3 text-sm text-muted-foreground">
                        Showing {filteredRegs.length} of {allRegistrations.length} registrations
                      </div>
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="text-left font-medium py-2 pr-2">Student</th>
                            <th className="text-left font-medium py-2 pr-2">Email</th>
                            <th className="text-left font-medium py-2 pr-2">Course</th>
                            <th className="text-left font-medium py-2 pr-2">Exam Date</th>
                            <th className="text-left font-medium py-2 pr-2">Room</th>
                            <th className="text-left font-medium py-2 pr-2">Registered At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRegs.map((r, idx) => {
                            const examDate = r.startAt ? new Date(r.startAt) : null;
                            const regDate = r.registeredAt ? new Date(r.registeredAt) : null;
                            return (
                              <tr key={`${r.id}-${idx}`} className="border-t border-border">
                                <td className="py-2 pr-2">{r.studentName || '-'}</td>
                                <td className="py-2 pr-2">{r.studentEmail || '-'}</td>
                                <td className="py-2 pr-2">{r.courseName || r.courseCode || '-'}</td>
                                <td className="py-2 pr-2">{examDate ? examDate.toLocaleString() : '-'}</td>
                                <td className="py-2 pr-2">{[r.building, r.room].filter(Boolean).join(' ') || '-'}</td>
                                <td className="py-2 pr-2">{regDate ? regDate.toLocaleString() : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
              </Reveal>
            )}

            {regFor && (
              <Reveal as={motion.div} delay={ANIMATION_DELAYS.PAGINATION} variant="keycap" waitForLoaders={true}>
                <div className="bg-card rounded-lg border border-border p-4 sm:p-5 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">Registrations — {regFor.courseName} ({regFor.courseCode})</h3>
                    <p className="text-sm text-muted-foreground">{new Date(regFor.startAt).toLocaleString()} • {regFor.building} {regFor.room}</p>
                  </div>
                  <Button variant="outline" size="sm" iconName="X" onClick={() => { setRegFor(null); setRegs([]); }}>Close</Button>
                </div>
                {loadingRegs && <div className="text-sm text-muted-foreground">Loading…</div>}
                {!loadingRegs && regs.length === 0 && <div className="text-sm text-muted-foreground">No registrations.</div>}
                {!loadingRegs && regs.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium py-2 pr-2">Student</th>
                          <th className="text-left font-medium py-2 pr-2">Email</th>
                          <th className="text-left font-medium py-2 pr-2">Registered at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regs.map(r => (
                          <tr key={r.id} className="border-t border-border">
                            <td className="py-2 pr-2">{r.studentName || '-'}</td>
                            <td className="py-2 pr-2">{r.studentEmail}</td>
                            <td className="py-2 pr-2">{r.registeredAt ? new Date(r.registeredAt).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </Reveal>
            )}

          </div>
        </main>

        <PageFooter
            left={[
              'MAIS 2.0 • Teacher Portal',
              'Exam Terms Management',
              lastLoginLabel,
            ]}
            actions={[
              <Button key="help" variant="ghost" size="sm" iconName="HelpCircle">
                Help
              </Button>,
            ]}
            containerClassName="px-4 sm:px-6"
        />
      </div>
    </div>
  );
};

export default function TerminyTeacher() {
  return (
    <ToastsProvider>
      <TeacherExamTermsInner />
      <ToastViewport position="top-right" />
    </ToastsProvider>
  );
}
