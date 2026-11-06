// src/utils/semesterUtils.js

/**
 * Determines the current semester based on the current date
 * @returns {Object} { semester: 'WS'|'SS', academicYear: 'YYYY/YYYY+1', startDate: Date, endDate: Date }
 */
export function getCurrentSemester() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // Winter semester: September (9) to February (2) of next year
  // Summer semester: March (3) to August (8)
  let semester, academicYear, startDate, endDate;

  if (month >= 9 || month <= 2) {
    // Winter semester
    semester = 'WS';
    if (month >= 9) {
      // September-December: current year / next year
      academicYear = `${year}/${year + 1}`;
      startDate = new Date(year, 8, 1); // September 1
      endDate = new Date(year + 1, 1, 28); // February 28 (or 29)
    } else {
      // January-February: previous year / current year
      academicYear = `${year - 1}/${year}`;
      startDate = new Date(year - 1, 8, 1); // September 1 of previous year
      endDate = new Date(year, 1, 28); // February 28 (or 29)
    }
  } else {
    // Summer semester: March-August
    semester = 'SS';
    academicYear = `${year - 1}/${year}`;
    startDate = new Date(year, 2, 1); // March 1
    endDate = new Date(year, 7, 31); // August 31
  }

  return { semester, academicYear, startDate, endDate };
}

/**
 * Gets the next semester after the current one
 * @returns {Object} { semester: 'WS'|'SS', academicYear: 'YYYY/YYYY+1', startDate: Date, endDate: Date }
 */
export function getNextSemester() {
  const current = getCurrentSemester();
  const { semester, academicYear } = current;
  const [year1, year2] = academicYear.split('/').map(Number);

  let nextSemester, nextAcademicYear, nextStartDate, nextEndDate;

  if (semester === 'WS') {
    // Next term keeps the same cycle but switches to SS
    nextSemester = 'SS';
    nextAcademicYear = academicYear;
    nextStartDate = new Date(year2, 2, 1); // March 1
    nextEndDate = new Date(year2, 7, 31); // August 31
  } else {
    // Otherwise we roll into the following cycle as WS
    nextSemester = 'WS';
    nextAcademicYear = `${year2}/${year2 + 1}`;
    nextStartDate = new Date(year2, 8, 1); // September 1
    nextEndDate = new Date(year2 + 1, 1, 28); // February 28
  }

  return { semester: nextSemester, academicYear: nextAcademicYear, startDate: nextStartDate, endDate: nextEndDate };
}

/**
 * Parses a semester string like "WT 2025/2026" or "ST 2025/2026"
 * @param {string} semesterStr - Semester string (WT/ST format or WS/SS format)
 * @returns {Object|null} { semester: 'WS'|'SS', academicYear: 'YYYY/YYYY+1' } or null
 */
export function parseSemester(semesterStr) {
  if (!semesterStr || typeof semesterStr !== 'string') return null;
  
  const normalized = semesterStr.trim().toUpperCase();
  // Handle both WT/ST and WS/SS formats
  const semesterMatch = normalized.match(/^(WT|ST|WS|SS)\s+(\d{4})\/(\d{4})$/);
  if (!semesterMatch) return null;

  const [, sem, year1, year2] = semesterMatch;
  // Convert WT->WS, ST->SS
  const semester = sem === 'WT' || sem === 'WS' ? 'WS' : 'SS';
  const academicYear = `${year1}/${year2}`;

  return { semester, academicYear };
}

/**
 * Checks if a semester has started
 * @param {string} semesterStr - Semester string like "WT 2025/2026"
 * @returns {boolean} true if the semester has started
 */
export function hasSemesterStarted(semesterStr) {
  const parsed = parseSemester(semesterStr);
  if (!parsed) return false;

  const current = getCurrentSemester();
  const next = getNextSemester();

  // Check if it's the current semester
  if (parsed.semester === current.semester && parsed.academicYear === current.academicYear) {
    return true;
  }

  // Check if it's a past semester
  const currentStart = current.startDate.getTime();
  const parsedStart = getSemesterStartDate(parsed.semester, parsed.academicYear).getTime();
  
  if (parsedStart < currentStart) {
    return true; // Past semester
  }

  // Check if it's the next semester and we're past its start date
  if (parsed.semester === next.semester && parsed.academicYear === next.academicYear) {
    const now = new Date();
    return now >= next.startDate;
  }

  return false;
}

/**
 * Gets the start date of a semester
 * @param {string} semester - 'WS' or 'SS'
 * @param {string} academicYear - 'YYYY/YYYY+1'
 * @returns {Date} Start date of the semester
 */
export function getSemesterStartDate(semester, academicYear) {
  const [year1, year2] = academicYear.split('/').map(Number);
  
  if (semester === 'WS') {
    return new Date(year1, 8, 1); // September 1
  } else {
    return new Date(year2, 2, 1); // March 1
  }
}

/**
 * Gets available semester options (current and next)
 * @returns {Array} Array of { value: string, label: string } objects
 */
export function getAvailableSemesterOptions() {
  const current = getCurrentSemester();
  const next = getNextSemester();

  const formatLabel = (sem, year) => {
    // Use WT/ST format for display
    const displaySem = sem === 'WS' ? 'WT' : 'ST';
    return `${displaySem} ${year}`;
  };

  return [
    { value: `${current.semester === 'WS' ? 'WT' : 'ST'} ${current.academicYear}`, label: formatLabel(current.semester, current.academicYear) },
    { value: `${next.semester === 'WS' ? 'WT' : 'ST'} ${next.academicYear}`, label: formatLabel(next.semester, next.academicYear) },
  ];
}

