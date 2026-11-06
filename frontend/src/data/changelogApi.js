import apiClient from '../utils/apiClient';

/**
 * Fetch all changelog entries
 * @returns {Promise<Array>} List of changelog entries
 */
export const fetchChangelog = async () => {
    return await apiClient.get('/changelog');
};

/**
 * Fetch a single changelog entry
 * @param {string} id - Entry ID
 * @returns {Promise<Object>} Changelog entry
 */
export const getChangelogEntry = async (id) => {
    return await apiClient.get(`/changelog/${id}`);
};

/**
 * Create a new changelog entry (teachers only)
 * @param {Object} entry - Entry data { version, date, title, points }
 * @returns {Promise<Object>} Created entry
 */
export const createChangelogEntry = async (entry) => {
    return await apiClient.post('/changelog', entry);
};

/**
 * Update an existing changelog entry (teachers only)
 * @param {string} id - Entry ID
 * @param {Object} entry - Updated entry data
 * @returns {Promise<Object>} Updated entry
 */
export const updateChangelogEntry = async (id, entry) => {
    return await apiClient.put(`/changelog/${id}`, entry);
};

/**
 * Delete a changelog entry (teachers only)
 * @param {string} id - Entry ID
 * @returns {Promise<void>}
 */
export const deleteChangelogEntry = async (id) => {
    await apiClient.delete(`/changelog/${id}`);
};
