import { fetchCourses, fetchFaculty, fetchRooms, fetchEquipment, fetchStudents, fetchScheduleEvents, fetchTeacherTimetable } from './maisApiAdapter';

const createCachedLoader = (loader) => {
  let cache = null;
  let promise = null;
  return async (options = {}) => {
    const { force = false } = options;
    if (!force && cache) return cache;
    if (!promise) {
      promise = loader(options).then((result) => {
        cache = result;
        promise = null;
        return cache;
      }).catch((error) => {
        promise = null;
        throw error;
      });
    }
    return promise;
  };
};

const createKeyedLoader = (loader) => {
  const cache = new Map();
  return async (params = {}, options = {}) => {
    const key = JSON.stringify(params || {});
    if (options.force) cache.delete(key);
    if (cache.has(key)) {
      const entry = cache.get(key);
      if (entry.data && !options.force) return entry.data;
      if (entry.promise) return entry.promise;
    }
    const entry = { data: null, promise: null };
    const promise = loader(params, options).then((res) => {
      entry.data = res;
      entry.promise = null;
      cache.set(key, entry);
      return res;
    }).catch((error) => {
      cache.delete(key);
      throw error;
    });
    entry.promise = promise;
    cache.set(key, entry);
    return promise;
  };
};

const loadCourses = createCachedLoader(async () => {
  const list = await fetchCourses();
  return Array.isArray(list?.items) ? list.items : (Array.isArray(list) ? list : []);
});

const loadFaculty = createCachedLoader(async () => {
  const list = await fetchFaculty({ page: 1, pageSize: 500, sort: 'fullName', order: 'asc' });
  return Array.isArray(list?.items) ? list.items : (Array.isArray(list) ? list : []);
});

const loadRooms = createCachedLoader(async () => {
  const list = await fetchRooms();
  return Array.isArray(list) ? list : [];
});

const loadEquipment = createCachedLoader(async () => {
  const list = await fetchEquipment();
  return Array.isArray(list) ? list : [];
});

const loadStudents = createKeyedLoader(async (params) => {
  const list = await fetchStudents(params);
  return Array.isArray(list?.items) ? list.items : (Array.isArray(list) ? list : []);
});

const loadScheduleEvents = createKeyedLoader(async (params) => {
  const list = await fetchScheduleEvents(params);
  return Array.isArray(list) ? list : [];
});

const loadTeacherTimetable = createKeyedLoader(async (params) => {
  const email = params?.email || params?.teacherEmail;
  if (!email) return [];
  const list = await fetchTeacherTimetable(email, { ttl: params.ttl });
  return Array.isArray(list) ? list : [];
});

export const resourceCache = {
  getCourses: (options) => loadCourses(options),
  refreshCourses: () => loadCourses({ force: true }),

  getFaculty: (options) => loadFaculty(options),
  refreshFaculty: () => loadFaculty({ force: true }),

  getRooms: (options) => loadRooms(options),
  refreshRooms: () => loadRooms({ force: true }),

  getEquipment: (options) => loadEquipment(options),
  refreshEquipment: () => loadEquipment({ force: true }),

  getStudents: (params = {}, options = {}) => loadStudents(params, options),
  getScheduleEvents: (params = {}, options = {}) => loadScheduleEvents(params, options),
  getTeacherTimetable: (params = {}, options = {}) => loadTeacherTimetable(params, options),
};
