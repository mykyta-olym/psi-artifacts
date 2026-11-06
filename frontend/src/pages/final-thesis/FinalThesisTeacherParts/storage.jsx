// src/pages/final-thesis/FinalThesisTeacherParts/storage.jsx
export const LS_T_TOPICS = 'teacher.thesis.topics';
export const LS_T_REQS = 'teacher.thesis.requests';
export const LS_T_SUP = 'teacher.thesis.supervisions';
export const LS_T_PERPAGE = 'teacher.thesis.perPage';

const memoryStore = new Map();

export const readLS = (key, fallback) => {
  if (memoryStore.has(key)) {
    return memoryStore.get(key);
  }
  return fallback;
};

export const writeLS = (key, value) => {
  memoryStore.set(key, value);
};