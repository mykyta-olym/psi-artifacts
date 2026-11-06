// src/pages/Login.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from 'contexts/AuthContext';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import { Checkbox } from 'components/ui/Checkbox';
import Icon from 'components/AppIcon';
import SiteHeader from 'components/ui/SiteHeader';
import SiteFooter from 'components/ui/SiteFooter';
import { ToastsProvider, ToastViewport, useToasts } from 'components/ui/Toasts';
import { hasSemesterStarted } from 'utils/semesterUtils';
import api from 'utils/apiClient';
import { isValidEmail, sanitizeString, RateLimiter } from 'utils/security';
import { createLogger } from 'utils/logger';

const logger = createLogger('Login');
const loginRateLimiter = new RateLimiter(5, 60000); // 5 attempts per minute

const SUPPORT_EMAIL = 'support@mais.tuke.sk';

const KEYCAP_CSS = `
.keycap-scene { perspective: 1000px; transform-style: preserve-3d; }
@keyframes keycap-in {
  0%   { opacity: 0; transform: translate3d(0,-18px,0) rotateX(-22deg) scale(.98); filter: blur(2px); }
  40%  { opacity: 1; transform: translate3d(0,  3px,0) rotateX(  6deg) scale(1.02); filter: blur(.5px); }
  68%  {           transform: translate3d(0, -2px,0) rotateX( -4deg) scale(1.00); }
  100% { opacity: 1; transform: translate3d(0,  0px,0) rotateX(  0deg) scale(1.00); filter: blur(0); }
}
.keycap-in { opacity: 0; transform-origin: 50% 120%; animation-name: keycap-in; animation-fill-mode: both; will-change: transform, opacity, filter; }
@media (prefers-reduced-motion: reduce) {
  .keycap-in { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
}
.keycap-pressable { transition: transform .25s ease, box-shadow .25s ease; transform-style: preserve-3d; }
.keycap-pressable:hover { transform: translateZ(0) translateY(-2px); }
.glass-edge { box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 20px 60px rgba(2,132,199,.12), 0 8px 24px rgba(0,0,0,.35); }
`;

const cx = (...a) => a.filter(Boolean).join(' ');

const Kcap = ({ delay = 0, dur = 720, className = '', children, style }) => (
    <div className={cx('keycap-in', className)} style={{ animationDelay: `${delay}ms`, animationDuration: `${dur}ms`, ...style }}>
      {children}
    </div>
);

const LoginInner = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToasts();
  const toastLocksRef = useRef({});
  const guardedNotify = useCallback((key, type, message, opts = {}) => {
    if (key) {
      const now = Date.now();
      const lock = opts.lockMs ?? 2600;
      const prev = toastLocksRef.current[key] ?? 0;
      if (now - prev < lock) return;
      toastLocksRef.current[key] = now;
    }
    notify(type, message, opts);
  }, [notify]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);

  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState(false);

  useEffect(() => {
    if (!document.getElementById('keycap-anim-styles')) {
      const s = document.createElement('style');
      s.id = 'keycap-anim-styles';
      s.textContent = KEYCAP_CSS;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 16);
    return () => clearTimeout(t);
  }, []);

  const demoTeacher = useMemo(() => ({ email: 'marek.horvath@university.edu', password: 'teacher123' }), []);
  const demoStudent = useMemo(() => ({ email: 'kyrylo.bulyk@student.university.edu', password: 'student123' }), []);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');
    
    // Validate email format
    if (!isValidEmail(email)) {
      const errMsg = 'Please enter a valid email address';
      setError(errMsg);
      guardedNotify('login-error', 'error', errMsg, { title: 'Invalid Input', lockMs: 3000 });
      return;
    }
    
    // Sanitize inputs
    const sanitizedEmail = sanitizeString(email.trim(), 100);
    const sanitizedPassword = sanitizeString(password, 100);
    
    // Check rate limiting
    if (!loginRateLimiter.isAllowed()) {
      const errMsg = 'Too many login attempts. Please wait a minute before trying again.';
      setError(errMsg);
      guardedNotify('login-rate-limit', 'error', errMsg, { title: 'Rate Limit Exceeded', lockMs: 5000 });
      logger.warn('Rate limit exceeded for email:', sanitizedEmail);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error: err } = await signIn({ email: sanitizedEmail, password: sanitizedPassword, remember });
      if (err) {
        setError(err);
        guardedNotify('login-error', 'error', err, { title: 'Login failed', lockMs: 3000 });
        logger.debug('Login failed for:', sanitizedEmail);
      } else {
        logger.info('Login successful for:', sanitizedEmail);
        // Check if student's semester has started
        if (data?.user?.role === 'student') {
          try {
            const me = await api.get('/me', { cache: false });
            const studentData = me?.student || me;
            const enrollmentSemester = studentData?.enrollmentSemester || studentData?.gradeKey;
            
            if (enrollmentSemester && !hasSemesterStarted(enrollmentSemester)) {
              const parsed = enrollmentSemester.match(/^(WT|ST|WS|SS)\s+(\d{4}\/\d{4})/);
              const semesterName = parsed ? parsed[1] : enrollmentSemester;
              const academicYear = parsed ? parsed[2] : '';
              const msg = `Your enrollment semester (${semesterName} ${academicYear}) has not started yet. Access will be available when the semester begins.`;
              setError(msg);
              guardedNotify('login-semester-not-started', 'warning', msg, { title: 'Access Restricted', lockMs: 5000 });
              logger.info('Semester not started for student:', sanitizedEmail);
              // Clear tokens and sign out
              api.clearTokens();
              setLoading(false);
              return;
            }
          } catch (profileErr) {
            // If we can't fetch profile, allow login but log the error
            logger.warn('Could not verify semester access:', profileErr);
          }
        }
        
        guardedNotify('login-success', 'success', 'Welcome back!', { title: 'Login successful', force: true, lockMs: 2000 });
        const dest = data?.user?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard';
        setTimeout(() => navigate(dest), 500);
      }
    } catch {
      const msg = 'An unexpected error occurred. Please try again.';
      setError(msg);
      guardedNotify('login-error', 'error', msg, { title: 'Login failed', lockMs: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const doDemo = async ({ email: em, password: pw }) => {
    setEmail(em);
    setPassword(pw);
    setError('');
    setLoading(true);
    try {
      const { data, error: err } = await signIn({ email: em, password: pw, remember: true });
      if (err) {
        setError(err);
        guardedNotify('demo-login-error', 'error', err, { title: 'Demo login failed', lockMs: 3000 });
      } else {
        guardedNotify('demo-login-success', 'success', 'Welcome!', { title: 'Demo login successful', force: true, lockMs: 2000 });
        const dest = data?.user?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard';
        setTimeout(() => navigate(dest), 500);
      }
    } catch {
      const msg = 'Demo login failed. Please try again.';
      setError(msg);
      guardedNotify('demo-login-error', 'error', msg, { title: 'Demo login failed', lockMs: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const onPwdKeyEvent = (e) => {
    try { setCaps(!!e.getModifierState && e.getModifierState('CapsLock')); } catch {}
  };

  const STEP = 90;

  return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute inset-x-0 -top-1/3 h-2/3 bg-gradient-to-b from-sky-500/14 via-transparent to-transparent blur-2xl" />
          <div className="absolute inset-x-0 -bottom-1/3 h-2/3 bg-gradient-to-t from-indigo-500/16 via-transparent to-transparent blur-2xl" />
          <div className="absolute inset-0 [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        <div className="relative z-[2] flex min-h-screen flex-col">
          <SiteHeader mode="login" />

          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:py-8 keycap-scene">
            <div className={cx('mx-auto mb-6 max-w-2xl text-center', mounted ? '' : 'opacity-0')}>
              <Kcap delay={STEP} dur={760}>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  Welcome back<span className="text-white/60"> — sign in to continue</span>
                </h1>
              </Kcap>
              <Kcap delay={2*STEP} dur={720}>
                <p className="mt-2 text-sm text-white/70">
                  Secure access to MAIS. Fast, accessible, and designed for university workflows.
                </p>
              </Kcap>
            </div>

            {/* TUKE Info Banner */}
            <Kcap delay={3*STEP} dur={740}>
              <div className="mx-auto mb-6 max-w-4xl">
                <div className="flex items-center justify-center gap-2 text-[11px] text-white/50">
                  <Icon name="GraduationCap" size={14} className="text-white/40" />
                  <span>Technical University of Košice • Vysokoškolská 4, 042 00 Košice</span>
                </div>
              </div>
            </Kcap>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="order-2 lg:order-1">
                <Kcap delay={7*STEP} dur={740}>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md glass-edge keycap-pressable">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Demo account</div>
                        <div className="text-xs text-white/70">Teacher (Marek Horváth)</div>
                      </div>
                      <div className="px-2 py-1 rounded bg-emerald-400/15 border border-emerald-300/25 text-emerald-200 text-[11px]">
                        Teacher
                      </div>
                    </div>
                    <Kcap delay={8*STEP} dur={700}>
                      <Button
                          variant="outline"
                          className="mt-3 w-full"
                          iconName="LogIn"
                          onClick={() => doDemo(demoTeacher)}
                          disabled={loading}
                      >
                        Sign in with demo (Teacher)
                      </Button>
                    </Kcap>
                    <Kcap delay={9*STEP} dur={680}>
                      <p className="mt-2 text-[11px] text-white/60">
                        Fills email/password for you and signs in.
                      </p>
                    </Kcap>
                  </div>
                </Kcap>

                <Kcap delay={8*STEP} dur={740}>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md glass-edge keycap-pressable">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Demo account</div>
                        <div className="text-xs text-white/70">Student (Kyrylo Bulyk)</div>
                      </div>
                      <div className="px-2 py-1 rounded bg-sky-400/20 border border-sky-300/30 text-sky-200 text-[11px]">
                        Student
                      </div>
                    </div>
                    <Kcap delay={9*STEP} dur={700}>
                      <Button
                          variant="outline"
                          className="mt-3 w-full"
                          iconName="UserRound"
                          onClick={() => doDemo(demoStudent)}
                          disabled={loading}
                      >
                        Sign in with demo (Student)
                      </Button>
                    </Kcap>
                    <Kcap delay={10*STEP} dur={680}>
                      <p className="mt-2 text-[11px] text-white/60">
                        Fills email/password for you and signs in.
                      </p>
                    </Kcap>
                  </div>
                </Kcap>
              </div>

              <Kcap delay={5*STEP} dur={760} className="order-1 lg:order-2">
                <div className="rounded-2xl border border-white/12 bg-white/12 backdrop-blur-xl glass-edge p-6 sm:p-7 keycap-pressable">
                  <Kcap delay={6*STEP} dur={720}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
                          <Icon name="LockKeyhole" size={18} color="#fff" />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-white">Sign in</div>
                          <div className="text-xs text-white/70">Use your MAIS credentials</div>
                        </div>
                      </div>
                      <div className="hidden sm:block h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_20px_6px_rgba(125,211,252,.65)]" />
                    </div>
                  </Kcap>

                  {error && (
                      <Kcap delay={7*STEP} dur={720}>
                        <div className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-rose-100" role="alert" aria-live="assertive">
                          <div className="flex items-center gap-2">
                            <Icon name="AlertCircle" size={16} color="rgb(254 226 226)" />
                            <p className="text-sm">{error}</p>
                          </div>
                        </div>
                      </Kcap>
                  )}

                  <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    <Kcap delay={8*STEP} dur={710}>
                      <Input
                          id="email"
                          type="email"
                          label="Email"
                          placeholder="name.surname@university.edu"
                          value={email}
                          onChange={(e) => setEmail(String(e?.target?.value ?? ''))}
                          required
                          disabled={loading}
                          autoComplete="email"
                      />
                    </Kcap>

                    <Kcap delay={9*STEP} dur={710}>
                      <div>
                        <div className="flex items-center justify-between">
                          <label htmlFor="password" className="text-sm font-medium text-white">Password</label>
                          {caps && (
                              <span className="text-[11px] text-amber-300 flex items-center gap-1">
                            <Icon name="Keyboard" size={14} color="rgb(252 211 77)" />
                            Caps Lock is on
                          </span>
                          )}
                        </div>

                        <div className="relative mt-2">
                          <Input
                              id="password"
                              type={showPwd ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(String(e?.target?.value ?? ''))}
                              onKeyDown={onPwdKeyEvent}
                              onKeyUp={onPwdKeyEvent}
                              placeholder="Enter your password"
                              required
                              disabled={loading}
                              autoComplete="current-password"
                              inputClassName="pr-10"
                          />
                          <button
                              type="button"
                              onClick={() => setShowPwd(s => !s)}
                              className="absolute inset-y-0 right-2 flex items-center text-white/80 hover:text-white"
                              aria-label={showPwd ? 'Hide password' : 'Show password'}
                              title={showPwd ? 'Hide password' : 'Show password'}
                              disabled={loading}
                          >
                            <Icon name={showPwd ? 'EyeOff' : 'Eye'} size={18} className="opacity-90" />
                          </button>
                        </div>
                      </div>
                    </Kcap>

                    <Kcap delay={10*STEP} dur={700}>
                      <div className="flex items-center justify-between">
                        <Checkbox
                            checked={remember}
                            onChange={(e) => setRemember(Boolean(e?.target?.checked))}
                            label="Remember me"
                        />
                        <Link to="/forgot-password" className="inline-flex items-center gap-1 text-[13px] text-sky-300 hover:text-sky-200 underline underline-offset-4">
                          <Icon name="KeyRound" size={14} className="text-current" />
                          Forgot your password?
                        </Link>
                      </div>
                    </Kcap>

                    <Kcap delay={11*STEP} dur={720}>
                      <Button type="submit" className="w-full" iconName="LogIn" loading={loading} disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign In'}
                      </Button>
                    </Kcap>
                  </form>

                  <Kcap delay={12*STEP} dur={680}>
                    <div className="mt-5 text-center">
                      <p className="text-[12px] text-white/70">
                        Need help?{' '}
                        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sky-300 hover:text-sky-200 underline underline-offset-4">
                          Contact us: {SUPPORT_EMAIL}
                        </a>
                      </p>
                    </div>
                  </Kcap>
                </div>
              </Kcap>
            </div>

            {/* Quick Links & Info */}
            <Kcap delay={13*STEP} dur={720}>
              <div className="mt-8 mx-auto max-w-4xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <a 
                    href="https://www.tuke.sk" 
                    target="_blank" 
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/10 transition-colors keycap-pressable group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/20 text-sky-300 group-hover:bg-sky-500/30 transition-colors">
                        <Icon name="Globe" size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">TUKE Website</div>
                        <div className="text-[11px] text-white/50">www.tuke.sk</div>
                      </div>
                    </div>
                  </a>
                  
                  <a 
                    href="https://eprihlaska.tuke.sk" 
                    target="_blank" 
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/10 transition-colors keycap-pressable group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500/30 transition-colors">
                        <Icon name="FileText" size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">E-Application</div>
                        <div className="text-[11px] text-white/50">Apply for studies</div>
                      </div>
                    </div>
                  </a>
                  
                  <a 
                    href="https://mais.tuke.sk" 
                    target="_blank" 
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/10 transition-colors keycap-pressable group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-purple-500/20 text-purple-300 group-hover:bg-purple-500/30 transition-colors">
                        <Icon name="BookOpen" size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">Library</div>
                        <div className="text-[11px] text-white/50">Academic resources</div>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </Kcap>
          </div>

          <SiteFooter />
        </div>
      </div>
  );
};

const Login = () => {
  return (
    <ToastsProvider>
      <LoginInner />
      <ToastViewport position="top-right" />
    </ToastsProvider>
  );
};

export default Login;