/**
 * @file surveysApi.js
 * @description API client for Survey/Anketa endpoints
 */

import api from '../utils/apiClient';

const SURVEYS_URL = '/surveys';

/**
 * Get authorization headers for API requests
 */
function getAuthHeaders() {
  const token = api.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch all surveys (filtered by role and published status)
 * @param {Object} params - Query parameters
 * @param {string} [params.category] - Filter by category (course, teacher, service, general)
 * @param {boolean} [params.includeStats] - Include response statistics
 * @returns {Promise<Array>} List of surveys
 */
export async function fetchSurveys({ category, includeStats } = {}) {
  const queryParams = new URLSearchParams();
  if (category) queryParams.append('category', category);
  if (includeStats !== undefined) queryParams.append('includeStats', includeStats);

  const url = queryParams.toString() ? `${SURVEYS_URL}?${queryParams}` : SURVEYS_URL;
  const response = await api.get(url);
  return Array.isArray(response) ? response : [];
}

/**
 * Fetch a single survey by ID
 * @param {string} id - Survey ID
 * @param {boolean} [includeStats=false] - Include response statistics
 * @returns {Promise<Object>} Survey details
 */
export async function fetchSurvey(id, includeStats = false) {
  const url = includeStats ? `${SURVEYS_URL}/${id}?includeStats=true` : `${SURVEYS_URL}/${id}`;
  return await api.get(url);
}

/**
 * Create a new survey (teachers only)
 * @param {Object} surveyData - Survey creation request
 * @param {string} surveyData.title - Survey title
 * @param {string} surveyData.category - Survey category
 * @param {boolean} [surveyData.isAnonymous] - Whether survey is anonymous
 * @param {Array} surveyData.questions - Survey questions
 * @param {Object} [surveyData.meta] - Metadata (courseCode, teacher, etc.)
 * @param {string} [surveyData.openAt] - ISO date when survey opens
 * @param {string} [surveyData.closeAt] - ISO date when survey closes
 * @param {boolean} [surveyData.published] - Whether survey is published
 * @param {string} [surveyData.targetAudience] - Target audience (students, teachers)
 * @param {string} [surveyData.targetFaculty] - Target faculty
 * @param {string} [surveyData.targetProgram] - Target program
 * @param {Array<string>} [surveyData.targetStudents] - Specific student emails (if set, only these students see the survey)
 * @param {string} [surveyData.targetGroupId] - Specific class group ID (if set, only students in this group see the survey)
 * @returns {Promise<Object>} Created survey
 */
export async function createSurvey(surveyData) {
  return await api.post(SURVEYS_URL, surveyData);
}

/**
 * Update an existing survey (owner only)
 * @param {string} id - Survey ID
 * @param {Object} surveyData - Survey update request
 * @returns {Promise<Object>} Updated survey
 */
export async function updateSurvey(id, surveyData) {
  return await api.put(`${SURVEYS_URL}/${id}`, surveyData);
}

/**
 * Delete a survey (owner only, deletes all responses)
 * @param {string} id - Survey ID
 * @returns {Promise<void>}
 */
export async function deleteSurvey(id) {
  return await api.delete(`${SURVEYS_URL}/${id}`);
}

/**
 * Submit a response to a survey
 * @param {string} id - Survey ID
 * @param {Object} answers - Question ID to answer mapping
 * @returns {Promise<Object>} Created response
 */
export async function submitSurveyResponse(id, answers) {
  return await api.post(`${SURVEYS_URL}/${id}/respond`, { answers });
}

/**
 * Fetch all responses for a survey (owner only)
 * @param {string} id - Survey ID
 * @returns {Promise<Array>} List of survey responses
 */
export async function fetchSurveyResponses(id) {
  return await api.get(`${SURVEYS_URL}/${id}/responses`);
}

/**
 * Fetch aggregated analytics for a survey (owner only)
 * @param {string} id - Survey ID
 * @returns {Promise<Object>} Survey analytics with question statistics
 */
export async function fetchSurveyAnalytics(id) {
  return await api.get(`${SURVEYS_URL}/${id}/analytics`);
}

/**
 * Get students list for survey targeting (teachers only)
 * @param {Object} filters - Filter parameters
 * @param {string} [filters.faculty] - Filter by faculty
 * @param {string} [filters.program] - Filter by program
 * @param {string} [filters.courseCode] - Filter by course enrollment
 * @param {string} [filters.groupId] - Filter by specific class group
 * @param {boolean} [filters.myGroupsOnly] - Show only students from teacher's groups
 * @returns {Promise<Object>} Object with students array and count
 */
export async function fetchStudentsForTargeting(filters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.faculty) queryParams.append('faculty', filters.faculty);
  if (filters.program) queryParams.append('program', filters.program);
  if (filters.courseCode) queryParams.append('courseCode', filters.courseCode);
  if (filters.groupId) queryParams.append('groupId', filters.groupId);
  if (filters.myGroupsOnly) queryParams.append('myGroupsOnly', 'true');

  const url = queryParams.toString() 
    ? `${SURVEYS_URL}/students?${queryParams}` 
    : `${SURVEYS_URL}/students`;
  
  return await api.get(url);
}

/**
 * Get available filters for student targeting (teachers only)
 * Returns faculties, programs, courses, and groups accessible to the teacher
 * @returns {Promise<Object>} Available filters (faculties, programs, courses, groups)
 */
export async function fetchStudentFilters() {
  return await api.get(`${SURVEYS_URL}/students/filters`);
}
