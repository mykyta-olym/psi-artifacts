// src/constants/schedulePolicy.js
export const DAYS_KEYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const DAY_LABELS  = { Mon:'Mon', Tue:'Tue', Wed:'Wed', Thu:'Thu', Fri:'Fri', Sat:'Sat', Sun:'Sun' };

// Єдина політика для викладачів (використовується і в модалці, і в OfficeHours)
export const TEACHER_POLICY = {
    MIN: '08:00',
    MAX: '18:00',
    MIN_STEP_MIN: 30,
    MAX_DURATION_MIN: 120,   // ≤ 2 години
    ALLOW_WEEKENDS: false,   // вихідні заблоковано
};