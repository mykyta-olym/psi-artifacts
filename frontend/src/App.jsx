// src/App.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import AppRoutes from "./Routes";
import Header from "./components/ui/Header";
import LoaderOverlay from "./components/LoaderOverlay";
import GlobalRequestLoader from "./components/ui/GlobalRequestLoader";
import AuthProvider from "./contexts/AuthContext";
import NotificationsProvider from "./contexts/NotificationsContext";
import { SignalRProvider } from "./contexts/SignalRContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ServerStatusProvider from "./contexts/ServerStatusContext";
import CookieConsent from "./components/ui/CookieConsent";
import CommandPalette from "./components/ui/CommandPalette";
import { setupGlobalErrorHandlers } from "./utils/globalErrorHandler";
import "./styles/globals.css";

// Setup global error handlers once
setupGlobalErrorHandlers();

const KNOWN_PREFIXES = [
    "/",
    "/login",
    "/forgot-password",
    "/teacher-dashboard",
    "/student-dashboard",
    "/grade-management",
    "/attendance-tracking",
    "/student-management",
    "/class-schedule-management",
    "/activities",
    "/faculty-management",
    "/profile",
    "/chat",
    "/help",
    "/student-studies",
    "/terminy",
    "/zapis",
    "/anketa",
    "/final-thesis",
    "/final-thesis/teacher",
    "/print-reports",
    "/study-select",
];

function HideableHeader() {
    const { pathname } = useLocation();
    const isKnown = KNOWN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
    const hideOnSpecific = pathname === "/" || pathname === "/login" || pathname === "/forgot-password" || pathname.startsWith("/study-select");
    const hideHeader = hideOnSpecific || !isKnown;
    if (hideHeader) return null;
    return (
        <>
            <Header />
            <div aria-hidden className="h-[var(--hdr-h)]" />
        </>
    );
}

export default function App() {
    const [showLoader, setShowLoader] = useState(true);
    const [bootProgress, setBootProgress] = useState(null);
    const hideTimerRef = useRef(null);

    const done = useCallback(() => {
        hideTimerRef.current = setTimeout(() => setShowLoader(false), 60);
    }, []);

    useEffect(() => {
        const slow = /slowloader=1/i.test(window.location.search) || Boolean(Reflect.get(window, "__forceSlowLoader"));
        if (!slow) return;
        setBootProgress(0);
        const steps = [5, 12, 22, 36, 49, 63, 77, 88, 96, 100];
        let i = 0;
        const t = setInterval(() => {
            setBootProgress(steps[i]);
            i += 1;
            if (i >= steps.length) clearInterval(t);
        }, 260);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        document.documentElement.classList.add("app-mounted");
        const pre = document.getElementById("preboot-loader");
        if (pre) pre.remove();
        Reflect.set(window, "__appBootReady", true);
    }, []);

    useEffect(() => () => clearTimeout(hideTimerRef.current), []);

    return (
        <AuthProvider>
            <SignalRProvider>
                <NotificationsProvider>
                    {showLoader && (
                        <LoaderOverlay progress={bootProgress ?? undefined} minShowMs={1100} label="Preparing workspace…" onFinish={done} />
                    )}
                    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                        <ServerStatusProvider>
                        <ErrorBoundary>
                            <GlobalRequestLoader />
                            <HideableHeader />
                            <AppRoutes />
                            <CookieConsent />
                            <CommandPalette />
                        </ErrorBoundary>
                        </ServerStatusProvider>
                    </BrowserRouter>
                </NotificationsProvider>
            </SignalRProvider>
        </AuthProvider>
    );
}