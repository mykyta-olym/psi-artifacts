const fs = require('fs');
const path = require('path');

const FACULTY_FILE = path.resolve(__dirname, '../data/seed/faculty.json');
const COURSES_FILE = path.resolve(__dirname, '../data/seed/courses.json');

const faculty = JSON.parse(fs.readFileSync(FACULTY_FILE, 'utf8'));
const courses = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));

const departmentsFallback = [
  'Katedra počítačov a informatiky (FEI)',
  'Katedra elektroenergetiky (FEI)',
  'Katedra telekomunikácií (FEI)',
  'Katedra multimédií (FEI)',
];

const statusPool = ['active', 'active', 'active', 'on-leave', 'inactive'];
const employmentTypes = ['full-time', 'full-time', 'part-time'];

function hash(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, seed, salt = '') {
  if (!arr.length) return null;
  const idx = Math.abs(hash(`${seed}|${salt}`)) % arr.length;
  return arr[idx];
}

const subjectLabels = courses.map((c) => ({
  code: c.code,
  label: `${c.code} - ${c.nameEn || c.nameSk || c.code}`,
}));

const updated = faculty.map((f, idx) => {
  const seed = `${f.email || ''}|${f.id || ''}|${idx}`;

  const deptList = Array.isArray(f.departments) && f.departments.length ? f.departments : [];
  if (!deptList.length) {
    const base = pick(departmentsFallback, seed, 'dept');
    if (base) deptList.push(base);
  }
  const primaryDepartment = f.primaryDepartment || deptList[0] || pick(departmentsFallback, seed, 'primary');

  const subjects = (() => {
    const set = new Set();
    const picks = [];
    const desired = Math.max(2, Math.min(4, (hash(`${seed}|subjects`) % 4) + 2));
    let i = 0;
    while (picks.length < desired && i < subjectLabels.length * 2) {
      const s = pick(subjectLabels, seed, `sub-${i}`);
      if (s && !set.has(s.code)) {
        set.add(s.code);
        picks.push(s.label);
      }
      i += 1;
    }
    return picks;
  })();

  const status = f.status || pick(statusPool, seed, 'status') || 'active';
  const employmentType = f.employmentType || pick(employmentTypes, seed, 'employment') || 'full-time';
  const classesCount = Number.isFinite(f.classesCount) ? f.classesCount : ((hash(`${seed}|classes`) % 6) + 2);
  const yearsExperience = Number.isFinite(f.yearsExperience) ? f.yearsExperience : ((hash(`${seed}|years`) % 20) + 3);
  const hireDate = f.hireDate || new Date(Date.UTC(2006 + (hash(`${seed}|hire`) % 10), hash(`${seed}|hireM`) % 12, (hash(`${seed}|hireD`) % 28) + 1)).toISOString();
  const lastActivity = f.lastActivity || new Date(Date.UTC(2025, hash(`${seed}|lastM`) % 12, (hash(`${seed}|lastD`) % 28) + 1, hash(`${seed}|lastH`) % 24, hash(`${seed}|lastMin`) % 60)).toISOString();
  const phone = f.phone || `+421 55 ${String(200 + (hash(`${seed}|phone`) % 700)).padStart(3, '0')} ${String(100 + (hash(`${seed}|phone2`) % 900)).padStart(3, '0')}`;
  const office = f.office || `Room L9-${String(100 + (hash(`${seed}|office`) % 400))}`;
  const rating = Number.isFinite(f.rating) ? f.rating : Math.round(((hash(`${seed}|rating`) % 20) / 10 + 3.5) * 10) / 10;

  return {
    ...f,
    departments: deptList,
    primaryDepartment,
    subjects: subjects.length ? subjects : f.subjects || [],
    status,
    employmentType,
    classesCount,
    yearsExperience,
    hireDate,
    lastActivity,
    phone,
    office,
    rating,
  };
});

fs.writeFileSync(FACULTY_FILE, JSON.stringify(updated, null, 2) + '\n');
console.log(`[enrich-faculty] Updated ${updated.length} faculty entries at ${FACULTY_FILE}`);

