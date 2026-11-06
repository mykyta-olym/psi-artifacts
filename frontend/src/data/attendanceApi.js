import api from '../utils/apiClient';

/**
 * Attendance API - Real attendance data management
 */

/**
 * Get attendance records for a course
 * @param {string} courseCode - Course code
 * @param {Object} options - Optional filters
 * @param {string} options.date - Filter by date (YYYY-MM-DD)
 * @param {string} options.studentId - Filter by student ID
 */
export const getAttendanceByCourse = async (courseCode, options = {}) => {
  const params = new URLSearchParams();
  if (options.date) params.append('date', options.date);
  if (options.studentId) params.append('studentId', options.studentId);
  
  const query = params.toString();
  const url = `/attendance/course/${encodeURIComponent(courseCode)}${query ? `?${query}` : ''}`;
  return api.get(url, { cache: false });
};

/**
 * Get attendance records for a student
 * @param {string} studentId - Student ID
 * @param {Object} options - Optional filters
 * @param {string} options.courseCode - Filter by course code
 */
export const getAttendanceByStudent = async (studentId, options = {}) => {
  const params = new URLSearchParams();
  if (options.courseCode) params.append('courseCode', options.courseCode);
  
  const query = params.toString();
  const url = `/attendance/student/${encodeURIComponent(studentId)}${query ? `?${query}` : ''}`;
  return api.get(url, { cache: false });
};

/**
 * Get attendance statistics for a course
 * @param {string} courseCode - Course code
 */
export const getCourseAttendanceStats = async (courseCode) => {
  return api.get(`/attendance/stats/course/${encodeURIComponent(courseCode)}`, { cache: false });
};

/**
 * Get attendance statistics for a student
 * @param {string} studentId - Student ID
 */
export const getStudentAttendanceStats = async (studentId) => {
  return api.get(`/attendance/stats/student/${encodeURIComponent(studentId)}`, { cache: false });
};

/**
 * Get attendance summary for a teacher
 * @param {string} teacherEmail - Teacher email
 */
export const getTeacherAttendanceSummary = async (teacherEmail) => {
  return api.get(`/attendance/teacher/${encodeURIComponent(teacherEmail)}/summary`, { cache: false });
};

/**
 * Mark attendance for a single student
 * @param {Object} data - Attendance data
 * @param {string} data.courseCode - Course code
 * @param {string} data.studentId - Student ID
 * @param {string} data.date - Session date (YYYY-MM-DD)
 * @param {string} data.status - Status: present, absent, late, excused
 * @param {string} [data.studentEmail] - Student email
 * @param {string} [data.timeSlot] - Time slot
 * @param {string} [data.room] - Room
 * @param {string} [data.notes] - Notes
 * @param {string} [data.classGroupKey] - Class group key
 */
export const markAttendance = async (data) => {
  return api.post('/attendance', data);
};

/**
 * Bulk mark attendance for multiple students
 * @param {Object} data - Bulk attendance data
 * @param {string} data.courseCode - Course code
 * @param {string} data.date - Session date (YYYY-MM-DD)
 * @param {Array} data.students - Array of student attendance items
 * @param {string} [data.timeSlot] - Time slot
 * @param {string} [data.room] - Room
 * @param {string} [data.classGroupKey] - Class group key
 */
export const bulkMarkAttendance = async (data) => {
  return api.post('/attendance/bulk', data);
};

/**
 * Delete an attendance record
 * @param {number} id - Attendance record ID
 */
export const deleteAttendanceRecord = async (id) => {
  return api.delete(`/attendance/${id}`);
};

/**
 * Calculate attendance percentage from records
 * @param {Array} records - Attendance records
 * @returns {number} - Attendance percentage (0-100)
 */
export const calculateAttendanceRate = (records) => {
  if (!records || records.length === 0) return 0;
  
  const present = records.filter(r => r.status === 'present').length;
  const late = records.filter(r => r.status === 'late').length;
  
  return Math.round(((present + late) / records.length) * 100);
};

/**
 * Get status counts from attendance records
 * @param {Array} records - Attendance records
 * @returns {Object} - Status counts
 */
export const getStatusCounts = (records) => {
  if (!records || records.length === 0) {
    return { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
  }
  
  return {
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
    late: records.filter(r => r.status === 'late').length,
    excused: records.filter(r => r.status === 'excused').length,
    total: records.length
  };
};

/**
 * Format attendance status for display
 * @param {string} status - Status string
 * @returns {Object} - Formatted status with label and color
 */
export const formatAttendanceStatus = (status) => {
  const statusMap = {
    present: { label: 'Присутній', labelEn: 'Present', color: 'green', bgClass: 'bg-green-100 text-green-800' },
    absent: { label: 'Відсутній', labelEn: 'Absent', color: 'red', bgClass: 'bg-red-100 text-red-800' },
    late: { label: 'Запізнився', labelEn: 'Late', color: 'yellow', bgClass: 'bg-yellow-100 text-yellow-800' },
    excused: { label: 'Поважна причина', labelEn: 'Excused', color: 'blue', bgClass: 'bg-blue-100 text-blue-800' }
  };
  
  return statusMap[status] || { label: status, labelEn: status, color: 'gray', bgClass: 'bg-gray-100 text-gray-800' };
};

export default {
  getAttendanceByCourse,
  getAttendanceByStudent,
  getCourseAttendanceStats,
  getStudentAttendanceStats,
  getTeacherAttendanceSummary,
  markAttendance,
  bulkMarkAttendance,
  deleteAttendanceRecord,
  calculateAttendanceRate,
  getStatusCounts,
  formatAttendanceStatus
};
