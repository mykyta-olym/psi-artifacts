// src/data/gradebookApiAdapter.js
import api from '../utils/apiClient';
import { maisId } from '../utils/ids';
import { fetchTeacherCourseRoster, fetchTeacherCourseGrades } from './maisApiAdapter';

function toGradesMap(gradeArray = []) {
  const map = {};
  for (const g of gradeArray) {
    const key = `${g.studentId}-${g.assignmentId}`;
    map[key] = {
      points: g.points,
      percentage: g.percentage,
      letterGrade: g.letterGrade,
      lastUpdated: g.lastUpdated,
    };
  }
  return map;
}

function toClassStudentsMap(arr = []) {
  const m = new Map();
  for (const cs of arr) {
    m.set(cs.classId, cs.students || []);
  }
  return m;
}

export async function buildGradebookForTeacher(email, options = {}) {
  const cacheOpts = options.skipCache ? { cache: { ttl: 0 } } : {};
  const data = await api.get(`/teachers/${encodeURIComponent(email)}/gradebook`, cacheOpts);
  const grades = toGradesMap(data?.grades || []);
  const classStudents = toClassStudentsMap(data?.classStudents || []);
  const teacher = data?.teacher || null;
  const classes = Array.isArray(data?.classes) ? data.classes : [];
  const rawGrades = Array.isArray(data?.grades) ? data.grades : [];

  const finalGradeRecords = [];
  try {
    const uniqueCourseCodes = Array.from(new Set(classes.map((c) => c?.code || c?.Code).filter(Boolean)));
    for (const code of uniqueCourseCodes) {
      const courseGrades = await fetchTeacherCourseGrades(email, code);
      if (Array.isArray(courseGrades) && courseGrades.length) {
        courseGrades.forEach((g) => {
          finalGradeRecords.push({
            studentId: g?.studentId || g?.StudentId || '',
            courseCode: code,
            continuousPoints: g?.continuousPoints ?? g?.ContinuousPoints ?? null,
            examPoints: g?.finalPoints ?? g?.FinalPoints ?? null,
            totalPoints: g?.totalPoints ?? g?.TotalPoints ?? null,
            continuousPercent: g?.continuousPercent ?? g?.ContinuousPercent ?? null,
            examPercent: g?.finalPercent ?? g?.FinalPercent ?? null,
            totalPercent: g?.totalPercent ?? g?.TotalPercent ?? null,
            letterGrade: g?.letterGrade || g?.LetterGrade || '',
            lastUpdated: g?.lastUpdated || g?.LastUpdated || '',
          });
        });
      }
    }
  } catch {
    /* ignore grade fetch failures */
  }

  // Replace roster with real enrollments from database
  // This ensures only students who actually enrolled are shown
  try {
    const byCourse = new Map();
    classes.forEach((c) => { if (c?.code) byCourse.set(c.code, c.id); });
    for (const course of classes) {
      const code = course?.code;
      const classId = course?.id;
      if (!code || !classId) continue;
      // Invalidate cache for roster if skipCache is enabled
      if (options.skipCache) {
        api.invalidateCache(`/teachers/${encodeURIComponent(email)}/courses/${encodeURIComponent(code)}/roster`);
      }
      const { roster } = await fetchTeacherCourseRoster(email, code, options.skipCache ? { ttl: 0 } : {});
      // Always set roster, even if empty - this ensures students without enrollment are not shown
      const students = Array.isArray(roster) && roster.length
        ? roster.map((r) => ({
            id: r.studentId,
            fullName: r.studentName || r.studentId,
            email: r.studentEmail || '',
            sectionKey: r.groupKey || null,
          }))
        : [];
      classStudents.set(classId, students);
    }
  } catch { 
    classes.forEach((c) => {
      if (c?.id) classStudents.set(c.id, []);
    });
  }

  const assignments = Array.isArray(data?.assignments)
    ? data.assignments.map((a) => ({
        ...a,
        id: a?.id || maisId('asg', `${a?.classId ?? ''}|${a?.name ?? ''}|${a?.dueDate ?? ''}`),
      }))
    : [];

  return { teacher, classes, classStudents, assignments, grades, gradeRecords: rawGrades, finalGrades: finalGradeRecords };
}
