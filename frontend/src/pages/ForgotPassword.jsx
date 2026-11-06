// src/pages/ForgotPassword.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Icon from 'components/AppIcon';
import { Checkbox } from 'components/ui/Checkbox';
import { useAuth } from 'contexts/AuthContext';
import SiteHeader from 'components/ui/SiteHeader';
import SiteFooter from 'components/ui/SiteFooter';
import { ToastsProvider, ToastViewport, useToasts } from 'components/ui/Toasts';

const maskEmail = (email='')=>{
    const [name, domain=''] = String(email).split('@');
    if(!name) return email;
    const shown = name.slice(0, 2);
    const hidden = '*'.repeat(Math.max(1, name.length - 2));
    return `${shown}${hidden}@${domain}`;
};
const passwordPolicyCheck = (pwd='')=>{
    const len = pwd.length >= 8;
    const upper = /[A-Z]/.test(pwd);
    const lower = /[a-z]/.test(pwd);
    const digit = /\d/.test(pwd);
    const special = /[^A-Za-z0-9]/.test(pwd);
    const score = [len, upper, lower, digit, special].filter(Boolean).length;
    return { len, upper, lower, digit, special, score, ok: score >= 4 };
};
const cx = (...a) => a.filter(Boolean).join(' ');

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

const Kcap = ({ delay = 0, dur = 720, className = '', children, style }) => (
    <div className={cx('keycap-in', className)} style={{ animationDelay: `${delay}ms`, animationDuration: `${dur}ms`, ...style }}>
        {children}
    </div>
);

const OTPInput = ({ length = 6, value = '', onChange, disabled, onComplete })=>{
    const inputsRef = useRef(Array.from({ length }, () => React.createRef()));
    const wrapperRef = useRef(null);
    const chars = Array.from({ length }, (_, i) => String(value[i] ?? ''));

    const focusAt = (i)=>{ const el = inputsRef.current[i]?.current; if (el) { el.focus(); requestAnimationFrame(()=> el.select?.()); } };
    const setCharAt = (i, ch)=>{ const nextArr = Array.from({ length }, (_, k) => (k === i ? ch : String(value[k] ?? ''))); onChange?.(nextArr.join('')); };
    const fillFrom = (i, digits)=>{ const clean = String(digits||'').replace(/\D/g,'').slice(0,length); if(!clean) return;
        const nextArr = chars.slice(); let idx = i; for (const d of clean) { if (idx>=length) break; nextArr[idx]=d; idx++; }
        onChange?.(nextArr.join('')); const lastIdx = Math.min(idx, length-1); setTimeout(()=>focusAt(lastIdx),0); };
    const handleChange = (i, e)=>{ const raw = String(e?.target?.value ?? ''); const d = raw.replace(/\D/g,''); if (d.length>1) return fillFrom(i, d);
        if (!d) setCharAt(i, ''); else { setCharAt(i, d); if (i<length-1) setTimeout(()=>focusAt(i+1),0); } };
    const handleKeyDown = async (i, e)=>{ const key = e.key; const cur = chars[i] || '';
        if ((e.ctrlKey||e.metaKey) && (key==='v'||key==='V')) { e.preventDefault(); try { if (navigator?.clipboard?.readText) { const txt = await navigator.clipboard.readText(); if (txt) fillFrom(i, txt); return; } } catch {} return; }
        if (key==='Backspace') { e.preventDefault(); if (cur) { setCharAt(i,''); return; } if (i>0) { const p=i-1; setCharAt(p,''); setTimeout(()=>focusAt(p),0); } return; }
        if (key==='Delete') { e.preventDefault(); if (cur) setCharAt(i,''); return; }
        if (key==='ArrowLeft' && i>0)  { e.preventDefault(); focusAt(i-1); return; }
        if (key==='ArrowRight' && i<length-1) { e.preventDefault(); focusAt(i+1); return; }
        if (key.length===1 && /\D/.test(key)) e.preventDefault();
    };
    useEffect(()=>{ const onDocPaste=(e)=>{ const text=(e.clipboardData||window.clipboardData)?.getData('text')||''; const digits=text.replace(/\D/g,''); if(!digits||!wrapperRef.current) return;
        const active=document.activeElement; const isInput=active && ['input','textarea'].includes(active.tagName?.toLowerCase()); const otpIdx=inputsRef.current.findIndex(r=>r?.current===active);
        if (otpIdx>=0) { e.preventDefault(); fillFrom(otpIdx, digits); return; } if (!isInput) { e.preventDefault(); fillFrom(0, digits); } };
        document.addEventListener('paste', onDocPaste, true); return ()=> document.removeEventListener('paste', onDocPaste, true);
    }, [value, length]);
    const onFieldPaste=(i,e)=>{ e.preventDefault(); const text=(e.clipboardData||window.clipboardData)?.getData('text')||''; fillFrom(i, text); };
    useEffect(()=>{ if (disabled) return; const firstEmpty = chars.findIndex(c=>!c); if (firstEmpty>=0) focusAt(firstEmpty); else focusAt(length-1); }, [disabled]);
    useEffect(()=>{ if (onComplete && String(value).length===length && /^[0-9]{6}$/.test(String(value))) { onComplete(String(value)); } }, [value, length, onComplete]);
    const glassBox='rounded-xl border border-white/25 bg-white/10 backdrop-blur-md text-white shadow-[0_6px_18px_rgba(0,0,0,.28)] focus-visible:ring-2 focus-visible:ring-sky-400/60';
    return (
        <div ref={wrapperRef} role="group" aria-label="One-time code" className="w-full">
            <div className="flex justify-between gap-2 sm:gap-3">
                {chars.map((ch,i)=>(
                    <Input
                        key={i}
                        ref={inputsRef.current[i]}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={1}
                        aria-label={`Digit ${i+1} of ${length}`}
                        className={cx(glassBox,'w-10 sm:w-12')}
                        inputClassName="text-center font-semibold text-lg sm:text-2xl h-12 sm:h-14"
                        value={String(ch)}
                        disabled={disabled}
                        onChange={(e)=>handleChange(i, e)}
                        onKeyDown={(e)=>handleKeyDown(i, e)}
                        onPaste={(e)=>onFieldPaste(i, e)}
                        onFocus={(e)=>e.target.select?.()}
                    />
                ))}
            </div>
        </div>
    );
};

const ForgotPasswordInner = () => {
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tokenInUrl = sp.get('token') || '';
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

    const {
        requestPasswordReset,
        resendPasswordReset,
        verifyResetToken,
        verifyResetCode,
        resetPassword,
    } = useAuth();

    const [mounted, setMounted] = useState(false);
    const [step, setStep] = useState(tokenInUrl ? 'reset' : 'request');
    const [email, setEmail] = useState('');
    const [masked, setMasked] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [sent, setSent] = useState(null);

    const [otp, setOtp] = useState('');
    const [otpBusy, setOtpBusy] = useState(false);

    const [pwd, setPwd] = useState('');
    const [pwd2, setPwd2] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [signoutAll, setSignoutAll] = useState(true);


    const policy = useMemo(()=>passwordPolicyCheck(pwd),[pwd]);
    const canReset = policy.ok && pwd === pwd2 && pwd.length>0;

    const COOLDOWN_SEC = 60;
    const [cooldown, setCooldown] = useState(0);
    const DEV_SHOW_DEMO = false;

    useEffect(() => {
        if (!document.getElementById('keycap-anim-styles')) {
            const s = document.createElement('style');
            s.id = 'keycap-anim-styles';
            s.textContent = KEYCAP_CSS;
            document.head.appendChild(s);
        }
    }, []);
    useEffect(()=>{ setTimeout(()=>setMounted(true), 16); }, []);
    useEffect(()=>{ if (cooldown<=0) return; const t=setInterval(()=> setCooldown(s => (s>0 ? s-1 : 0)), 1000); return ()=> clearInterval(t); }, [cooldown]);
    useEffect(()=> {
        if (tokenInUrl) {
            setStep('reset'); setError('');
            (async ()=> {
                const ok = await verifyResetToken({ token: tokenInUrl });
                if (!ok) {
                    setError('This reset link is invalid or expired. Request a new one.');
                    setStep('request');
                    setSp(p => { p.delete('token'); return p; }, { replace: true });
                }
            })();
        }
    }, [tokenInUrl]);

    const onRequest = async (e)=> {
        e?.preventDefault?.();
        setError(''); setInfo('');
        if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ 
            const msg = 'Please enter a valid email.';
            setError(msg);
            guardedNotify('forgot-email-invalid', 'error', msg, { title: 'Invalid email', lockMs: 3000 });
            return;
        }
        setBusy(true);
        const { data, error:err } = await requestPasswordReset({ email });
        setBusy(false);
        if (err) { 
            setError(err);
            guardedNotify('forgot-request-error', 'error', err, { title: 'Request failed', lockMs: 3000 });
            return;
        }
        setMasked(data.maskedEmail || maskEmail(email));
        setSent({ token: data.token, code: data.code, expiresAt: data.expiresAt });
        setStep('verify-code');
        const infoMsg = 'We sent you a reset link and a one-time code. The code expires in 15 minutes.';
        setInfo(infoMsg);
        guardedNotify('forgot-request-success', 'success', infoMsg, { title: 'Reset link sent', force: true, lockMs: 4000 });
        setOtp(''); setCooldown(COOLDOWN_SEC);
    };

    const onResend = async ()=> {
        if(!email) return;
        setInfo(''); setError('');
        const { data, error:err } = await resendPasswordReset({ email });
        if (err) { 
            setError(err);
            guardedNotify('forgot-resend-error', 'error', err, { title: 'Resend failed', lockMs: 3000 });
            return;
        }
        setSent({ token: data.token, code: data.code, expiresAt: data.expiresAt });
        const infoMsg = 'A new link and code were generated.';
        setInfo(infoMsg);
        guardedNotify('forgot-resend-success', 'success', infoMsg, { title: 'Code resent', force: true, lockMs: 3000 });
        setOtp(''); setCooldown(COOLDOWN_SEC);
    };

    const onVerifyCode = async ()=> {
        setError(''); setInfo('');
        if (!otp || otp.length<6) { 
            const msg = 'Enter the 6-digit code.';
            setError(msg);
            guardedNotify('forgot-code-invalid', 'error', msg, { title: 'Invalid code', lockMs: 3000 });
            return;
        }
        setOtpBusy(true);
        const { data, error:err } = await verifyResetCode({ email, code: otp });
        setOtpBusy(false);
        if (err) { 
            setError(err);
            guardedNotify('forgot-verify-error', 'error', err, { title: 'Verification failed', lockMs: 3000 });
            return;
        }
        setSent(s => ({ ...(s||{}), token: data.token }));
        setStep('reset');
        guardedNotify('forgot-verify-success', 'success', 'Code verified successfully', { title: 'Verified', force: true, lockMs: 2000 });
    };

    const onReset = async (e)=> {
        e?.preventDefault?.();
        setError(''); setInfo('');
        if (!canReset) { 
            const msg = 'Please meet the password requirements and confirm it.';
            setError(msg);
            guardedNotify('forgot-password-invalid', 'error', msg, { title: 'Invalid password', lockMs: 3000 });
            return;
        }
        const token = tokenInUrl || sent?.token || '';
        if (!token) { 
            const msg = 'No reset token. Request a new link.';
            setError(msg);
            guardedNotify('forgot-token-missing', 'error', msg, { title: 'Token missing', lockMs: 3000 });
            return;
        }
        setBusy(true);
        const { error:err } = await resetPassword({ token, newPassword: pwd, signOutAll: signoutAll });
        setBusy(false);
        if (err) { 
            setError(err);
            guardedNotify('forgot-reset-error', 'error', err, { title: 'Reset failed', lockMs: 3000 });
            return;
        }
        setStep('done');
        guardedNotify('forgot-reset-success', 'success', 'Password updated successfully', { title: 'Password reset', force: true, lockMs: 3000 });
    };

    const STEP = 90;
    const steps = [
        { id: 'request',     label: 'Request',    icon: 'Mail' },
        { id: 'verify-code', label: 'Verify',     icon: 'Hash' },
        { id: 'reset',       label: 'Reset',      icon: 'KeyRound' },
        { id: 'done',        label: 'Completed',  icon: 'CheckCircle2' },
    ];
    const activeIndex = Math.max(0, steps.findIndex(s => s.id === step));

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
                    <div className={cx("mx-auto mb-6 max-w-2xl text-center", mounted ? "" : "opacity-0")}>
                        <Kcap delay={STEP} dur={760}>
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Forgot your password?</h1>
                        </Kcap>
                        <Kcap delay={2*STEP} dur={720}>
                            <p className="mt-2 text-sm text-white/70">We’ll guide you through a quick, secure reset flow.</p>
                        </Kcap>
                    </div>

                    <Kcap delay={5*STEP} dur={760} className="w-full">
                        <div className="rounded-2xl border border-white/12 bg-white/12 backdrop-blur-xl glass-edge p-6 sm:p-7 keycap-pressable">
                            <Kcap delay={6*STEP} dur={700}>
                                <div className="mb-5">
                                    <div className="flex items-center justify-between gap-2">
                                        {steps.map((s, i)=>(
                                            <div key={s.id} className="flex-1 flex items-center">
                                                <div className={cx('flex items-center gap-2', i <= activeIndex ? 'opacity-100' : 'opacity-60')}>
                                                    <div className={cx('grid h-8 w-8 place-items-center rounded-full border', i <= activeIndex ? 'bg-sky-500/80 border-sky-400/50 text-white' : 'bg-white/10 border-white/20 text-white/80')}>
                                                        <Icon name={s.icon} size={16} color="currentColor" />
                                                    </div>
                                                    <span className="hidden sm:block text-sm text-white/80">{s.label}</span>
                                                </div>
                                                {i < steps.length-1 && (<div className={cx('mx-2 h-[2px] flex-1 rounded', i < activeIndex ? 'bg-sky-400/60' : 'bg-white/15')}/>)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Kcap>

                            {error && (
                                <Kcap delay={7*STEP} dur={720}>
                                    <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-rose-100" role="alert" aria-live="assertive">
                                        <div className="flex items-center gap-2">
                                            <Icon name="AlertCircle" size={16} color="rgb(254 226 226)" />
                                            <p className="text-sm">{error}</p>
                                        </div>
                                    </div>
                                </Kcap>
                            )}
                            {info && (
                                <Kcap delay={7*STEP+10} dur={720}>
                                    <div className="rounded-lg border border-sky-400/30 bg-sky-400/10 p-3 text-sky-100">
                                        <div className="flex items-center gap-2">
                                            <Icon name="Info" size={16} color="rgb(186 230 253)" />
                                            <p className="text-sm">{info}</p>
                                        </div>
                                    </div>
                                </Kcap>
                            )}

                            <div key={step} className="space-y-4">
                                {step === 'request' && (
                                    <form onSubmit={onRequest} className="space-y-4">
                                        <Kcap delay={8*STEP} dur={710}>
                                            <Input
                                                type="email"
                                                label="Email"
                                                placeholder="marek.horvath@university.edu"
                                                value={email}
                                                onChange={(e)=>setEmail(String(e?.target?.value ?? ''))}
                                                autoFocus
                                                required
                                                autoComplete="email"
                                            />
                                        </Kcap>

                                        <Kcap delay={9*STEP} dur={700}>
                                            <p className="text-[12px] text-white/70">We’ll generate a magic link and a 6-digit code (valid for 15 minutes).</p>
                                        </Kcap>

                                        <Kcap delay={10*STEP} dur={720}>
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                <Button type="submit" disabled={busy} iconName={busy ? 'Loader2' : 'Send'} className="w-full sm:w-auto">
                                                    {busy ? 'Sending…' : 'Send reset link'}
                                                </Button>
                                                <Button variant="link" onClick={()=>navigate('/login')} className="text-sm underline underline-offset-4 text-sky-300 hover:text-sky-200 w-full sm:w-auto text-center">
                                                    Back to login
                                                </Button>
                                            </div>
                                        </Kcap>
                                    </form>
                                )}

                                {step === 'verify-code' && (
                                    <div className="space-y-5">
                                        <Kcap delay={8*STEP} dur={710}>
                                            <div className="text-sm text-white/80">We sent a message to <span className="font-semibold">{masked || maskEmail(email)}</span>.</div>
                                        </Kcap>

                                        <Kcap delay={9*STEP} dur={720}>
                                            <div className="space-y-2">
                                                <label className="text-sm text-white/70 block">Enter 6-digit code</label>
                                                <OTPInput value={otp} onChange={(v)=>setOtp(String(v ?? ''))} disabled={otpBusy} onComplete={()=>onVerifyCode()} />
                                                {typeof window !== 'undefined' && DEV_SHOW_DEMO && sent?.code && (
                                                    <div className="text-[12px] text-white/65">DEMO code: <code className="font-mono">{sent.code}</code></div>
                                                )}
                                                <div className="text-[12px] text-white/60">
                                                    Tip: paste with <kbd className="px-1 rounded bg-white/10 border border-white/20">Ctrl</kbd>+<kbd className="px-1 rounded bg-white/10 border border-white/20">V</kbd> / <kbd className="px-1 rounded bg-white/10 border border-white/20">⌘</kbd>+<kbd className="px-1 rounded bg-white/10 border border-white/20">V</kbd>.
                                                </div>
                                            </div>
                                        </Kcap>

                                        <Kcap delay={10*STEP} dur={720}>
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                <Button onClick={onVerifyCode} disabled={otpBusy || (otp||'').length<6} iconName={otpBusy?'Loader2':'Check'} className="w-full sm:w-auto">
                                                    {otpBusy ? 'Verifying…' : 'Verify code'}
                                                </Button>
                                                <Button variant="outline" onClick={onResend} disabled={cooldown>0} iconName="RefreshCw" className="w-full sm:w-auto" aria-live="polite">
                                                    {cooldown>0 ? `Resend in ${cooldown}s` : 'Resend'}
                                                </Button>
                                                <Button variant="link" onClick={()=>navigate('/login')} className="text-sm underline underline-offset-4 text-sky-300 hover:text-sky-200 w-full sm:w-auto text-center">
                                                    Cancel
                                                </Button>
                                            </div>
                                        </Kcap>
                                    </div>
                                )}

                                {step === 'reset' && (
                                    <form onSubmit={onReset} className="space-y-4">
                                        <Kcap delay={8*STEP} dur={710}>
                                            <div>
                                                <label className="text-sm text-white/80">New password</label>
                                                <div className="relative mt-2">
                                                    <Input
                                                        type={showPwd ? 'text' : 'password'}
                                                        value={pwd}
                                                        onChange={(e)=>setPwd(String(e?.target?.value ?? ''))}
                                                        placeholder="Create a strong password"
                                                        autoFocus
                                                        autoComplete="new-password"
                                                        className="pr-10"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                                                        onClick={()=>setShowPwd(s=>!s)}
                                                        aria-label={showPwd?'Hide password':'Show password'}
                                                        title={showPwd?'Hide password':'Show password'}
                                                    >
                                                        <Icon name={showPwd?'EyeOff':'Eye'} />
                                                    </button>
                                                </div>

                                                <div className="flex gap-1 mt-2" role="meter" aria-valuemin={0} aria-valuemax={5} aria-valuenow={policy.score}>
                                                    {Array.from({length:5}).map((_,i)=>(<span key={i} className={cx('h-1.5 flex-1 rounded', i < policy.score ? 'bg-sky-400' : 'bg-white/20')} />))}
                                                </div>

                                                <ul className="mt-2 text-[12px] space-y-1">
                                                    <li className={policy.len?'text-white':'text-white/60'}>• At least 8 characters</li>
                                                    <li className={(policy.upper&&policy.lower)?'text-white':'text-white/60'}>• Uppercase and lowercase</li>
                                                    <li className={policy.digit?'text-white':'text-white/60'}>• At least one number</li>
                                                    <li className={policy.special?'text-white':'text-white/60'}>• At least one symbol</li>
                                                </ul>
                                            </div>
                                        </Kcap>

                                        <Kcap delay={9*STEP} dur={710}>
                                            <div>
                                                <label className="text-sm text-white/80">Confirm password</label>
                                                <Input
                                                    type={showPwd ? 'text' : 'password'}
                                                    value={pwd2}
                                                    onChange={(e)=>setPwd2(String(e?.target?.value ?? ''))}
                                                    placeholder="Repeat password"
                                                    autoComplete="new-password"
                                                />
                                                {pwd2 && pwd!==pwd2 && (<div className="text-[12px] text-rose-200 mt-1">Passwords do not match</div>)}
                                            </div>
                                        </Kcap>

                                        <Kcap delay={10*STEP} dur={700}>
                                            <Checkbox
                                                checked={signoutAll}
                                                onChange={(e)=>setSignoutAll(Boolean(e?.target?.checked))}
                                                label="Sign out on all devices (recommended)"
                                            />
                                        </Kcap>

                                        <Kcap delay={11*STEP} dur={720}>
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                <Button type="submit" disabled={!canReset || busy} iconName={busy?'Loader2':'KeyRound'} className="w-full sm:w-auto">
                                                    {busy ? 'Updating…' : 'Reset password'}
                                                </Button>
                                                <Button variant="link" onClick={()=>navigate('/login')} className="text-sm underline underline-offset-4 text-sky-300 hover:text-sky-200 w-full sm:w-auto text-center">
                                                    Back to login
                                                </Button>
                                            </div>
                                        </Kcap>
                                    </form>
                                )}

                                {step === 'done' && (
                                    <div className="space-y-4">
                                        <Kcap delay={8*STEP} dur={720}>
                                            <div className="p-3 rounded-md bg-emerald-400/15 text-emerald-200 border border-emerald-300/25 flex items-center gap-2">
                                                <Icon name="CheckCircle2" />
                                                <div>
                                                    <div className="font-medium">Password updated</div>
                                                    <div className="text-sm">You can now sign in with your new password.</div>
                                                </div>
                                            </div>
                                        </Kcap>
                                        <Kcap delay={9*STEP} dur={720}>
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                <Button onClick={()=>navigate('/login')} iconName="LogIn" className="w-full sm:w-auto">Go to login</Button>
                                                <Button variant="outline" onClick={()=>navigate('/')} iconName="Home" className="w-full sm:w-auto">Back to Home</Button>
                                            </div>
                                        </Kcap>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Kcap>

                    <Kcap delay={12*STEP} dur={680}>
                        <div className="mx-auto mt-8 text-center text-white/60 text-[12px]">
                            Need help? <a href="mailto:support@mais.tuke.sk" className="text-sky-300 hover:text-sky-200 underline underline-offset-4">Contact support</a>
                        </div>
                    </Kcap>
                </div>

                <SiteFooter />
            </div>
        </div>
    );
};

const ForgotPassword = () => {
    return (
        <ToastsProvider>
            <ForgotPasswordInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default ForgotPassword;