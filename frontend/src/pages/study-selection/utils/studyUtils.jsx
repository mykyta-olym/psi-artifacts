// src/pages/study-selection/utils/studyUtils.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchMyStudies } from "../../../data/maisApiAdapter";

export const STORAGE_KEY = "study.selected";
export const REMEMBER_KEY = "study.remember";
const STUDY_CACHE_KEY = "mais:selectedStudy";

export const norm = (s = "") => String(s || "").trim();

export const H = (s) => {
    let h = 2166136261 >>> 0;
    const x = String(s || "");
    for (let i = 0; i < x.length; i++) {
        h ^= x.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

export const parseReturn = (search) => {
    const q = new URLSearchParams(search || "");
    const value = q.get("return");
    return value ? value : null;
};

export const degreeOf = (row = {}) => {
    const d = String(row.degree || "").toLowerCase();
    const code = String(row.programCode || "").toLowerCase();
    if (d.includes("ing") || d.includes("mgr") || d.includes("master") || /_ing_/.test(code)) return "Ing.";
    if (d.includes("bc") || d.includes("bachelor") || d.includes("bakal") || /_bc_/.test(code)) return "Ing.";
    return "";
};

const deriveStudentIdFromUid = (uid = "") => {
    const raw = String(uid || "");
    if (!raw.startsWith("std-")) return raw || null;
    const rest = raw.slice(4);
    if (!rest) return null;
    const parts = rest.split("-");
    if (parts.length <= 1) return rest;
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) {
        return parts.slice(0, -1).join("-");
    }
    return rest;
};

export const studentIdOf = (row = {}) => {
    if (!row) return null;
    const direct = row.studentId || row.studentID || row.id;
    if (direct && String(direct).trim()) return String(direct).trim();
    return deriveStudentIdFromUid(row.uid);
};

export const personIdOf = (row = {}) => {
    if (!row) return null;
    const direct = row.personId || row.personID;
    if (direct && String(direct).trim()) return String(direct).trim();
    const sid = studentIdOf(row);
    if (!sid) return null;
    if (sid.includes('-')) {
        return sid.split('-')[0];
    }
    return sid;
};

const persistCache = (study, { persistLocal = true } = {}) => {
    if (typeof window === "undefined") return;
    window.__maisSelectedStudy = study || null;
    // Also persist to sessionStorage for navigation persistence
    try {
        if (study) {
            sessionStorage.setItem(STUDY_CACHE_KEY, JSON.stringify(study));
        } else {
            sessionStorage.removeItem(STUDY_CACHE_KEY);
        }
    } catch (e) {
        // Ignore storage errors
    }
};

export const cacheSelectedStudy = (study, opts) => persistCache(study, opts);
export const clearSelectedStudyCache = () => persistCache(null);
export const loadCachedSelectedStudy = () => {
    if (typeof window === "undefined") return null;
    // First check in-memory cache
    if (window.__maisSelectedStudy) {
        return window.__maisSelectedStudy;
    }
    // Then check sessionStorage
    try {
        const stored = sessionStorage.getItem(STUDY_CACHE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Also restore to in-memory cache
            window.__maisSelectedStudy = parsed;
            return parsed;
        }
    } catch (e) {
        // Ignore parse errors
    }
    return null;
};

const buildStudies = (user, userProfile) => {
    const fromProfile = Array.isArray(userProfile?.studies) ? userProfile.studies : null;
    if (!fromProfile || !fromProfile.length) return [];
        return fromProfile.map((s, idx) => {
        const idSeed = `${s.faculty || ''}|${s.programCode || s.code || ''}|${s.degree || s.level || ''}|${s.year || s.ospYear || 1}|${idx}`;
            const studentId = s.studentId || s.id || null;
            let personId = s.personId || userProfile.personId || '';
            // Витягти personId зі studentId якщо не вказано
            if (!personId && studentId) {
                personId = studentId.includes('-') ? studentId.split('-')[0] : studentId;
            }
            return {
                uid: `std-${H(idSeed)}`,
            programName: s.programName || s.name || '',
            programCode: s.programCode || s.code || '',
            faculty: s.faculty || '',
                ospYear: String(s.year || s.ospYear || 1),
            status: s.status || s.period || '',
            ongoing: /ongoing|prebieha|current/i.test(String(s.status || s.period || '')),
            degree: s.degree || s.level || '',
            studentId,
            personId
            };
        });
};

const normalizeApiStudy = (study, idx = 0) => {
    const programName = study?.programName || study?.program || '';
    const faculty = study?.faculty || '';
    const ospYear = study?.ospYear || String(study?.studyYear || study?.year || '1');
    const degree = study?.degree || study?.level || '';
    const status = study?.status || (study?.ongoing ? "ongoing" : "archived");
    const ongoing = typeof study?.ongoing === "boolean" ? study.ongoing : !/archiv|inactive|completed|graduated|finished/i.test(status);

    const studentId = studentIdOf(study) || deriveStudentIdFromUid(study?.uid) || "";
    let personId = study?.personId || personIdOf(study) || "";
    // Витягти personId зі studentId якщо не вказано
    if (!personId && studentId) {
        personId = studentId.includes('-') ? studentId.split('-')[0] : studentId;
    }

    return {
        uid: study?.uid || `study-${idx}`,
        studentId,
        personId,
        programName,
        programCode: study?.programCode || study?.program || programName,
        faculty,
        ospYear,
        status,
        ongoing,
        degree
    };
};

export const useStudies = (user, userProfile) => {
    const userKey = user?.email || '';
    const studiesSeed = userProfile?.studies || [];
    const studiesSignature = useMemo(
        () => JSON.stringify(studiesSeed),
        [studiesSeed]
    );

    const fallbackStudies = useMemo(
        () => buildStudies(user, userProfile),
        [userKey, studiesSignature]
    );

    const [studies, setStudies] = useState(fallbackStudies);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let ignore = false;
        setError(null);
        setStudies(fallbackStudies);

        const load = async () => {
            if (!userKey) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const apiStudies = await fetchMyStudies();
                if (ignore) return;
                if (Array.isArray(apiStudies) && apiStudies.length) {
                    setStudies(apiStudies.map((study, idx) => normalizeApiStudy(study, idx)));
                } else {
                    setStudies(fallbackStudies);
                }
            } catch (err) {
                if (ignore) return;
                setError(err);
                setStudies(fallbackStudies);
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        load();

        return () => {
            ignore = true;
        };
    }, [userKey, fallbackStudies]);

    return { studies, loading, error };
};