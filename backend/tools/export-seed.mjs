// Export mock data from the frontend (ESM) to JSON seed files for the backend
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Compute project root from backend/tools -> go two levels up
const ROOT = path.resolve(process.cwd(), '..', '..'); // project root at mais-management-system-main
const SRC_DIR = path.join(ROOT, 'src');
const DATA_DIR = path.join(ROOT, 'backend', 'data', 'seed');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function importModule(absPath) {
  const url = pathToFileURL(absPath).href;
  return import(url);
}

// Some frontend files are ESM .js but live under a package.json without "type":"module".
// To reliably import them in Node, copy them into a temporary folder with .mjs extension and fixed imports.
async function prepareTmpEsm() {
  const TMP_DIR = path.join(ROOT, 'backend', 'tools', '.tmp-esm');
  await ensureDir(TMP_DIR);

  const srcMais = path.join(SRC_DIR, 'data', 'maisData.js');
  const srcGb = path.join(SRC_DIR, 'data', 'gradebookMockFromMais.js');
  const srcIds = path.join(SRC_DIR, 'utils', 'ids.js');
  const tmpMais = path.join(TMP_DIR, 'maisData.mjs');
  const tmpGb = path.join(TMP_DIR, 'gradebookMockFromMais.mjs');
  const tmpIds = path.join(TMP_DIR, 'ids.mjs');

  // Copy ids.js -> ids.mjs as-is
  const idsCode = await fs.readFile(srcIds, 'utf8');
  await fs.writeFile(tmpIds, idsCode, 'utf8');

  // Rewrite maisData.js imports to local ids.mjs and save as .mjs
  let maisCode = await fs.readFile(srcMais, 'utf8');
  maisCode = maisCode.replace(/from\s+['"]\.\.\/utils\/ids['"]/g, "from './ids.mjs'");
  await fs.writeFile(tmpMais, maisCode, 'utf8');

  // Rewrite gradebookMockFromMais.js imports to local files
  let gbCode = await fs.readFile(srcGb, 'utf8');
  gbCode = gbCode
    .replace(/from\s+['"]\.\.\/utils\/ids['"]/g, "from './ids.mjs'")
    .replace(/from\s+['"]\.\/maisData['"]/g, "from './maisData.mjs'");
  await fs.writeFile(tmpGb, gbCode, 'utf8');

  return { TMP_DIR, tmpMais, tmpGb };
}

async function importFrontendDataAsEsm() {
  const { tmpMais } = await prepareTmpEsm();
  return importModule(tmpMais);
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

async function exportMaisData() {
  const maisPath = path.join(SRC_DIR, 'data', 'maisData.js');
  const mod = await importFrontendDataAsEsm();
  const { courses, faculty, students, rooms, timetable, equipment } = mod;

  const coursesOut = courses.map(c => ({
    id: c.id || c.code,
    code: c.code,
    nameSk: c.nameSk ?? null,
    nameEn: c.nameEn ?? c.nameSk ?? '',
    completionSk: c.completionSk ?? null,
    credits: Number(c.credits) || 0,
    typeSk: c.typeSk ?? null,
    profile: c.profile ?? null,
    hoursSk: c.hoursSk ?? null,
    periodSk: c.periodSk ?? null,
  }));

  const facultyOut = faculty.map(f => ({
    id: f.id,
    fullName: f.fullName || f.displayName || f.name,
    titlesPrefix: f.titlesPrefix || [],
    titlesSuffix: f.titlesSuffix || [],
    givenName: f.givenName ?? null,
    familyName: f.familyName ?? null,
    faculty: f.faculty || 'FEI',
    departments: Array.isArray(f.departments) ? f.departments : [],
    primaryDepartment: f.primaryDepartment ?? null,
    email: f.email,
    phone: f.phone ?? null,
    office: f.office ?? null,
    status: f.status ?? null,
    employmentType: f.employmentType ?? null,
    classesCount: f.classesCount ?? null,
    yearsExperience: f.yearsExperience ?? null,
    hireDate: f.hireDate ?? null,
    lastActivity: f.lastActivity ?? null,
    rating: typeof f.rating === 'number' ? f.rating : null,
    subjects: Array.isArray(f.subjects) ? f.subjects : [],
    certifications: Array.isArray(f.certifications) ? f.certifications : [],
    officeHours: f.officeHours || {},
    workingHours: f.workingHours || {},
  }));

  const studentsOut = students.map(s => ({
    id: s.id,
    fullName: s.fullName || s.displayName || s.name,
    degree: s.degree ?? null,
    givenName: s.givenName ?? null,
    familyName: s.familyName ?? null,
    email: s.email,
    faculty: s.faculty || 'FEI',
    program: s.program || 'Informatics',
    studyYear: Number(s.studyYear) || 1,
  }));

  const roomsOut = rooms.map(r => ({
    id: r.id || `room:${(r.name || '').toLowerCase()}`,
    name: r.name,
    type: r.type || null,
    capacity: r.capacity ?? null,
    link: r.link ?? null,
    email: r.email ?? null,
  }));

  const timetableOut = (timetable || []).map(t => ({
    day: t.day,
    slot: t.slot,
    courseCode: t.courseCode,
    room: t.room,
    teacherEmail: t.teacherEmail,
    note: t.note ?? null,
  }));

  await ensureDir(DATA_DIR);
  await fs.writeFile(path.join(DATA_DIR, 'courses.json'), JSON.stringify(coursesOut, null, 2), 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'faculty.json'), JSON.stringify(facultyOut, null, 2), 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'students.json'), JSON.stringify(studentsOut, null, 2), 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'rooms.json'), JSON.stringify(roomsOut, null, 2), 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'equipment.json'), JSON.stringify(equipment || [], null, 2), 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'timetable.json'), JSON.stringify(timetableOut, null, 2), 'utf8');
}

async function exportGradebookOneTeacher() {
  // Optional: precompute gradebook for a default teacher (speeds up demo)
  const { tmpGb } = await prepareTmpEsm();
  const { faculty } = await importFrontendDataAsEsm();
  const defaultTeacher = faculty.find(f => f.email && f.email.toLowerCase().includes('marek.horvath')) || faculty[0];
  if (!defaultTeacher) return;

  const { buildGradebookForTeacher } = await importModule(tmpGb);
  const payload = buildGradebookForTeacher(defaultTeacher.email);

  const out = {
    teacherEmail: defaultTeacher.email,
    classes: payload.classes,
    assignments: payload.assignments,
    // flatten map classId->students into array entries
    classStudents: Array.from(payload.classStudents.entries()).map(([classId, students]) => ({ classId, students })),
    grades: Object.entries(payload.grades).map(([key, v]) => {
      const [studentId, assignmentId] = key.split('-');
      return { studentId, assignmentId, ...v };
    }),
  };

  await fs.writeFile(path.join(DATA_DIR, 'gradebook.sample.json'), JSON.stringify(out, null, 2), 'utf8');
}

(async () => {
  try {
    await exportMaisData();
    await exportGradebookOneTeacher();
    console.log(`[seed] Exported JSON to: ${DATA_DIR}`);
  } catch (e) {
    console.error('Seed export failed:', e);
    process.exit(1);
  }
})();
