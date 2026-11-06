// src/data/userApi.js
import api from '../utils/apiClient';

/**
 * Change user password
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
export async function changePassword(currentPassword, newPassword) {
  const response = await api.post('/users/change-password', {
    currentPassword,
    newPassword,
  });
  return response;
}

/**
 * Get password status for current user
 * @returns {Promise<{shouldChangePassword: boolean, lastPasswordChange: string|null, isActivated: boolean}>}
 */
export async function getPasswordStatus() {
  const response = await api.get('/users/password-status');
  return response;
}

/**
 * Get temporary password for a newly created user (teachers only)
 * @param {string} email - User email address
 * @returns {Promise<{email: string, role: string, fullName: string|null, temporaryPassword: string, createdAt: string, message: string}>}
 */
export async function getTemporaryPassword(email) {
  const response = await api.get(`/users/${encodeURIComponent(email)}/temporary-password`);
  return response;
}
