// src/data/facultyOptionsApi.js
import api from '../utils/apiClient';

export const fetchFacultyOptions = async () => {
  return await api.get('/catalog/faculty-options');
};

export const createFacultyOption = async (data) => {
  return await api.post('/catalog/faculty-options', {
    code: data.code,
    nameEn: data.nameEn,
    nameSk: data.nameSk,
    description: data.description,
    active: data.active ?? true
  });
};

export const updateFacultyOption = async (id, data) => {
  return await api.put(`/catalog/faculty-options/${id}`, {
    code: data.code,
    nameEn: data.nameEn,
    nameSk: data.nameSk,
    description: data.description,
    active: data.active
  });
};

export const deleteFacultyOption = async (id) => {
  return await api.delete(`/catalog/faculty-options/${id}`);
};
