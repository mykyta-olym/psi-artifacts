// src/data/newsApi.js
import api from '../utils/apiClient';

export async function listNews(params = {}) {
  const { published = true, category, page = 1, pageSize = 10 } = params;
  const queryParams = new URLSearchParams();
  if (published != null) queryParams.set('published', String(published));
  if (category) queryParams.set('category', category);
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  const queryString = queryParams.toString();
  return api.get(`/news${queryString ? `?${queryString}` : ''}`);
}

export async function getNewsById(id) {
  return api.get(`/news/${id}`);
}

export async function createNews(data) {
  return api.post('/news', data);
}

export async function updateNews(id, data) {
  return api.put(`/news/${id}`, data);
}

export async function deleteNews(id) {
  return api.del(`/news/${id}`);
}

export async function uploadNewsFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  // Don't set Content-Type header manually - browser will set it with boundary
  return api.post('/news/upload', formData);
}

export async function deleteNewsFile(url) {
  return api.del(`/news/upload?url=${encodeURIComponent(url)}`);
}

export default {
  listNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  uploadNewsFile,
  deleteNewsFile,
};
