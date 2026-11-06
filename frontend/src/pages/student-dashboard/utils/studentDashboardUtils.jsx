// src/pages/student-dashboard/utils/studentDashboardUtils.jsx
import { maisId } from '../../../utils/ids';

import { createLogger } from '../../../utils/logger';
const logger = createLogger('studentDashboardUtils');

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const norm = (s = '') => s.toString().trim().toLowerCase();
const asYear = (periodSk = '') => {
    const m = String(periodSk).match(/(\d+)\.\s*rok/i);
    return m ? m[1] : '1';
};
const todayName = () => weekdayNames[new Date().getDay()];
const H = (s) => { let h = 2166136261 >>> 0; const x = String(s || ''); for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const STRIP_PREFIX = /^(?:Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|Mgr\. art\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+/gi;
const STRIP_SUFFIX = /\s*,\s*(?:PhD\.|CSc\.|DrSc\.)$/i;

export const stripTitles = (s = '') => String(s).replace(STRIP_PREFIX, '').replace(STRIP_SUFFIX, '').trim();

export const degreeShort = (programCode = '') => {
    const c = String(programCode).toLowerCase();
    if (/_bc_/.test(c)) return 'Bc.';
    if (/_mgr_/.test(c)) return 'Mgr.';
    if (/_ing_/.test(c)) return 'Ing.';
    if (/phd|_phd_/.test(c)) return 'PhD';
    return '';
};

export const programNameFromStudy = (study, fallback) => {
    const code = String(study?.programCode || '').toUpperCase();
    const sk = /_SK$/.test(code);
    const prefix = code.split('_')[0];
    if (study?.programName) return study.programName;
    if (fallback) return fallback;
    if (prefix === 'INF') return sk ? 'Informatika' : '';
    return '';
};

const enrolledCoursesForStudent = (student, courses = [], events = []) => {
    const y = String(student?.studyYear || 1);
    const pool = (Array.isArray(courses) ? courses : []).filter((c) => String(asYear(c?.periodSk || '1')) === y);
    const codesInEvents = new Set((Array.isArray(events) ? events : []).map((e) => e.code || e.courseCode).filter(Boolean));
    const filtered = pool.filter((c) => codesInEvents.has(c.code));
    if (filtered.length) return filtered;
    return pool.length ? pool : (Array.isArray(courses) ? courses : []).slice(0, 6);
};

const groupPickFor = (email, slots) => {
    const list = Array.isArray(slots) ? slots.filter(Boolean) : [];
    if (!list.length) return null;
    const idx = H(email) % list.length;
    return list[idx];
};

const mapSlotToHour = (slot = '09:00-10:00') => {
    const [s, e] = slot.split('-');
    return { startTime: s?.trim() || '09:00', endTime: e?.trim() || '10:00' };
};

export const buildStudentSchedule = (student, events = [], courses = [], enrollments = []) => {
    // If no enrollments, return empty schedule - student must enroll first
    if (!enrollments || enrollments.length === 0) {
        logger.debug('[student-dashboard] buildStudentSchedule - No enrollments, returning empty schedule');
        return [];
    }
    
    // Get enrolled course codes and schedule event IDs from enrollments
    // Normalize course codes to uppercase for case-insensitive comparison
    const enrolledCourseCodes = new Set(enrollments.map((e) => String(e.courseCode || e.code || '').trim().toUpperCase()).filter(Boolean));
    
    // Build a map of enrolled schedule event IDs for filtering
    const enrolledEventIds = new Set();
    if (enrollments && enrollments.length > 0) {
        enrollments.forEach((e) => {
            // Handle both scheduleEventId and scheduleEventID (case variations)
            const eventId = e.scheduleEventId || e.scheduleEventID || e.schedule_event_id;
            if (eventId) {
                enrolledEventIds.add(String(eventId).trim());
            }
        });
        // Debug log - always log when we have enrollments
        logger.debug('[student-dashboard] buildStudentSchedule - Input:', {
            enrollmentsCount: enrollments.length,
            enrolledCourseCodes: Array.from(enrolledCourseCodes),
            enrolledEventIds: Array.from(enrolledEventIds),
            eventsCount: events?.length || 0,
            enrollments: enrollments.map(e => ({
                courseCode: e.courseCode || e.code,
                scheduleEventId: e.scheduleEventId || e.scheduleEventID || e.schedule_event_id,
                academicYear: e.academicYear,
                semester: e.semester
            }))
        });
    }
    
    const mail = student?.email || '';
    const byDay = (day) => {
        return (Array.isArray(events) ? events : []).filter((t) => {
            const dayMatch = norm(t.day) === norm(day);
            if (!dayMatch) return false;
            
            const eventId = String(t.id || t.ID || t.Id || '').trim();
            const eventCode = String(t.code || t.courseCode || '').trim().toUpperCase();
            
            // If we have enrollments with scheduleEventId, filter by both course code AND schedule event ID
            if (enrollments && enrollments.length > 0 && enrolledEventIds.size > 0) {
                const matchesEventId = enrolledEventIds.has(eventId);
                const matchesCourseCode = enrolledCourseCodes.has(eventCode);
                
                // Debug logging for troubleshooting
                if (enrolledCourseCodes.has(eventCode)) {
                    logger.debug('[student-dashboard] buildStudentSchedule - Event check:', {
                        eventId,
                        eventCode,
                        day: t.day,
                        matchesEventId,
                        matchesCourseCode,
                        enrolledEventIds: Array.from(enrolledEventIds),
                        enrolledCourseCodes: Array.from(enrolledCourseCodes)
                    });
                }
                
                // Show event if it matches an enrolled scheduleEventId OR if it's from an enrolled course (for backward compatibility)
                if (matchesEventId || matchesCourseCode) {
                    return true;
                }
                return false;
            }
            
            // If we have enrollments but no scheduleEventIds, filter by course code only
            if (enrolledCourseCodes.size > 0) {
                const shouldShow = enrolledCourseCodes.has(eventCode);
                if (shouldShow) {
                    logger.debug('[student-dashboard] buildStudentSchedule - Event matched by courseCode:', {
                        eventId,
                        eventCode,
                        day: t.day,
                        enrolledCourseCodes: Array.from(enrolledCourseCodes),
                        eventFull: { id: t.id, code: t.code, courseCode: t.courseCode, day: t.day }
                    });
                } else {
                    // Log why event was filtered out
                    if (eventCode) {
                        logger.debug('[student-dashboard] buildStudentSchedule - Event filtered out:', {
                            eventId,
                            eventCode,
                            day: t.day,
                            enrolledCourseCodes: Array.from(enrolledCourseCodes),
                            reason: 'courseCode not in enrolledCourseCodes'
                        });
                    }
                }
                return shouldShow;
            }
            
            // If no enrollments, show NO events - student must enroll first
            if (!enrollments || enrollments.length === 0) {
                logger.debug('[student-dashboard] buildStudentSchedule - No enrollments, hiding all events');
                return false;
            }
            return true;
        });
    };
    let list = byDay(todayName());
    logger.debug('[student-dashboard] buildStudentSchedule - Today schedule after filter:', {
        today: todayName(),
        todayCount: list.length,
        enrolledCourseCodes: Array.from(enrolledCourseCodes),
        enrolledEventIds: Array.from(enrolledEventIds),
        sampleEvents: list.slice(0, 3).map(e => ({ id: e.id, code: e.code || e.courseCode, day: e.day }))
    });
    if (!list.length) {
        for (const d of WEEK_DAYS) {
            const tmp = byDay(d);
            if (tmp.length) { 
                logger.debug('[student-dashboard] buildStudentSchedule - Found schedule for:', d, 'count:', tmp.length);
                list = tmp; 
                break; 
            }
        }
    }
    logger.debug('[student-dashboard] buildStudentSchedule - Final schedule count:', list.length);
    // Build a map of course codes to course names for lookup
    const courseNameMap = new Map();
    (courses || []).forEach((c) => {
        const code = String(c?.code || '').trim().toUpperCase();
        if (code) {
            const name = c?.nameEn || c?.nameSk || c?.name || '';
            if (name) courseNameMap.set(code, name);
        }
    });
    
    return list
        .map((row) => {
            const code = String(row.code || row.courseCode || '').trim().toUpperCase();
            // Try to get course name from courses list first, then from row data
            let courseName = '';
            if (code && courseNameMap.has(code)) {
                courseName = courseNameMap.get(code);
            } else {
                courseName = row.subject || row.courseName || '';
            }
            // Fallback to code only if no name found
            const displayName = courseName || code;
            const pickedGroup = groupPickFor(mail, row.classGroupKeys || [row.group].filter(Boolean));
            const hours = mapSlotToHour(row.slot || `${row.startTime || row.start}-${row.endTime || row.end}`);
            // Get student's class from className or group
            let studentClass = '';
            // Try to get className from student object (from DB)
            const studentClassName = student?.className || student?.class || '';
            if (studentClassName) {
                // Normalize className (e.g., "01.sk" -> "01-sk")
                const normalized = String(studentClassName).toLowerCase().replace(/\./g, '-').replace(/\s+/g, '');
                const match = normalized.match(/^(\d{1,2})-?sk$/) || normalized.match(/^sk-?(\d{1,2})$/) || normalized.match(/^(\d{1,2})$/);
                if (match) {
                    const num = String(parseInt(match[1], 10)).padStart(2, '0');
                    studentClass = `${num}-sk`;
                } else {
                    studentClass = studentClassName;
                }
            } else if (pickedGroup) {
                // Fallback to pickedGroup from schedule event
                studentClass = pickedGroup;
            }
            
            return {
                subject: displayName,
                grade: studentClass || String(student?.studyYear || 1), // Use class instead of grade
                startTime: hours.startTime,
                endTime: hours.endTime,
                room: row.room || row.location || '',
                group: pickedGroup || null
            };
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
};

export const buildAllWeekSchedule = (student, events = [], courses = [], enrollments = []) => {
    // Get enrolled course codes and schedule event IDs from enrollments
    // Normalize course codes to uppercase for case-insensitive comparison
    const enrolledCourseCodes = enrollments && enrollments.length > 0
        ? new Set(enrollments.map((e) => String(e.courseCode || e.code || '').trim().toUpperCase()).filter(Boolean))
        : new Set(enrolledCoursesForStudent(student, courses, events).map((c) => String(c.code || '').trim().toUpperCase()).filter(Boolean));
    
    // Build a map of enrolled schedule event IDs for filtering
    const enrolledEventIds = new Set();
    if (enrollments && enrollments.length > 0) {
        enrollments.forEach((e) => {
            // Handle both scheduleEventId and scheduleEventID (case variations)
            const eventId = e.scheduleEventId || e.scheduleEventID || e.schedule_event_id;
            if (eventId) {
                enrolledEventIds.add(String(eventId).trim());
            }
        });
    }
    
    const mail = student?.email || '';
    const mapSlotToHour2 = (slot = '09:00-10:00') => { const [s, e] = slot.split('-'); return { start: s?.trim() || '09:00', end: e?.trim() || '10:00' }; };
    return (Array.isArray(events) ? events : [])
        .filter((t) => {
            // If we have enrollments with scheduleEventId, filter by both course code AND schedule event ID
            if (enrollments && enrollments.length > 0 && enrolledEventIds.size > 0) {
                const eventId = String(t.id || t.ID || t.Id || '').trim();
                const eventCode = String(t.code || t.courseCode || '').trim().toUpperCase();
                const matchesEventId = enrolledEventIds.has(eventId);
                const matchesCourseCode = enrolledCourseCodes.has(eventCode);
                // Show event if it matches an enrolled scheduleEventId OR if it's from an enrolled course (for backward compatibility)
                return matchesEventId || matchesCourseCode;
            }
            
            // If we have enrollments but no scheduleEventIds, filter by course code only
            if (enrolledCourseCodes.size > 0) {
                const eventCode = String(t.code || t.courseCode || '').trim().toUpperCase();
                return enrolledCourseCodes.has(eventCode);
            }
            
            // Fallback: show all events if no enrollments
            return true;
        })
        .map((t) => {
            const code = t.code || t.courseCode;
            const subject = t.subject || t.courseName || code;
            const g = groupPickFor(mail, t.classGroupKeys || [t.group].filter(Boolean));
            const hh = mapSlotToHour2(t.slot || `${t.start || t.startTime}-${t.end || t.endTime}`);
            return {
                id: maisId('evt', `${t.day}|${hh.start}-${hh.end}|${code}|${t.room || t.location || ''}|${g || 'all'}`),
                day: t.day,
                start: hh.start,
                end: hh.end,
                subject,
                code,
                room: t.room || t.location || '',
                group: g
            };
        });
};

export const computeStatsForStudent = (student, allWeek, cohortSize = 0) => {
    const today = norm(todayName());
    const classesToday = allWeek.filter((x) => norm(x.day) === today).length;
    // Return null for metrics that don't have real data
    return {
        totalStudents: Number.isFinite(cohortSize) && cohortSize > 0 ? cohortSize : null,
        classesToday: Number.isFinite(classesToday) && classesToday > 0 ? classesToday : null,
        pendingGrades: null, // No real data available
        attendanceRate: null, // No real data available
        studentChange: null,
        gradeChange: null,
        attendanceChange: null
    };
};

export const buildMyCourses = (student, enrollments = [], grades = []) => {
    // Build courses from real enrollment and grade data
    if (!enrollments || enrollments.length === 0) {
        return [];
    }
    
    return enrollments.map((enrollment) => {
        const grade = grades.find(g => g.courseCode === enrollment.courseCode);
        return {
            id: maisId('course', `${enrollment.courseCode}|${student?.id || student?.email}`),
            code: enrollment.courseCode,
            name: enrollment.courseName || enrollment.courseCode,
            credits: enrollment.credits || 6,
            progress: grade?.totalPercent || 0,
            currentGrade: grade?.totalPercent || 0,
            gradeLetter: grade?.letterGrade || '',
            completion: enrollment.completion || 'KZ',
            upcomingTasks: 0
        };
    });
};

export const resolveTukeMaterialsUrl = (code, name) => {
    const c = String(code || '').toUpperCase();
    const n = String(name || '');
    // If you have a known mapping from backend, put it here
    const known = {
        BVPS: 'https://www.fei.tuke.sk/en/study/courses?search=BvPS',
        NMPS: 'https://www.fei.tuke.sk/en/study/courses?search=NMPS',
        KSV_SVT: 'https://www.fei.tuke.sk/en/study/courses?search=KSV',
        GAMEDEV: 'https://www.fei.tuke.sk/en/study/courses?search=Game%20Development',
        BP: 'https://www.fei.tuke.sk/en/study/final-thesis'
    };
    if (known[c]) return known[c];
    const q = encodeURIComponent(c || n);
    return `https://www.fei.tuke.sk/en/study/courses?search=${q}`;
};

export const buildUpcomingDeadlines = (student, enrollments = [], assignments = []) => {
    // Only return real deadlines from assignments/enrollments, not synthetic ones
    if (!Array.isArray(assignments) || assignments.length === 0) {
        return [];
    }
    
    const now = Date.now();
    const validDeadlines = assignments
        .filter((a) => {
            // Only include if it has a valid due date
            if (!a.dueDate && !a.dueDateDate) return false;
            const dueDate = a.dueDateDate || (a.dueDate ? new Date(a.dueDate) : null);
            if (!dueDate || !Number.isFinite(dueDate.getTime())) return false;
            // Only include future deadlines
            if (dueDate.getTime() < now) return false;
            return true;
        })
        .map((a) => {
            const dueDate = a.dueDateDate || (a.dueDate ? new Date(a.dueDate) : null);
            const courseCode = a.courseCode || a.code || '';
            const courseName = a.courseName || a.subject || courseCode;
            return {
                id: a.id || maisId('due', `${courseCode}|${dueDate.toISOString()}`),
                title: a.title || a.name || 'Assignment',
                course: `${courseName}${courseCode ? ` (${courseCode})` : ''}`,
                dueStr: dueDate.toLocaleString(),
                href: `/terminy?tab=register&course=${encodeURIComponent(courseCode)}`
            };
        });
    
    return validDeadlines.sort((a, b) => new Date(a.dueStr) - new Date(b.dueStr));
};