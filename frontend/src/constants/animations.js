// src/constants/animations.js
// Стандартизовані delay values для анімацій по всьому додатку
// Використовувати ці константи для консистентності анімацій між сторінками

export const ANIMATION_DELAYS = {
  // Основні секції (keycap-style cascade)
  HERO: 0.08,           // Перша секція (заголовок, welcome)
  SUBTITLE: 0.12,       // Субтитри, опис
  SUMMARY_CARDS: 0.16,  // Summary/metric карточки
  FILTERS: 0.20,        // Фільтри/Header панелі
  SIDEBAR_PANEL: 0.24,  // Sidebar Quick Action панель
  
  // Контент
  MAIN_CONTENT: 0.28,   // Основна таблиця/контент
  TABS: 0.22,           // Tab панелі
  PAGINATION: 0.32,     // Pagination елементи
  
  // Додаткові елементи
  ACTIVITY: 0.34,       // Activity feed, recent activities
  EXTRA_1: 0.30,        // Додаткові секції
  EXTRA_2: 0.36,        // Ще більш віддалені елементи
  
  // Keycap-style stagger intervals (90ms like Login page)
  STEP: 0.09,           // Standard stagger step between items
  FAST_STEP: 0.06,      // Faster stagger for dense lists
  SLOW_STEP: 0.12,      // Slower stagger for important items
};

// Стандартні налаштування для Reveal компонента
export const DEFAULT_REVEAL_PROPS = {
  waitForLoaders: true,  // Завжди чекати на завершення лоадерів
  once: true,            // Анімація тільки один раз
  amount: 0.2,           // Поріг видимості
};

// Варіанти анімації для різних напрямків
export const ANIMATION_DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  NONE: 'none',
};

// Варіанти стилю анімації
export const ANIMATION_VARIANTS = {
  KEYCAP: 'keycap',     // 3D keycap style (like Login page)
  POP: 'pop',           // Pop/bounce effect for cards
  SLIDE_SCALE: 'slideScale', // Slide + scale effect
  UP: 'up',             // Standard fade up
  LEFT: 'left',
  RIGHT: 'right',
  DOWN: 'down',
  NONE: 'none',         // Just fade
};

// Duration presets
export const ANIMATION_DURATIONS = {
  FAST: 0.35,
  NORMAL: 0.45,
  SLOW: 0.65,
  KEYCAP: 0.72,         // Standard keycap duration
};
