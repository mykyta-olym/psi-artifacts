// src/data/knowledgeBaseApi.js
import api from '../utils/apiClient';

/**
 * Fetch all knowledge base articles with optional filters
 * @param {string} search - Search query
 * @param {string} category - Category filter (null or 'All' for all categories)
 * @param {string} difficulty - Difficulty filter
 * @param {boolean} publishedOnly - Show only published articles
 * @returns {Promise<Array>} - List of articles
 */
export async function fetchKnowledgeBaseArticles(search = null, category = null, difficulty = null, publishedOnly = true) {
    const params = new URLSearchParams();
    
    if (search) params.append('search', search);
    if (category && category !== 'All') params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    if (publishedOnly !== null) params.append('publishedOnly', publishedOnly);

    const queryString = params.toString();
    const url = `/knowledge-base/articles${queryString ? `?${queryString}` : ''}`;
    
    return await api.get(url);
}

/**
 * Fetch a single knowledge base article by ID
 * @param {string} id - Article ID
 * @returns {Promise<Object>} - Article details
 */
export async function fetchKnowledgeBaseArticle(id) {
    return await api.get(`/knowledge-base/articles/${id}`);
}

/**
 * Fetch all available categories
 * @returns {Promise<Array<string>>} - List of category names
 */
export async function fetchKnowledgeBaseCategories() {
    return await api.get('/knowledge-base/categories');
}

/**
 * Fetch all available tags
 * @returns {Promise<Array<string>>} - List of tag names
 */
export async function fetchKnowledgeBaseTags() {
    return await api.get('/knowledge-base/tags');
}

/**
 * Create a new knowledge base article
 * @param {Object} articleData - Article data
 * @param {string} articleData.title - Article title
 * @param {string} articleData.content - Article content (markdown)
 * @param {string} articleData.category - Category
 * @param {string[]} articleData.tags - Array of tags
 * @param {string} articleData.difficulty - Difficulty level (Beginner, Intermediate, Advanced)
 * @param {boolean} articleData.isPublished - Whether to publish immediately
 * @returns {Promise<Object>} - Created article
 */
export async function createKnowledgeBaseArticle(articleData) {
    return await api.post('/knowledge-base/articles', articleData);
}

/**
 * Update an existing knowledge base article
 * @param {string} id - Article ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated article
 */
export async function updateKnowledgeBaseArticle(id, updates) {
    return await api.put(`/knowledge-base/articles/${id}`, updates);
}

/**
 * Delete a knowledge base article
 * @param {string} id - Article ID
 * @returns {Promise<void>}
 */
export async function deleteKnowledgeBaseArticle(id) {
    return await api.delete(`/knowledge-base/articles/${id}`);
}

/**
 * Submit feedback (helpful/not helpful) for an article
 * @param {string} id - Article ID
 * @param {boolean} isHelpful - Whether the article was helpful
 * @returns {Promise<Object>} - Updated feedback counts
 */
export async function submitArticleFeedback(id, isHelpful) {
    return await api.post(`/knowledge-base/articles/${id}/feedback`, { isHelpful });
}

/**
 * Get knowledge base statistics
 * @returns {Promise<Object>} - Statistics object
 */
export async function fetchKnowledgeBaseStats() {
    return await api.get('/knowledge-base/stats');
}
