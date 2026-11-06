// src/data/equipmentApi.js
import api from '../utils/apiClient';

export const fetchEquipment = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.status) params.append('status', filters.status);
  if (filters.location) params.append('location', filters.location);
  if (filters.search) params.append('search', filters.search);
  if (filters.sort) params.append('sort', filters.sort);
  if (filters.dir) params.append('dir', filters.dir);
  if (filters.page) params.append('page', filters.page);
  if (filters.perPage) params.append('perPage', filters.perPage);
  
  const query = params.toString();
  const response = await api.get(`/equipment${query ? `?${query}` : ''}`);
  console.log('[equipmentApi] Fetch response:', response);
  // Backend returns { Equipment: [...], Total, Page, ... } with capital E
  return response.Equipment || response.equipment || response.data?.Equipment || response.data?.equipment || [];
};

export const getEquipment = async (id) => {
  return await api.get(`/equipment/${encodeURIComponent(id)}`);
};

export const createEquipment = async (data) => {
  return await api.post('/equipment', {
    name: data.name,
    type: data.type,
    status: data.status || 'available',
    location: data.location || null,
    assignedTo: data.assignedTo || null,
    nextBookingStart: data.nextBookingStart || null,
    nextBookingEnd: data.nextBookingEnd || null
  });
};

export const updateEquipment = async (id, data) => {
  const payload = {
    name: data.name,
    type: data.type,
    status: data.status,
    location: data.location || null,
    assignedTo: data.assignedTo || null,
    nextBookingStart: data.nextBookingStart || null,
    nextBookingEnd: data.nextBookingEnd || null
  };
  console.log('[equipmentApi] Updating equipment:', id, 'with payload:', payload);
  return await api.put(`/equipment/${encodeURIComponent(id)}`, payload);
};

export const deleteEquipment = async (id) => {
  return await api.delete(`/equipment/${encodeURIComponent(id)}`);
};

export const bulkDeleteEquipment = async (ids) => {
  return await api.post('/equipment/bulk-delete', ids);
};
