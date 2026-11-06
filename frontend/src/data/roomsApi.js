// src/data/roomsApi.js
import api from '../utils/apiClient';

export const fetchRooms = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.search) params.append('search', filters.search);
  if (filters.minCapacity) params.append('minCapacity', filters.minCapacity);
  if (filters.maxCapacity) params.append('maxCapacity', filters.maxCapacity);
  if (filters.active !== undefined) params.append('active', filters.active);
  if (filters.building) params.append('building', filters.building);
  if (filters.sort) params.append('sort', filters.sort);
  if (filters.dir) params.append('dir', filters.dir);
  if (filters.page) params.append('page', filters.page);
  if (filters.perPage) params.append('perPage', filters.perPage);
  
  const query = params.toString();
  const response = await api.get(`/rooms${query ? `?${query}` : ''}`);
  console.log('[roomsApi] Fetch response:', response);
  // Backend returns { Rooms: [...], Total, Page, ... } with capital R
  return response.Rooms || response.rooms || response.data?.Rooms || response.data?.rooms || [];
};

export const getRoom = async (id) => {
  return await api.get(`/rooms/${encodeURIComponent(id)}`);
};

export const createRoom = async (data) => {
  return await api.post('/rooms', {
    name: data.name,
    type: data.type,
    capacity: data.capacity,
    link: data.link,
    email: data.email,
    location: data.location,
    building: data.building,
    floor: data.floor,
    description: data.description,
    active: data.active ?? true
  });
};

export const updateRoom = async (id, data) => {
  return await api.put(`/rooms/${encodeURIComponent(id)}`, {
    name: data.name,
    type: data.type,
    capacity: data.capacity,
    link: data.link,
    email: data.email,
    location: data.location,
    building: data.building,
    floor: data.floor,
    description: data.description,
    active: data.active
  });
};

export const deleteRoom = async (id) => {
  return await api.delete(`/rooms/${encodeURIComponent(id)}`);
};

export const bulkDeleteRooms = async (ids) => {
  return await api.post('/rooms/bulk-delete', ids);
};
