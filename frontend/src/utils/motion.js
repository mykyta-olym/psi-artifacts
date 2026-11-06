// src/utils/motion.js
export const motionEasing = {
  standard: [0.22, 1, 0.36, 1],
  gentle: [0.33, 1, 0.68, 1],
  snap: [0.17, 0.84, 0.44, 1],
};

export const motionDurations = {
  xs: 0.18,
  sm: 0.28,
  md: 0.45,
  lg: 0.7,
};

export const fadeInUp = {
  hidden: {
    opacity: 0,
    y: 24,
    filter: 'blur(6px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
  },
};

export const fadeIn = {
  hidden: {
    opacity: 0,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
  },
};
