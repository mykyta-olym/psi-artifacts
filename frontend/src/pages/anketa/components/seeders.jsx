// src/pages/anketa/parts/seeders.jsx
import { fetchSurveys } from '../../../data/surveysApi';

/**
 * Fetch surveys from backend API
 * @param {Object} params - Query parameters
 * @param {string} [params.category] - Filter by category
 * @param {boolean} [params.includeStats] - Include response statistics
 * @returns {Promise<Array>} List of surveys from backend
 */
export const seedSurveys = async ({ category, includeStats = false } = {}) => {
    try {
        const surveys = await fetchSurveys({ category, includeStats });
        return surveys || [];
    } catch (error) {
        console.error('[seedSurveys] Failed to fetch from backend:', error);
        return [];
    }
};