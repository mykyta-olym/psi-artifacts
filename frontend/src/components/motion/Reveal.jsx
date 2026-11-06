// src/components/motion/Reveal.jsx
import React, { useEffect, useRef, useMemo } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { fadeInUp, motionEasing, motionDurations } from '../../utils/motion';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';

const DEFAULT_VARIANT = fadeInUp;

// Standard direction variants
const directionVariants = {
  up: fadeInUp,
  none: {
    hidden: { opacity: 0, filter: 'blur(6px)' },
    visible: { opacity: 1, filter: 'blur(0px)' },
  },
  left: {
    hidden: { opacity: 0, x: -32, filter: 'blur(6px)' },
    visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
  },
  right: {
    hidden: { opacity: 0, x: 32, filter: 'blur(6px)' },
    visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
  },
  down: {
    hidden: { opacity: 0, y: -24, filter: 'blur(6px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
  },
};

// Keycap-style variants (like Login page)
const keycapVariants = {
  hidden: {
    opacity: 0,
    y: -18,
    rotateX: -22,
    scale: 0.98,
    filter: 'blur(2px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    filter: 'blur(0px)',
  },
};

// Pop/bounce variants for cards and interactive elements
const popVariants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 16,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
  },
};

// Slide-scale variants for panels
const slideScaleVariants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 24,
    filter: 'blur(6px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
  },
};

// All available animation types
const allVariants = {
  ...directionVariants,
  keycap: keycapVariants,
  pop: popVariants,
  slideScale: slideScaleVariants,
};

export default function Reveal({
  children,
  as = motion.div,
  delay = 0,
  duration = motionDurations.md,
  once = true,
  amount = 0.2,
  direction = 'up',
  variant, // Alternative way to specify variant type ('keycap', 'pop', 'slideScale', etc.)
  className,
  transition,
  variants,
  waitForLoaders = true,
  stagger = 0, // Stagger delay for lists
  index = 0, // Index for staggered items
  perspective = false, // Enable 3D perspective (for keycap style)
  ...rest
}) {
  const controls = useAnimation();
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount, once });
  const hasPlayedRef = useRef(false);
  const shouldWaitForLoaders = waitForLoaders && !reducedMotion;
  const loaderBlocking = useGlobalLoaderBlocking(shouldWaitForLoaders);

  // Calculate total delay including stagger
  const totalDelay = useMemo(() => {
    return delay + (stagger * index);
  }, [delay, stagger, index]);

  useEffect(() => {
    if (reducedMotion) return;
    if (shouldWaitForLoaders && loaderBlocking) {
      if (!hasPlayedRef.current) {
        controls.set('hidden');
      }
      return;
    }

    if (inView) {
      controls.start('visible');
      hasPlayedRef.current = true;
    }
  }, [controls, inView, loaderBlocking, reducedMotion, shouldWaitForLoaders]);

  const Comp = as;
  
  // Resolve variants: custom > variant prop > direction > default
  const resolvedVariants = useMemo(() => {
    if (variants) return variants;
    if (variant && allVariants[variant]) return allVariants[variant];
    return allVariants[direction] || DEFAULT_VARIANT;
  }, [variants, variant, direction]);

  // Build transition config based on variant type
  const resolvedTransition = useMemo(() => {
    const isKeycap = variant === 'keycap' || variants === keycapVariants;
    const isPop = variant === 'pop' || variants === popVariants;
    
    if (isKeycap) {
      return {
        duration: duration || 0.72,
        ease: [0.22, 1, 0.36, 1],
        delay: totalDelay,
        ...transition,
      };
    }
    
    if (isPop) {
      return {
        type: 'spring',
        stiffness: 300,
        damping: 24,
        delay: totalDelay,
        ...transition,
      };
    }
    
    return {
      duration,
      ease: motionEasing.gentle,
      delay: totalDelay,
      ...transition,
    };
  }, [variant, variants, duration, totalDelay, transition]);

  // Wrapper class for 3D perspective
  const wrapperClass = useMemo(() => {
    const baseClass = className || '';
    if (perspective || variant === 'keycap') {
      return `${baseClass} [perspective:1000px] [transform-style:preserve-3d]`.trim();
    }
    return baseClass;
  }, [className, perspective, variant]);

  if (reducedMotion) {
    return (
      <Comp ref={ref} className={className} {...rest}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      ref={ref}
      className={wrapperClass}
      initial="hidden"
      animate={controls}
      variants={resolvedVariants}
      transition={resolvedTransition}
      style={{
        transformOrigin: variant === 'keycap' ? '50% 120%' : undefined,
        willChange: 'transform, opacity, filter',
        ...rest.style,
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

// Named exports for specific animation types
export function KeycapReveal(props) {
  return <Reveal {...props} variant="keycap" perspective />;
}

export function PopReveal(props) {
  return <Reveal {...props} variant="pop" />;
}

export function SlideScaleReveal(props) {
  return <Reveal {...props} variant="slideScale" />;
}

// Export variants for external use
export { keycapVariants, popVariants, slideScaleVariants, directionVariants };
