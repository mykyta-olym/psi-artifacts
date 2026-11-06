// src/data/maisApiAdapter.js
import api from '../utils/apiClient';
import { DAY_LABELS } from '../constants/schedulePolicy';
import { extractApiErrorMessage } from '../utils/apiErrors';

import { createLogger } from '../utils/logger';
const logger = createLogger('maisApiAdapter');

const CACHE_TTL = {
  tiny: 15 * 1000,
  short: 45 * 1000,
  medium: 2 * 60 * 1000,
  long: 5 * 60 * 1000,
  extended: 10 * 60 * 1000,
};

export async function fetchCourses(options = {}) {
  const ttl = options.ttl ?? CACHE_TTL.extended;
  const studentYear = options.studentYear; // Optional: filter by student's study year
  try {
    const params = new URLSearchParams();
    if (studentYear) params.set('studentYear', studentYear);
    const url = `/courses${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await api.get(url, { cache: { ttl } });
    return Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
  } catch { return []; }
}

export async function fetchCoursesForManagement(options = {}) {
  const ttl = options.ttl ?? 0; // No cache for management
  try {
    const res = await api.get('/courses/manage', { cache: { ttl } });
    return Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
  } catch { return []; }
}

export async function syncCoursesFacultyProgram(options = {}) {
  try {
    const res = await api.post('/db/sync-courses-faculty-program', {}, { cache: { invalidate: '/courses' } });
    return res || { updated: 0 };
  } catch (e) {
    logger.warn('[api] Failed to sync courses faculty/program:', e);
    return { updated: 0, error: extractApiErrorMessage(e, 'Failed to sync courses') };
  }
}

export async function fixCourseTypes(options = {}) {
  try {
    const res = await api.post('/db/fix-course-types', {}, { cache: { invalidate: '/courses' } });
    return res || { fixed: 0 };
  } catch (e) {
    logger.warn('[api] Failed to fix course types:', e);
    return { fixed: 0, error: extractApiErrorMessage(e, 'Failed to fix course types') };
  }
}

export async function fetchStudentByEmail(email, options = {}) {
  if (!email) return null;
  try {
    const ttl = options.ttl ?? CACHE_TTL.medium;
    const res = await api.get(`/students/by-email/${encodeURIComponent(email)}`, { cache: { ttl } });
    return res || null;
  } catch { return null; }
}

export async function fetchMyStudies(options = {}) {
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    const res = await api.get('/studies/me', { cache: { ttl } });
    return Array.isArray(res) ? res : [];
  } catch { return []; }
}


export async function fetchCourseByCode(code, options = {}) {
  if (!code) return null;
  try {
    const ttl = options.ttl ?? CACHE_TTL.extended;
    const item = await api.get(`/courses/${encodeURIComponent(code)}`, { cache: { ttl } });
    return item || null;
  } catch { return null; }
}

export async function fetchCourseEnrollmentReadiness(code, options = {}) {
  if (!code) return null;
  try {
    const ttl = options.ttl ?? CACHE_TTL.short; // Short cache since readiness can change
    const res = await api.get(`/courses/${encodeURIComponent(code)}/enrollment-readiness`, { cache: { ttl } });
    return res || null;
  } catch { return null; }
}

export async function fetchRooms(options = {}) {
  try {
    const ttl = options.ttl ?? CACHE_TTL.extended;
    const res = await api.get('/rooms', { cache: { ttl } });
    // Handle both old and new response formats
    return Array.isArray(res?.rooms) ? res.rooms : (Array.isArray(res) ? res : []);
  } catch { return []; }
}

export async function fetchEquipment(params = {}, options = {}) {
  try {
    const ttl = options.ttl ?? CACHE_TTL.extended;
    const query = new URLSearchParams();
    if (params.room) query.set('room', params.room);
    if (params.type) query.set('type', params.type);
    if (params.status) query.set('status', params.status);
    if (params.location) query.set('location', params.location);
    const res = await api.get(`/equipment${query.toString() ? `?${query.toString()}` : ''}`, { cache: { ttl } });
    // Handle both old and new response formats
    return Array.isArray(res?.equipment) ? res.equipment : (Array.isArray(res) ? res : []);
  } catch { return []; }
}

// Class Groups API
export async function fetchClassGroups(params = {}, options = {}) {
  try {
    const ttl = options.ttl ?? CACHE_TTL.medium;
    const query = new URLSearchParams();
    if (params.faculty) query.set('faculty', params.faculty);
    if (params.program) query.set('program', params.program);
    if (params.type) query.set('type', params.type);
    if (params.teacherEmail) query.set('teacherEmail', params.teacherEmail);
    if (params.activeOnly !== undefined) query.set('activeOnly', String(params.activeOnly));
    const res = await api.get(`/class-groups${query.toString() ? `?${query.toString()}` : ''}`, { cache: { ttl } });
    return Array.isArray(res) ? res : [];
  } catch (e) {
    logger.warn('[api] Failed to fetch class groups:', e);
    return [];
  }
}

export async function fetchDistinctFaculties(options = {}) {
  try {
    const ttl = options.ttl ?? CACHE_TTL.extended;
    const res = await api.get('/class-groups/faculties', { cache: { ttl } });
    return Array.isArray(res) ? res : [];
  } catch (e) {
    logger.warn('[api] Failed to fetch faculties:', e);
    return [];
  }
}

export async function fetchDistinctPrograms(faculty = null, options = {}) {
  try {
    console.log('[API] Fetching programs, faculty filter:', faculty);
    const ttl = options.ttl ?? CACHE_TTL.extended;
    const query = new URLSearchParams();
    if (faculty) query.set('faculty', faculty);
    const url = `/programs${query.toString() ? `?${query.toString()}` : ''}`;
    console.log('[API] Request URL:', url);
    const res = await api.get(url, { cache: { ttl } });
    console.log('[API] Programs response:', res);
    return Array.isArray(res) ? res : [];
  } catch (e) {
    logger.warn('[api] Failed to fetch programs:', e);
    console.error('[API] fetchDistinctPrograms error:', e);
    return [];
  }
}

export async function createClassGroup(data, options = {}) {
  try {
    const res = await api.post('/class-groups', data, { cache: { invalidate: '/class-groups' } });
    return res || null;
  } catch (e) {
    logger.error('[api] Failed to create class group:', e);
    throw new Error(extractApiErrorMessage(e, 'Failed to create class group'));
  }
}

export async function updateClassGroup(id, data, options = {}) {
  try {
    const res = await api.put(`/class-groups/${encodeURIComponent(id)}`, data, { cache: { invalidate: '/class-groups' } });
    return res || null;
  } catch (e) {
    logger.error('[api] Failed to update class group:', e);
    throw new Error(extractApiErrorMessage(e, 'Failed to update class group'));
  }
}

export async function deleteClassGroup(id, options = {}) {
  try {
    const res = await api.delete(`/class-groups/${encodeURIComponent(id)}`, { cache: { invalidate: '/class-groups' } });
    return res || { ok: true };
  } catch (e) {
    logger.error('[api] Failed to delete class group:', e);
    throw new Error(extractApiErrorMessage(e, 'Failed to delete class group'));
  }
}

export async function fetchStudents(params = {}, options = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.faculty) q.set('faculty', params.faculty);
  if (params.program) q.set('program', params.program);
  if (params.year !== undefined && params.year !== null) q.set('year', String(params.year));
  if (params.status) q.set('status', params.status);
  if (params.includeArchived) q.set('includeArchived', 'true');
  if (params.archivedOnly) q.set('archivedOnly', 'true');
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  if (params.sort) q.set('sort', params.sort);
  if (params.order) q.set('order', params.order);
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    // Make a raw fetch to get headers
    const path = `/students${q.toString() ? `?${q.toString()}` : ''}`;
    let items = [];
    let totalCount = 0;
    
    if (options.includeTotal) {
      // Use raw fetch to get X-Total-Count header
      const token = api.getAccessToken();
      const headers = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const response = await fetch(`${api.baseUrl}${path}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      items = await response.json();
      items = Array.isArray(items?.items) ? items.items : (Array.isArray(items) ? items : []);
      const xTotalCount = response.headers.get('X-Total-Count');
      if (xTotalCount) {
        const parsed = parseInt(xTotalCount, 10);
        if (Number.isFinite(parsed)) totalCount = parsed;
      } else {
        totalCount = items.length;
      }
      return { items, total: totalCount };
    } else {
      const res = await api.get(path, { cache: { ttl } });
      items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      return items;
    }
  } catch { return options.includeTotal ? { items: [], total: 0 } : []; }
}

export async function createStudent(input = {}) {
  // Map UI form object to API request
  const name = String(input?.name || '').trim();
  const email = String(input?.email || '').trim();
  // Try to split name for given/family names
  let firstName = String(input?.firstName || '').trim();
  let lastName = String(input?.lastName || '').trim();
  if ((!firstName || !lastName) && name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      firstName = firstName || parts.slice(0, -1).join(' ');
      lastName = lastName || parts.slice(-1)[0];
    } else if (parts.length === 1) {
      firstName = firstName || parts[0];
    }
  }
  // Parse study year from gradeKey like "1-rok-2025-2026-zs"
  const gradeKey = String(input?.gradeKey || '').trim();
  let studyYear = 0;
  const m = gradeKey.match(/^(\d+)/);
  if (m) studyYear = parseInt(m[1], 10) || 0;

  const s = input?.student || {};

  const body = {
    email,
    firstName,
    lastName,
    fullName: name || undefined,
    faculty: String(input?.faculty || '').trim() || undefined,
    program: String(input?.program || '').trim() || undefined,
    studyYear: Number.isFinite(studyYear) && studyYear > 0 ? studyYear : undefined,
    gradeKey: gradeKey || undefined,

    // Extended optional fields
    phone: String(input?.phone || '').trim() || undefined,
    phone2: String(input?.phone2 || '').trim() || undefined,
    altEmail: String(input?.altEmail || '').trim() || undefined,
    address: String(input?.address || s?.address || '').trim() || undefined,

    className: String(s?.className || '').trim() || undefined,
    isicCardNumber: String(s?.isicCardNumber || '').trim() || undefined,
  studentNumber: String(s?.studentNumber || '').trim() || undefined,
    studyNumber: String(s?.studyNumber || '').trim() || undefined,
    passportId: String(s?.passportId || '').trim() || undefined,
    birthDate: String(s?.birthDate || input?.dateOfBirth || '').slice(0, 10) || undefined,
    birthPlace: String(s?.birthPlace || '').trim() || undefined,
    nationality: String(s?.nationality || '').trim() || undefined,
    familyStatus: String(s?.familyStatus || '').trim() || undefined,
    healthStatus: String(s?.healthStatus || '').trim() || undefined,
    parentName: String(s?.parentName || '').trim() || undefined,
    consentPersonalData: typeof s?.consentPersonalData === 'boolean' ? s.consentPersonalData : undefined,
    consentCompanyOffers: typeof s?.consentCompanyOffers === 'boolean' ? s.consentCompanyOffers : undefined,
    status: String(input?.status || s?.status || 'active').trim().toLowerCase() || undefined,
    lastActivity: input?.lastActivity || undefined,
  };
  const created = await api.post('/students', body, { cache: { invalidate: '/students' } });
  api.invalidateCache('/students/by-email');
  return created;
}

// Profile update API
export async function updateStudentProfileByEmail(email, patch = {}) {
  if (!email) return { ok: false };
  const body = {};
  const s = patch?.student || {};
  const set = (k, v) => { if (v !== undefined) body[k] = v; };
  set('fullName', patch.fullName);
  set('givenName', patch.firstName);
  set('familyName', patch.lastName);
  set('faculty', patch.faculty || s.faculty);
  set('program', patch.program || s.program);
  set('phone', patch.phone);
  set('phone2', patch.phone2);
  set('altEmail', patch.altEmail);
  set('avatarUrl', patch.avatarUrl);
  set('address', patch.address || s.address);
  set('className', s.className);
  set('isicCardNumber', s.isicCardNumber);
  set('studentNumber', s.studentNumber);
  set('studyNumber', s.studyNumber);
  set('passportId', s.passportId);
  set('birthDate', s.birthDate ? String(s.birthDate).slice(0,10) : undefined);
  set('birthPlace', s.birthPlace);
  set('nationality', s.nationality);
  set('familyStatus', s.familyStatus);
  set('healthStatus', s.healthStatus);
  set('parentName', s.parentName);
  if (typeof s.consentPersonalData === 'boolean') set('consentPersonalData', s.consentPersonalData);
  if (typeof s.consentCompanyOffers === 'boolean') set('consentCompanyOffers', s.consentCompanyOffers);
  const res = await api.put(
      `/students/by-email/${encodeURIComponent(email)}/profile`,
      body,
      { cache: { invalidate: `/students/by-email/${encodeURIComponent(email)}` } }
  );
  api.invalidateCache('/students');
  return res;
}

export async function updateFacultyProfileByEmail(email, patch = {}) {
  if (!email) return { ok: false };
  const body = {};
  const set = (k, v) => { if (v !== undefined) body[k] = v; };
  set('phone', patch.phone);
  set('avatarUrl', patch.avatarUrl);
  set('office', patch.location); // UI stores "Room 205 · Building"; backend keeps Office string
  if (Array.isArray(patch.departments)) set('departments', patch.departments);
  if (Array.isArray(patch.subjects)) set('subjects', patch.subjects);
  set('status', patch.status);
  set('employmentType', patch.employmentType);
  if (Number.isFinite(patch.classesCount)) set('classesCount', Number(patch.classesCount));
  if (Number.isFinite(patch.yearsExperience)) set('yearsExperience', Number(patch.yearsExperience));
  set('hireDate', patch.hireDate);
  set('lastActivity', patch.lastActivity);
  set('about', patch.about);
  set('avatarUrl', patch.avatarUrl || patch.photo);
  if (patch.officeHours && typeof patch.officeHours === 'object') set('officeHours', patch.officeHours);
  if (patch.workingHours && typeof patch.workingHours === 'object') set('workingHours', patch.workingHours);
  const res = await api.put(
      `/faculty/${encodeURIComponent(email)}/profile`,
      body,
      { cache: { invalidate: `/faculty/${encodeURIComponent(email)}` } }
  );
  api.invalidateCache('/faculty');
  return res;
}

export async function createFacultyMember(input = {}) {
  const body = {
    firstName: String(input.firstName || '').trim() || undefined,
    lastName: String(input.lastName || '').trim() || undefined,
    fullName: String(input.fullName || input.name || '').trim() || undefined,
    email: String(input.email || '').trim().toLowerCase() || undefined,
    faculty: String(input.faculty || '').trim() || undefined,
    departments: Array.isArray(input.departments) ? input.departments : undefined,
    department: String(input.department || input.primaryDepartment || '').trim() || undefined,
    subjects: Array.isArray(input.subjects) ? input.subjects : undefined,
    phone: String(input.phone || '').trim() || undefined,
    office: String(input.office || input.location || '').trim() || undefined,
    rating: Number.isFinite(input.rating) ? Number(input.rating) : undefined,
      employmentType: String(input.employmentType || '').trim() || undefined,
      status: String(input.status || '').trim().toLowerCase() || undefined,
      classesCount: Number.isFinite(input.classesCount) ? Number(input.classesCount) : undefined,
      yearsExperience: Number.isFinite(input.yearsExperience) ? Number(input.yearsExperience) : undefined,
      hireDate: input.hireDate ? String(input.hireDate) : undefined,
      lastActivity: input.lastActivity ? String(input.lastActivity) : undefined,
      about: String(input.about || '').trim() || undefined,
      avatarUrl: String(input.avatarUrl || input.photo || '').trim() || undefined,
    officeHours: typeof input.officeHours === 'object' ? input.officeHours : undefined,
    workingHours: typeof input.workingHours === 'object' ? input.workingHours : undefined,
  };
  // Cleanup undefined values
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) delete body[key];
  });
  const res = await api.post('/faculty', body, { cache: { invalidate: '/faculty' } });
  return res;
}

export async function fetchFaculty(params = {}, options = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  if (params.sort) q.set('sort', params.sort);
  if (params.order) q.set('order', params.order);
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    const res = await api.get(`/faculty${q.toString() ? `?${q.toString()}` : ''}`, { cache: { ttl } });
    return Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
  } catch { return []; }
}

export async function fetchFacultyByEmail(email, options = {}) {
  if (!email) return null;
  try {
    console.log('[fetchFacultyByEmail] Fetching data for:', email);
    const ttl = options.ttl ?? CACHE_TTL.short;
    const res = await api.get(`/faculty/by-email/${encodeURIComponent(email)}`, { cache: { ttl } });
    console.log('[fetchFacultyByEmail] Received data:', {
      id: res?.id,
      email: res?.email,
      faculty: res?.faculty,
      program: res?.program,
      department: res?.department,
      phone: res?.phone,
      office: res?.office,
      about: res?.about?.substring(0, 50),
      officeHours: res?.officeHours ? Object.keys(res.officeHours) : [],
      certifications: res?.certifications?.length
    });
    return res || null;
  } catch (err) {
    console.error('[fetchFacultyByEmail] Error:', err);
    return null;
  }
}

export async function fetchTeacherTimetable(email, options = {}) {
  if (!email) return [];
  // Use shorter cache TTL to ensure new classes appear quickly
  const ttl = options.ttl ?? CACHE_TTL.tiny;
  
  let data = [];
  try {
    data = await api.get(`/teachers/${encodeURIComponent(email)}/timetable`, { cache: { ttl } });
  } catch (err) {
    console.warn('[fetchTeacherTimetable] API call failed, trying schedule/events fallback:', err);
    // Fallback: try to get schedule events filtered by teacher email
    try {
      const events = await api.get(`/schedule/events?teacherEmail=${encodeURIComponent(email)}`, { cache: { ttl } });
      data = Array.isArray(events) ? events : [];
    } catch {
      console.warn('[fetchTeacherTimetable] Fallback also failed');
      return [];
    }
  }
  
  if (!Array.isArray(data) || data.length === 0) return [];
  
  const rooms = await fetchRooms();
  const roomNames = rooms.map(r => r?.name).filter(Boolean);
  const pickFallbackRoom = (seed) => {
    if (!roomNames.length) return ''; // Return empty string instead of hardcoded room
    // simple deterministic pick
    let h = 2166136261 >>> 0; const str = String(seed||'');
    for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return roomNames[h % roomNames.length];
  };
  const parseSlot = (slot, fallbackStart, fallbackEnd) => {
    const [s,e] = String(slot||'').split('-').map(x => (x||'').trim());
    return { start: s || (fallbackStart||''), end: e || (fallbackEnd||'') };
  };
  const toLongDay = (d='') => DAY_LABELS[d] || d;
  return (Array.isArray(data) ? data : []).map(t => {
    const { start, end } = parseSlot(t.slot, t.time, t.endTime);
    const day = toLongDay(t.day);
    return {
      id: t.id || t.Id || undefined,
      day,
      start,
      end,
      courseCode: t.courseCode || t.code || t.subjectCode || '',
      courseName: t.courseName || t.name || t.subject || '',
      room: (t.room && t.room !== '—') ? t.room : pickFallbackRoom(`${t.courseCode||t.code||''}|${day}`),
      // Preserve original type from backend (P, CL, S, etc.) to differentiate classes
      type: (t.type || t.Type || 'CL').toUpperCase(),
      classGroupKeys: Array.isArray(t.classGroupKeys) ? t.classGroupKeys : (t.group ? [t.group] : []),
      group: t.group || t.section || '—',
      // Include teacher email for filtering (required by buildTeacherClassesAndGroups)
      teacherEmail: t.teacherEmail || email,
      slot: t.slot || `${start}-${end}`,
    };
  });
}

export async function fetchScheduleEvents(params = {}, options = {}) {
  const q = new URLSearchParams();
  if (params.courseCode) q.set('courseCode', String(params.courseCode));
  if (params.teacherEmail) q.set('teacherEmail', String(params.teacherEmail));
  if (params.day) q.set('day', String(params.day));
  if (params.room) q.set('room', String(params.room));
  if (params.studentYear) q.set('studentYear', String(params.studentYear)); // Filter by student year
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    const res = await api.get(`/schedule/events${q.toString() ? `?${q.toString()}` : ''}`, { cache: { ttl } });
    return Array.isArray(res) ? res : [];
  } catch { return []; }
}

export async function createScheduleEvent(input = {}, opts = {}) {
  // input: { courseCode, day, time, endTime, slot?, room, note?, capacity?, classGroupKeys?, type?, program?, faculty? }
  const body = {
    courseCode: String(input.courseCode || '').trim(),
    day: String(input.day || '').trim(),
    slot: input.slot || undefined,
    time: input.time || undefined,
    endTime: input.endTime || undefined,
    room: input.room || undefined,
    note: input.note || undefined,
    capacity: Number.isFinite(input.capacity) ? input.capacity : undefined,
    classGroupKeys: Array.isArray(input.classGroupKeys) ? input.classGroupKeys : undefined,
    type: input.type || input.kind || undefined,
    program: input.program || undefined,
    faculty: input.faculty || undefined,
  };
  const headers = {};
  if (opts && opts.teacherEmail) headers['X-Teacher-Email'] = String(opts.teacherEmail);
  const res = Object.keys(headers).length
    ? await api.postWithHeaders('/schedule/events', body, headers, { cache: { invalidate: '/schedule/events' } })
    : await api.post('/schedule/events', body, { cache: { invalidate: '/schedule/events' } });
  return res;
}

export async function updateScheduleEvent(id, input = {}, opts = {}) {
  if (!id) throw new Error('id required');
  const body = {
    day: input.day || undefined,
    slot: input.slot || undefined,
    time: input.time || undefined,
    endTime: input.endTime || undefined,
    room: input.room || undefined,
    note: input.note || undefined,
    capacity: Number.isFinite(input.capacity) ? input.capacity : undefined,
    program: input.program || undefined,
    faculty: input.faculty || undefined,
  };
  const res = await api.put(`/schedule/events/${encodeURIComponent(id)}`, body, { cache: { invalidate: '/schedule/events' } });
  return res;
}

export async function assignScheduleEventsToTeacher(teacherEmail, eventIds = []) {
  if (!teacherEmail || !Array.isArray(eventIds) || eventIds.length === 0) {
    return { updated: 0, missing: [] };
  }
  const body = {
    teacherEmail: String(teacherEmail).trim(),
    eventIds: eventIds.map((id) => String(id || '').trim()).filter(Boolean),
  };
  return await api.post('/schedule/events/assign-teacher', body, { cache: { invalidate: '/schedule/events' } });
}

// Delete schedule event (owner-only; fails if enrollments exist)
export async function deleteScheduleEvent(id) {
  if (!id) throw new Error('id required');
  try {
    const res = await api.del(`/schedule/events/${encodeURIComponent(id)}`, { cache: { invalidate: '/schedule/events' } });
    return { ok: true, res };
  } catch (e) {
    return { ok: false, status: e?.status || 500, error: extractApiErrorMessage(e, 'Failed to delete schedule event') };
  }
}

export async function fetchScheduleForCourse(courseCode) {
  if (!courseCode) return [];
  try {
    const all = await fetchScheduleEvents();
    return all.filter(e => String(e.courseCode) === String(courseCode));
  } catch { return []; }
}

export async function confirmEnrollment({ academicYear, semester, selections }) {
  const body = {
    academicYear: academicYear || undefined,
    semester: semester || undefined,
    courses: (selections || []).map(s => ({ courseCode: s.courseCode, scheduleEventId: s.scheduleEventId || null })),
  };
  const res = await api.post('/enrollments/confirm', body, { cache: { invalidate: '/enrollments' } });
  return res;
}

export async function createEnrollmentForStudent({ studentId, academicYear, semester, selections }) {
  const body = {
    studentId: studentId,
    academicYear: academicYear || undefined,
    semester: semester || undefined,
    courses: (selections || []).map(s => ({ courseCode: s.courseCode, scheduleEventId: s.scheduleEventId || null })),
  };
  const res = await api.post('/enrollments/create-for-student', body, { cache: { invalidate: '/enrollments' } });
  return res;
}

export async function fetchStudentEnrollments(studentId, options = {}) {
  if (!studentId) return [];
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    const res = await api.get(`/students/${encodeURIComponent(studentId)}/enrollments`, { cache: { ttl } });
    return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
  } catch { return []; }
}

// Teacher-specific helpers
export async function fetchTeacherCourses(email, options = {}) {
  if (!email) return [];
  try {
    const ttl = options.ttl ?? CACHE_TTL.medium;
    const res = await api.get(`/teachers/${encodeURIComponent(email)}/courses`, { cache: { ttl } });
    return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
  } catch { return []; }
}

export async function fetchTeacherCourseRoster(email, courseCode, options = {}) {
  if (!email || !courseCode) return { entries: [], roster: [] };
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    const res = await api.get(
        `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/roster`,
        { cache: { ttl } }
    );
    const entries = Array.isArray(res?.entries) ? res.entries : (Array.isArray(res) ? res : []);
    const roster = Array.isArray(res?.roster) ? res.roster : [];
    return { entries, roster };
  } catch { return { entries: [], roster: [] }; }
}

// Grades API
export async function upsertCourseGrade({ studentId, courseCode, teacherEmail, assessmentType, continuousPercent, finalPercent, totalPercent, continuousPoints, finalPoints }) {
  const body = {
    studentId,
    courseCode,
    teacherEmail,
    assessmentType,
    continuousPercent: Number.isFinite(continuousPercent) ? continuousPercent : undefined,
    finalPercent: Number.isFinite(finalPercent) ? finalPercent : undefined,
    totalPercent: Number.isFinite(totalPercent) ? totalPercent : undefined,
    continuousPoints: Number.isFinite(continuousPoints) ? continuousPoints : undefined,
    finalPoints: Number.isFinite(finalPoints) ? finalPoints : undefined,
  };
  try {
    const res = await api.put('/grades', body);
    return res;
  } catch { return null; }
}

export async function fetchTeacherCourseGrades(email, courseCode, options = {}) {
  if (!email || !courseCode) return [];
  // Use the correct backend endpoint: GET /api/teachers/{email}/courses/{code}/grades
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    const path = `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/grades`;
    const res = await api.get(path, { cache: { ttl } });
    return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
  } catch {
    return [];
  }
}

// Documents API
export async function renderPrintDocument({ template, form, studentId, customHtml, customTitle } = {}) {
  if (!template && !customHtml) throw new Error('template is required');
  try {
    return await api.post('/documents/render', { template, form, studentId, customHtml, customTitle });
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to render document'));
  }
}

export async function assignDocumentsToStudents(payload = {}) {
  if (!payload?.template) throw new Error('template is required');
  const body = {
    template: payload.template,
    form: payload.form,
    studentIds: Array.isArray(payload.studentIds) ? payload.studentIds : [],
    applyToAllActive: Boolean(payload.applyToAllActive),
    includeArchived: Boolean(payload.includeArchived),
    customHtml: payload.customHtml,
    customTitle: payload.customTitle,
  };
  try {
    return await api.post('/documents/assign', body);
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to assign documents'));
  }
}

export async function assignDocumentsToFaculty(payload = {}) {
  if (!payload?.template) throw new Error('template is required');
  const body = {
    template: payload.template,
    form: payload.form,
    facultyIds: Array.isArray(payload.facultyIds) ? payload.facultyIds : [],
    customHtml: payload.customHtml,
    customTitle: payload.customTitle,
  };
  try {
    return await api.post('/documents/assign-faculty', body);
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to assign documents to faculty'));
  }
}

export async function generateTeacherProfileDocument() {
  try {
    return await api.post('/documents/teacher/profile', {});
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to generate profile'));
  }
}

export async function fetchMyDocuments(options = {}) {
  const query = new URLSearchParams();
  if (options.includeHtml) query.set('includeHtml', 'true');
  try {
    const res = await api.get(`/documents/my${query.toString() ? `?${query.toString()}` : ''}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function fetchDocumentById(id, options = {}) {
  if (!id) return null;
  const query = new URLSearchParams();
  if (options.includeHtml === false) query.set('includeHtml', 'false');
  try {
    return await api.get(`/documents/${encodeURIComponent(id)}${query.toString() ? `?${query.toString()}` : ''}`);
  } catch {
    return null;
  }
}

export async function fetchStudentGrades(studentId, options = {}) {
  if (!studentId) return [];
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    const res = await api.get(`/students/${encodeURIComponent(studentId)}/grades`, { cache: { ttl } });
    return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
  } catch { return []; }
}

// Grading scheme API
export async function fetchCourseGradingScheme(courseCode, options = {}) {
  if (!courseCode) return null;
  try {
    const ttl = options.ttl ?? CACHE_TTL.medium;
    const res = await api.get(`/courses/${encodeURIComponent(courseCode)}/grading-scheme`, { cache: { ttl } });
    return res || null;
  } catch { return null; }
}

export async function saveCourseGradingScheme(courseCode, { maxContinuousPoints, maxFinalPoints }) {
  if (!courseCode) return null;
  const body = {
    maxContinuousPoints: Number.isFinite(maxContinuousPoints) ? maxContinuousPoints : undefined,
    maxFinalPoints: Number.isFinite(maxFinalPoints) ? maxFinalPoints : undefined,
  };
  try {
    const res = await api.put(
        `/courses/${encodeURIComponent(courseCode)}/grading-scheme`,
        body,
        { cache: { invalidate: `/courses/${encodeURIComponent(courseCode)}/grading-scheme` } }
    );
    return res || null;
  } catch { return null; }
}

// Assignments API (persistent)
export async function listAssignments(email, courseCode, options = {}) {
  if (!email || !courseCode) return [];
  try {
    const ttl = options.ttl ?? CACHE_TTL.short;
    const res = await api.get(
        `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/assignments`,
        { cache: { ttl } }
    );
    return Array.isArray(res) ? res : [];
  } catch { return []; }
}

export async function bulkSaveAssignments({ email, courseCode, classId, assignments, sync = false }) {
  if (!email || !courseCode) return [];
  const body = { classId, courseCode, teacherEmail: email, assignments: (assignments||[]).map(a => ({
    id: a.id,
    classId: classId || a.classId,
    courseCode,
    teacherEmail: email,
    name: a.name,
    category: a.category === 'exam' ? 'exam' : 'continuous',
    totalPoints: Number(a.totalPoints) || 0,
    dueDate: a.dueDate,
    description: a.description,
  }))};
  try {
    const q = sync ? '?sync=true' : '';
    const res = await api.put(
        `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/assignments${q}`,
        body,
        { cache: { invalidate: `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/assignments` } }
    );
    return Array.isArray(res) ? res : [];
  } catch { return []; }
}

export async function bulkSaveAssignmentGrades({ email, courseCode, entries }) {
  if (!email || !courseCode) return [];
  const body = { entries: (entries||[]).map(e => ({ studentId: e.studentId, assignmentId: e.assignmentId, points: Number(e.points)||0 })) };
  try {
    const res = await api.put(
        `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/assignment-grades`,
        body,
        { cache: { invalidate: `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/assignment-grades` } }
    );
    return Array.isArray(res) ? res : [];
  } catch { return []; }
}

// Optional single-assignment delete (will be used if backend endpoint exists)
export async function deleteAssignment(email, courseCode, assignmentId) {
  if (!email || !courseCode || !assignmentId) return { ok: false, status: 400 };
  try {
    const res = await api.del(
        `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/assignments/${encodeURIComponent(assignmentId)}`,
        { cache: { invalidate: `/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(courseCode)}/assignments` } }
    );
    // Some APIs return empty body on delete; treat 200/204 as ok.
    return { ok: true, status: 200, res };
  } catch (e) {
    return { ok: false, status: e?.status || 500, error: extractApiErrorMessage(e, 'Failed to delete assignment') };
  }
}

// ============================
// Courses Management
// ============================

export async function createCourse(data) {
  try {
    const res = await api.post('/courses/manage', data, { cache: { invalidate: '/courses/manage' } });
    return res;
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to create course'));
  }
}

export async function updateCourse(code, data) {
  try {
    const res = await api.put(`/courses/manage/${encodeURIComponent(code)}`, data, { 
      cache: { invalidate: ['/courses/manage', `/courses/manage/${encodeURIComponent(code)}`] } 
    });
    return res;
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to update course'));
  }
}

export async function deleteCourse(code) {
  try {
    const res = await api.del(`/courses/manage/${encodeURIComponent(code)}`, { 
      cache: { invalidate: '/courses/manage' } 
    });
    return res;
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to delete course'));
  }
}

export async function fetchCourseByCodeDirect(code) {
  try {
    const res = await api.get(`/courses/manage/${encodeURIComponent(code)}`);
    return res;
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to fetch course'));
  }
}

// ============================
// Student Ranking & Financing
// ============================

/**
 * Get student ranking for scholarships
 * @param {Object} options - Optional filters
 * @param {string} options.programCode - Filter by program
 * @param {number} options.studyYear - Filter by study year
 * @param {number} options.limit - Max results (default 100)
 */
export async function fetchStudentRanking(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.programCode) params.append('programCode', options.programCode);
    if (options.studyYear) params.append('studyYear', options.studyYear);
    if (options.limit) params.append('limit', options.limit);
    
    const query = params.toString();
    const url = `/students/ranking${query ? `?${query}` : ''}`;
    console.log('[fetchStudentRanking] Calling:', url);
    const res = await api.get(url, { cache: { ttl: CACHE_TTL.short } });
    console.log('[fetchStudentRanking] Response:', res);
    return res;
  } catch (err) {
    console.error('[fetchStudentRanking] Error:', err);
    return { total: 0, ranking: [] };
  }
}

/**
 * Get specific student's ranking position
 * @param {string} studentId - Student ID
 */
export async function fetchStudentRankingPosition(studentId) {
  if (!studentId) return null;
  try {
    const res = await api.get(`/students/${encodeURIComponent(studentId)}/ranking`, { cache: { ttl: CACHE_TTL.short } });
    console.log('[fetchStudentRankingPosition] Response:', res);
    return res;
  } catch (err) {
    console.error('[fetchStudentRankingPosition] Error:', err);
    return null;
  }
}

/**
 * Get variable symbols for a student
 * @param {string} studentId - Student ID
 */
export async function fetchStudentVariableSymbols(studentId) {
  if (!studentId) return [];
  try {
    const res = await api.get(`/students/${encodeURIComponent(studentId)}/variable-symbols`, { cache: { ttl: CACHE_TTL.short } });
    return Array.isArray(res) ? res : [];
  } catch { return []; }
}

/**
 * Get bank connections for a student
 * @param {string} studentId - Student ID
 */
export async function fetchStudentBankConnections(studentId) {
  if (!studentId) return [];
  try {
    const res = await api.get(`/students/${encodeURIComponent(studentId)}/bank-connections`, { cache: { ttl: CACHE_TTL.short } });
    return Array.isArray(res) ? res : [];
  } catch { return []; }
}

// ============================
// Payments API
// ============================

/**
 * Get all payments for a student
 * @param {string} studentId - Student ID
 * @param {Object} options - Optional filters
 * @param {string} options.status - Filter by status (pending, posted, failed, refunded)
 * @param {string} options.academicYear - Filter by academic year
 */
export async function fetchStudentPayments(studentId, options = {}) {
  if (!studentId) return [];
  try {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.academicYear) params.append('academicYear', options.academicYear);
    
    const query = params.toString();
    const url = `/payments/student/${encodeURIComponent(studentId)}${query ? `?${query}` : ''}`;
    const res = await api.get(url, { cache: { ttl: CACHE_TTL.short } });
    return Array.isArray(res) ? res : [];
  } catch { return []; }
}

/**
 * Get payment summary for a student
 * @param {string} studentId - Student ID
 */
export async function fetchStudentPaymentSummary(studentId) {
  if (!studentId) return null;
  try {
    const res = await api.get(`/payments/student/${encodeURIComponent(studentId)}/summary`, { cache: { ttl: CACHE_TTL.short } });
    return res || null;
  } catch { return null; }
}

/**
 * Get combined finance data for a student (payments + symbols + bank connections)
 * @param {string} studentId - Student ID
 */
export async function fetchStudentFinance(studentId) {
  if (!studentId) return null;
  try {
    const res = await api.get(`/payments/student/${encodeURIComponent(studentId)}/finance`, { cache: { ttl: CACHE_TTL.short } });
    return res || null;
  } catch { return null; }
}

/**
 * Create a new payment
 * @param {Object} data - Payment data
 */
export async function createPayment(data) {
  try {
    const res = await api.post('/payments', data, { cache: { invalidate: '/payments' } });
    return res;
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to create payment'));
  }
}

/**
 * Update payment status
 * @param {number} paymentId - Payment ID
 * @param {string} status - New status (pending, posted, failed, refunded)
 */
export async function updatePaymentStatus(paymentId, status) {
  if (!paymentId) return null;
  try {
    const res = await api.put(`/payments/${encodeURIComponent(paymentId)}/status`, { status }, { cache: { invalidate: '/payments' } });
    return res;
  } catch (e) {
    throw new Error(extractApiErrorMessage(e, 'Failed to update payment status'));
  }
}
