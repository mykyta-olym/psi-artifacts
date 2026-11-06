// src/data/departmentsApi.js
import api from '../utils/apiClient';

export const fetchDepartments = async () => {
  return await api.get('/catalog/departments');
};

export const createDepartment = async (data) => {
  return await api.post('/catalog/departments', {
    name: data.name,
    code: data.code,
    faculty: data.faculty,
    active: data.active ?? true
  });
};

export const updateDepartment = async (id, data) => {
  return await api.put(`/catalog/departments/${id}`, {
    name: data.name,
    code: data.code,
    faculty: data.faculty,
    active: data.active
  });
};

export const deleteDepartment = async (id) => {
  return await api.delete(`/catalog/departments/${id}`);
};
