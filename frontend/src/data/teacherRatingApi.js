// src/data/teacherRatingApi.js
import api from '../utils/apiClient';

/**
 * Submit or update rating for a teacher
 * @param {string} teacherId - Teacher ID
 * @param {Object} ratingData - Rating data
 * @param {string} ratingData.studentId - Student ID
 * @param {number} ratingData.rating - Overall rating (1-5)
 * @param {string} [ratingData.comment] - Optional comment
 * @param {string} [ratingData.courseCode] - Optional course code
 * @param {number} [ratingData.teachingQuality] - Teaching quality rating (1-5)
 * @param {number} [ratingData.communication] - Communication rating (1-5)
 * @param {number} [ratingData.responsiveness] - Responsiveness rating (1-5)
 * @param {number} [ratingData.courseContent] - Course content rating (1-5)
 * @param {number} [ratingData.fairness] - Fairness rating (1-5)
 */
export async function rateTeacher(teacherId, ratingData) {
    return await api.post(`/faculty/${teacherId}/rating`, ratingData);
}

/**
 * Get student's rating for a teacher
 * @param {string} teacherId - Teacher ID
 * @param {string} studentId - Student ID
 * @param {string} [courseCode] - Optional course code
 */
export async function getStudentRating(teacherId, studentId, courseCode = null) {
    const params = courseCode ? { courseCode } : {};
    return await api.get(`/faculty/${teacherId}/rating/student/${studentId}`, { params });
}

/**
 * Get all ratings for a teacher
 * @param {string} teacherId - Teacher ID
 */
export async function getTeacherRatings(teacherId) {
    return await api.get(`/faculty/${teacherId}/ratings`);
}

/**
 * Delete a rating
 * @param {string} ratingId - Rating ID
 */
export async function deleteRating(ratingId) {
    return await api.delete(`/ratings/${ratingId}`);
}
