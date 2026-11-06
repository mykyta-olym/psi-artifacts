// src/pages/final-thesis/FinalThesisTeacherParts/seeders.jsx
import { readLS, writeLS, LS_T_TOPICS, LS_T_REQS, LS_T_SUP } from './storage';
import { slug, nowIso } from '../utils/utils';

export const seedTeacher = (maisId, user) => {
    const fullName = user?.full_name || user?.name || 'Teacher';
    const email = user?.email || '';
    return { id: maisId('t', email), name: fullName, email, department: user?.department || '' };
};

export const seedPrograms = () => [];

export const seedTopicPool = (maisId, teacher) => {
    const base = readLS(LS_T_TOPICS, null);
    if (base) return base;
    const arr = [];
    writeLS(LS_T_TOPICS, arr);
    return arr;
};

export const seedStudents = async () => {
    return [];
};

export const seedIncomingRequests = (maisId, teacher) => {
    const existing = readLS(LS_T_REQS, null);
    if (existing) return existing;
    const arr = [];
    writeLS(LS_T_REQS, arr);
    return arr;
};

export const seedSupervisions = () => {
    const existing = readLS(LS_T_SUP, null);
    if (existing) return existing;
    const arr = [];
    writeLS(LS_T_SUP, arr);
    return arr;
};