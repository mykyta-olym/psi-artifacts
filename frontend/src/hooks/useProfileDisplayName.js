import { useCallback, useEffect, useMemo, useState } from 'react';
import { displayNameFrom } from '../utils/displayName';
import { useAuth } from '../contexts/AuthContext';

export default function useProfileDisplayName(fallback = '') {
    const { user, userProfile } = useAuth();

    const compute = useCallback(() => {
        // Use only userProfile from AuthContext, no static fallback
        const base = userProfile && Object.keys(userProfile).length ? userProfile : null;
        if (!base) return fallback;
        return (
            displayNameFrom(base, { privacy: false }) ||
            base?.full_name ||
            base?.name ||
            fallback
        );
    }, [fallback, userProfile]);

    const [name, setName] = useState(() => compute());

    useEffect(() => {
        // Use setTimeout to avoid setState during render
        setTimeout(() => setName(compute()), 0);
    }, [compute]);

    useEffect(() => {
        const handler = (event) => {
            const prof = event?.detail;
            if (prof) {
                // Use setTimeout to avoid setState during render
                setTimeout(() => setName(
                    displayNameFrom(prof, { privacy: false }) ||
                        prof?.full_name ||
                        prof?.name ||
                        fallback
                ), 0);
            } else {
                // Use setTimeout to avoid setState during render
                setTimeout(() => setName(compute()), 0);
            }
        };
        window.addEventListener('mais:profile-updated', handler);
        return () => window.removeEventListener('mais:profile-updated', handler);
    }, [compute, fallback]);

    return useMemo(() => name || fallback, [name, fallback]);
}
