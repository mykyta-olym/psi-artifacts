// src/pages/student-studies/utils/studentStudiesUtils.jsx
import { fetchCourses, fetchStudentEnrollments, fetchStudentGrades, fetchStudents, fetchScheduleEvents, fetchFaculty } from '../../../data/maisApiAdapter';
import { getStudentAttendanceStats, getAttendanceByStudent } from '../../../data/attendanceApi';
import api from '../../../utils/apiClient';
import { maisId } from '../../../utils/ids';

export const CURRENT_YEAR = '2025/2026';
export const CURRENT_YEAR_SLUG = CURRENT_YEAR.replace('/', '-');
export const KEY_CURR_WS = `1-year-${CURRENT_YEAR_SLUG}-WS`;
export const KEY_CURR_SS = `1-year-${CURRENT_YEAR_SLUG}-SS`;

export const ARCH_YEAR = '2024/2025';
export const ARCH_YEAR_SLUG = ARCH_YEAR.replace('/', '-');
export const KEY_ARCH_WS = `3-year-${ARCH_YEAR_SLUG}-WS`;
export const KEY_ARCH_SS = `3-year-${ARCH_YEAR_SLUG}-SS`;

export const SELECTED_STUDY_KEY = 'study.selected';

export const asString = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' && 'value' in v ? String(v.value) : String(v ?? ''));

export const H = (s) => { let h = 2166136261 >>> 0; const x = String(s || ''); for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const pct = (n) => Math.max(0, Math.min(100, Math.round(n)));

export const creditsOf = (c) => c?.credits ?? c?.ects ?? 6;

export const to12h = (hhmm = '08:00') => { const [h, m] = hhmm.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = ((h + 11) % 12) + 1; return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${ampm}`; };

export const todayName = () => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

export const guessLoggedStudent = (email = '') => {
    const targetEmail = String(email || '').trim();
    if (!targetEmail) return null;
    const baseName = targetEmail.includes('@') ? targetEmail.split('@')[0] : targetEmail;
    return {
        id: baseName || 'student-demo',
        fullName: baseName.replace(/[._-]+/g, ' ') || 'Student',
        email: targetEmail,
        studyYear: '1',
    };
};

export const isThesisCourse = (courseLike) => {
    const code = String(courseLike?.code || courseLike?.id || '').toUpperCase();
    const name = String(courseLike?.nameEn || courseLike?.name || '').toLowerCase();
    return /^BP$/.test(code) || /bakal|bachelor/.test(name);
};

export const isDiplomaProjectCourse = (x) => {
    const code = String(x?.code || x?.id || '').toUpperCase();
    const name = String(x?.nameEn || x?.name || '').toLowerCase();
    return /^DP[_\s-]?1$/.test(code) || /diplomov[ýy]\s*projekt\s*1|diploma\s*project\s*1/.test(name);
};

export const buildArchivedStudies = () => {
    return { courses: [], earnedCredits: 0, totalCredits: 0, gpa: 0, attendanceAvg: 0 };
};

// Build current studies using live API (Enrollments + Courses + CourseGrades)
export const buildStudentStudiesFromApi = async (studentLike) => {
    try {
        let studentId = String(studentLike?.id || '').trim();
        const email = String(studentLike?.email || '').trim();
        if (!studentId && email) {
            // Resolve DB student id by email
            const matches = await fetchStudents({ q: email, page: 1, pageSize: 10 });
            const me = (Array.isArray(matches) ? matches : []).find(s => String(s.email||'').toLowerCase() === email.toLowerCase())
                || (Array.isArray(matches) ? matches[0] : null);
            if (me && me.id) studentId = String(me.id);
        }
        if (!studentId) return null;
        const [enrollments, allCourses, grades, allEvents, facultyList, attendanceStats, attendanceRecords] = await Promise.all([
            fetchStudentEnrollments(studentId),
            fetchCourses(),
            fetchStudentGrades(studentId),
            fetchScheduleEvents({}),
            fetchFaculty(),
            getStudentAttendanceStats(studentId).catch(() => null),
            getAttendanceByStudent(studentId).catch(() => [])
        ]);
        
        // Build weekly trend from real attendance records
        const buildWeeklyTrend = (courseCode) => {
            const records = (attendanceRecords || []).filter(r => String(r.courseCode) === String(courseCode));
            if (!records.length) return [];
            
            // Group by week (last 12 weeks)
            const now = new Date();
            const weeks = [];
            for (let w = 11; w >= 0; w--) {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - (w * 7) - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                
                const weekRecords = records.filter(r => {
                    // API returns sessionDate (format: yyyy-MM-dd) not date
                    const d = new Date(r.sessionDate || r.date);
                    return d >= weekStart && d <= weekEnd;
                });
                
                const present = weekRecords.filter(r => r.status === 'present' || r.status === 'late').length;
                const total = weekRecords.length;
                const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                
                weeks.push({
                    id: `week-${12 - w}`,
                    date: weekStart.toISOString().split('T')[0],
                    attendanceRate: rate
                });
            }
            return weeks;
        };
        
        // Build attendance map by course from real API data
        const attendanceByCourse = new Map();
        if (attendanceStats && Array.isArray(attendanceStats.byCourse)) {
            attendanceStats.byCourse.forEach(c => {
                attendanceByCourse.set(String(c.courseCode), c.rate ?? 0);
            });
        }
        const courseMap = new Map((allCourses || []).map(c => [String(c.code), c]));
        const gradeByCourse = new Map((grades || []).map(g => [String(g.courseCode), g]));
        const eventsByCourse = new Map();
        (allEvents || []).forEach(ev => {
            const code = String(ev?.courseCode || ''); if (!code) return;
            if (!eventsByCourse.has(code)) eventsByCourse.set(code, []);
            eventsByCourse.get(code).push(ev);
        });
        const teacherNameByEmail = (() => {
            const map = new Map();
            (facultyList || []).forEach(f => {
                const email = String(f?.email || f?.mail || '').toLowerCase();
                const full = f?.fullName || f?.name || [f?.firstName, f?.lastName].filter(Boolean).join(' ').trim();
                if (email) map.set(email, full || email);
            });
            return map;
        })();
        const displayNameOfEmail = (email) => {
            const key = String(email || '').toLowerCase();
            return teacherNameByEmail.get(key) || email || '';
        };

        const toPct = (n) => {
            const v = Number(n);
            return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;
        };
        const toLetter = (pct) => (pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : pct >= 50 ? 'E' : 'F');
        const letterPts = (L) => (L === 'A' ? 4 : L === 'B' ? 3 : L === 'C' ? 2 : L === 'D' ? 1 : L === 'E' ? 1 : 0);

        const enrolledCodes = Array.from(new Set((enrollments || []).map(e => String(e.courseCode))));
        const courses = enrolledCodes.map(code => {
            const meta = courseMap.get(code) || {};
            const g = gradeByCourse.get(code) || null;
            const totalPct = toPct(g?.totalPercent);
            const letter = (g?.letterGrade && typeof g.letterGrade === 'string') ? g.letterGrade : toLetter(totalPct);
            const awardDate = g?.awardedAt ? new Date(g.awardedAt).toLocaleDateString() : null;
            const completion = meta?.CompletionSk || meta?.completionSk || (String(g?.assessmentType || '').toUpperCase() || 'WS');
            const name = meta?.nameEn || meta?.nameSk || meta?.name || code;
            const credits = Number.isFinite(meta?.credits) ? meta.credits : (Number.isFinite(meta?.ECTS) ? meta.ECTS : 6);
            const weeklyTrend = buildWeeklyTrend(code);
            const contPct = toPct(g?.continuousPercent);
            const finPct = toPct(g?.finalPercent);
            // Lecturer from timetable: pick first event of type 'L' or 'LECTURE'; fallback to any teacher for the course; else grade teacher
            const evs = eventsByCourse.get(code) || [];
            const isLecture = (t) => {
                const s = String(t || '').toUpperCase();
                return s === 'L' || s.includes('LECTURE') || s === 'LEC';
            };
            let lecturerEmail = null;
            const lec = evs.find(e => isLecture(e?.type) && e?.teacherEmail);
            if (lec?.teacherEmail) lecturerEmail = lec.teacherEmail;
            else if (evs.length && evs[0]?.teacherEmail) lecturerEmail = evs[0].teacherEmail;
            const instructor = displayNameOfEmail(lecturerEmail || g?.teacherEmail || '');

            const awardedBy = g?.teacherEmail ? displayNameOfEmail(g.teacherEmail) : instructor;
            const overall = { pct: totalPct, letter, date: awardDate, by: awardedBy };
            const continuous = g && String(g.assessmentType).toUpperCase() === 'WS'
                ? {
                    passedPct: contPct,
                    maxPct: 40,
                    thresholdPct: 21,
                    items: contPct > 0 ? [{ no: 1, title: 'Continuous', pct: contPct, date: awardDate || '', by: awardedBy, note: '' }] : []
                }
                : undefined;
            const final = g
                ? {
                    passedPct: String(g.assessmentType).toUpperCase() === 'WS' ? finPct : totalPct,
                    maxPct: String(g.assessmentType).toUpperCase() === 'WS' ? 60 : 100,
                    thresholdPct: String(g.assessmentType).toUpperCase() === 'WS' ? 31 : 51,
                    items: [
                        {
                            no: 1,
                            title: String(g.assessmentType).toUpperCase() === 'WS' ? 'Exam' : 'Classified Credit',
                            pct: String(g.assessmentType).toUpperCase() === 'WS' ? finPct : totalPct,
                            termType: String(g.assessmentType).toUpperCase() === 'WS' ? 'Regular' : undefined,
                            date: awardDate || '',
                            by: awardedBy,
                            note: ''
                        }
                    ]
                }
                : undefined;
            return {
                id: maisId('COURSE', `${code}|${studentId}`),
                code,
                name,
                credits,
                gradePct: totalPct,
                gradeLetter: letter,
                attendance: attendanceByCourse.get(code) ?? (attendanceStats?.attendanceRate ?? 0),
                progress: totalPct,
                weeklyTrend,
                completion,
                instructor,
                overall,
                continuous,
                final
            };
        });

        const earnedCredits = courses.reduce((s, c) => s + (c.gradePct >= 50 ? c.credits : 0), 0);
        const totalCredits = courses.reduce((s, c) => s + c.credits, 0);
        const gpa = (() => {
            if (!courses.length) return 0;
            const sum = courses.reduce((acc, c) => acc + letterPts(c.gradeLetter), 0);
            return Math.round((sum / courses.length) * 100) / 100;
        })();
        const attendanceAvg = courses.length ? Math.round(courses.reduce((a, c) => a + (c.attendance || 0), 0) / courses.length) : 0;

        const scheduleEntries = Array.from(enrolledCodes).flatMap(code => eventsByCourse.get(code) || []);

        return { courses, earnedCredits, totalCredits, gpa, attendanceAvg, scheduleEntries };
    } catch {
        return null;
    }
};

// Generate finance symbols from student data
export const generateFinanceSymbols = (student) => {
    const baseVs = String(H(student.email || student.id)).slice(0, 8);
    const baseSs = String(H(student.id || student.email) ^ 0xabcdef).slice(0, 6);
    return { variableSymbol: baseVs, specificSymbol: baseSs };
};

export const buildScheduleSnapshot = (studentCourses = [], scheduleEntries = []) => {
    const grouped = new Map();
    (scheduleEntries || []).forEach((entry) => {
        const code = String(entry?.courseCode || '').toUpperCase();
        if (!code) return;
        if (!grouped.has(code)) grouped.set(code, []);
        grouped.get(code).push(entry);
    });

    const to12Hour = (hhmm = '09:00') => {
        const [h, m] = String(hhmm).split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = ((h + 11) % 12) + 1;
        return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${period}`;
    };

    return (studentCourses || [])
        .map((course) => {
            const code = String(course?.code || course?.id || '').toUpperCase();
            const events = grouped.get(code) || [];
            const first = events[0] || null;
            const day = first?.day || todayName();
            const slot = first?.slot || (first?.time && first?.endTime ? `${first.time}-${first.endTime}` : '09:00-10:00');
            const [startRaw, endRaw] = slot.split('-');
            const start = to12Hour(startRaw || first?.time || '09:00');
            const end = to12Hour(endRaw || first?.endTime || '10:00');
            const room = first?.room || '—';
            return {
                code,
                name: course?.name || course?.nameEn || course?.nameSk || code,
                day,
                start,
                end,
                room,
            };
        })
        .slice(0, 4);
};