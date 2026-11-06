// src/pages/NotFound.jsx
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import { useAuth } from 'contexts/AuthContext';
import { ToastsProvider, ToastViewport, useToasts } from 'components/ui/Toasts';
import Reveal from 'components/motion/Reveal';
import { ANIMATION_DELAYS } from '../constants/animations';
import useGlobalLoaderBlocking from '../hooks/useGlobalLoaderBlocking';

const KNOWN_PATHS = new Set([
  '/',
  '/login',
  '/forgot-password',
  '/teacher-dashboard',
  '/student-dashboard',
  '/grade-management',
  '/attendance-tracking',
  '/student-management',
  '/class-schedule-management',
  '/activities',
  '/faculty-management',
  '/profile',
  '/chat',
  '/help',
  '/student-studies',
  '/terminy',
  '/zapis',
  '/anketa',
  '/final-thesis',
  '/final-thesis/teacher',
  '/print-reports',
  '/study-select'
]);

const roleHome = (role) => {
  if (role === 'teacher') return '/teacher-dashboard';
  if (role === 'student') return '/student-dashboard';
  return '/login';
};

const NotFoundInner = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();

  const goToLogin = useCallback(async () => {
    await signOut();
    navigate('/login', { replace: true });
  }, [navigate, signOut]);

  const goHome = useCallback(async () => {
    const target = roleHome(user?.role);
    if (!KNOWN_PATHS.has(target)) {
      await goToLogin();
      return;
    }
    navigate(target, { replace: true });
  }, [navigate, user?.role, goToLogin]);

  const goBackSafe = useCallback(async () => {
    const state = window.history.state;
    const canBack = typeof state?.idx === 'number' ? state.idx > 0 : window.history.length > 1;
    
    if (canBack) {
      // Перевіряємо чи попередня сторінка не була login
      const previousPath = document.referrer;
      if (previousPath && (previousPath.includes('/login') || previousPath.includes('/forgot-password'))) {
        // Якщо попередня була login, йдемо на home
        const target = roleHome(user?.role);
        navigate(target, { replace: true });
        return;
      }
      navigate(-1);
      return;
    }
    
    // Якщо не можемо піти назад, йдемо на home
    const target = roleHome(user?.role);
    navigate(target, { replace: true });
  }, [navigate, user?.role]);

  return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Reveal delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true}>
          <div className="text-center max-w-md">
            <Reveal delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="keycap" waitForLoaders={true}>
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <h1 className="text-9xl font-bold text-primary opacity-20">404</h1>
                </div>
              </div>
            </Reveal>
            <Reveal delay={ANIMATION_DELAYS.FILTERS} variant="keycap" waitForLoaders={true}>
              <h2 className="text-2xl font-medium text-onBackground mb-2">Page Not Found</h2>
            </Reveal>
            <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
              <p className="text-onBackground/70 mb-8">The page you're looking for doesn't exist. Let's get you back!</p>
            </Reveal>
            <Reveal delay={ANIMATION_DELAYS.PAGINATION} variant="keycap" waitForLoaders={true}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="primary" icon={<Icon name="ArrowLeft" />} iconPosition="left" onClick={goBackSafe}>Go Back</Button>
                <Button variant="outline" icon={<Icon name="Home" />} iconPosition="left" onClick={goHome}>Back to Home</Button>
              </div>
            </Reveal>
          </div>
        </Reveal>
      </div>
  );
};

const NotFound = () => {
  return (
    <ToastsProvider>
      <NotFoundInner />
      <ToastViewport position="top-right" />
    </ToastsProvider>
  );
};

export default NotFound;