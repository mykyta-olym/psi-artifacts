// src/pages/study-selection/index.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Icon from "components/AppIcon";
import SiteHeader from "components/ui/SiteHeader";
import SiteFooter from "components/ui/SiteFooter";
import { useAuth } from "contexts/AuthContext";
import useUserPreference from "../../hooks/useUserPreference";
import { ToastsProvider, ToastViewport, useToasts } from "components/ui/Toasts";
import { motion } from "framer-motion";
import Reveal from "components/motion/Reveal";
import { ANIMATION_DELAYS } from "../../constants/animations";
import useGlobalLoaderBlocking from "../../hooks/useGlobalLoaderBlocking";

import GradientBackdrop from "./components/GradientBackdrop";
import TitleBar from "./components/TitleBar";
import MobileStudiesList from "./components/MobileStudiesList";
import StudiesTable from "./components/StudiesTable";
import DataLoader from "components/ui/DataLoader";

import {
    STORAGE_KEY,
    REMEMBER_KEY,
    norm,
    parseReturn,
    degreeOf,
    useStudies,
    studentIdOf,
    personIdOf,
    cacheSelectedStudy,
    clearSelectedStudyCache,
    loadCachedSelectedStudy
} from "./utils/studyUtils";

const StudySelectionInner = () => {
    const { user, userProfile } = useAuth();
    const navigate = useNavigate();
    const { search } = useLocation();
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();

    const { studies, loading: studiesLoading, error: studiesError } = useStudies(user, userProfile);
    const ret = parseReturn(search);

    const {
        value: rememberValue,
        setValue: setRememberPreference,
        loading: rememberLoading
    } = useUserPreference(REMEMBER_KEY, false);

    const {
        value: selectedStudyValue,
        setValue: setSelectedStudy,
        reset: resetSelectedStudy,
        loading: selectedStudyLoading
    } = useUserPreference(STORAGE_KEY, null);

    const remember = !!rememberValue;
    const [isNavigating, setIsNavigating] = useState(false);
    
    const setRemember = useCallback(
        (next) => {
            setRememberPreference(!!next);
        },
        [setRememberPreference]
    );

    const unrememberedClearedRef = useRef(false);
    const rememberSnapshotRef = useRef(remember);

    useEffect(() => {
        const currentRemember = !!rememberValue;
        if (rememberSnapshotRef.current !== currentRemember) {
            rememberSnapshotRef.current = currentRemember;
            unrememberedClearedRef.current = false;
        }
    }, [rememberValue]);

    useEffect(() => {
        if (!user) navigate("/login", { replace: true });
    }, [user, navigate]);

    const choose = useCallback(
        (row) => {
            if (!row || isNavigating) return;
            
            // Set navigating flag immediately to block any other effects
            setIsNavigating(true);
            
            const studentId = studentIdOf(row);
            const derivedPersonId = personIdOf(row);
            const payload = {
                uid: row.uid,
                programName: norm(row.programName),
                programCode: norm(row.programCode),
                faculty: norm(row.faculty),
                ospYear: String(row.ospYear || "1"),
                status: norm(row.status || (row.ongoing ? "ongoing" : "archived")),
                ongoing: !!row.ongoing,
                degree: degreeOf(row) || "",
                selectedAt: Date.now(),
                studentId: studentId ? norm(studentId) : null,
                personId: derivedPersonId ? norm(derivedPersonId) : null
            };
            
            // Cache in session storage
            cacheSelectedStudy(payload, { persistLocal: true });
            
            const destination = ret || "/student-dashboard";
            
            if (remember) {
                setSelectedStudy(payload);
            }
            setRememberPreference(remember);
            
            // Navigate immediately
            navigate(destination, { replace: true });
        },
        [navigate, remember, ret, setRememberPreference, setSelectedStudy, isNavigating]
    );

    useEffect(() => {
        if (!selectedStudyValue) return;
        let next = selectedStudyValue;
        if (!selectedStudyValue.studentId) {
            const derived = studentIdOf(selectedStudyValue);
            if (derived) {
                next = { ...next, studentId: derived };
            }
        }
        if (!next.personId) {
            const derivedPerson = personIdOf(selectedStudyValue);
            if (derivedPerson) {
                next = { ...next, personId: derivedPerson };
            }
        }
        if (next !== selectedStudyValue) {
            setSelectedStudy(next);
        }
    }, [selectedStudyValue, setSelectedStudy]);

    useEffect(() => {
        if (selectedStudyValue) {
            cacheSelectedStudy(selectedStudyValue);
        } else {
            clearSelectedStudyCache();
        }
    }, [selectedStudyValue]);

    const clearSelection = useCallback(() => {
        if (!selectedStudyValue) return;
        resetSelectedStudy();
        clearSelectedStudyCache();
    }, [resetSelectedStudy, selectedStudyValue]);

    const preferencesLoading = rememberLoading || selectedStudyLoading;
    const busy = preferencesLoading || studiesLoading;

    useEffect(() => {
        // Don't do anything if we're in the middle of navigating away
        if (isNavigating) return;
        if (preferencesLoading || studiesLoading) return;
        
        const q = new URLSearchParams(search || "");
        const forceReset = q.get("reset") === "1";
        const rememberedBefore = !!rememberValue;
        const current = selectedStudyValue;

        if (forceReset) {
            resetSelectedStudy();
            return;
        }

        // Only auto-redirect if coming from another page with return URL AND remember is on
        if (ret && rememberedBefore && current) {
            navigate(ret, { replace: true });
            return;
        }

        // Clear selection if remember is off and there's a stale value
        if (!rememberedBefore && current && !unrememberedClearedRef.current) {
            const cached = loadCachedSelectedStudy();
            if (!cached) {
                unrememberedClearedRef.current = true;
                clearSelection();
            }
            return;
        }
    }, [
        search,
        navigate,
        ret,
        clearSelection,
        preferencesLoading,
        rememberValue,
        studiesLoading,
        selectedStudyValue,
        resetSelectedStudy,
        isNavigating
    ]);

    const onBack = () => navigate(-1);

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-background">
            {busy && (
                <DataLoader
                    label="Loading study options…"
                    description="Synchronizing programmes and preferences from MAIS."
                    details={[
                        'Study assignments • remembered preference • navigation target'
                    ]}
                    fullScreen
                />
            )}
            <GradientBackdrop />

            <div className="relative z-[2] flex min-h-screen flex-col">
                <Reveal variant="keycap" waitForLoaders={true}>
                    <SiteHeader mode="internal" />
                </Reveal>

                <div className="mx-auto w-full max-w-6xl flex-1 px-3 xs:px-4 sm:px-6 md:px-8 py-6 sm:py-8">
                    <Reveal variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.HERO}>
                        <TitleBar />
                    </Reveal>

                    {studiesError && (
                        <Reveal variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.SUBTITLE}>
                            <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                                Unable to reach the study service. Showing cached data instead.
                            </div>
                        </Reveal>
                    )}

                    <Reveal variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.SUMMARY_CARDS}>
                        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                            <MobileStudiesList
                                studies={studies}
                                remember={remember}
                                onRememberChange={setRemember}
                                onChoose={choose}
                                onBack={onBack}
                            />

                            <StudiesTable
                                studies={studies}
                                remember={remember}
                                onRememberChange={setRemember}
                                onChoose={choose}
                                onBack={onBack}
                            />
                        </div>
                    </Reveal>

                    <Reveal variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.FILTERS}>
                        <div className="mt-6 text=[11px] sm:text-xs text-muted-foreground">
                            <div>Identifiers used for quick access:</div>
                            <div className="mt-1">
                                {studies.map((s) => (
                                    <span
                                        key={s.uid}
                                        className="inline-flex items-center gap-2 mr-2 sm:mr-3 mb-2 px-2 py-1 rounded bg-muted border border-border text-[10px] sm:text-[11px]"
                                    >
                      <Icon name="Hash" size={12} /> {s.uid}
                    </span>
                                ))}
                            </div>
                        </div>
                    </Reveal>
                </div>

                <Reveal variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.MAIN_CONTENT}>
                    <SiteFooter innerClassName="mx-auto max-w-6xl px-3 sm:px-4 py-4 text-center text-[11px] sm:text-[12px] text-white/70" />
                </Reveal>
            </div>
        </div>
    );
};

const StudySelection = () => {
    return (
        <ToastsProvider>
            <StudySelectionInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default StudySelection;
