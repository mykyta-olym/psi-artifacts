// src/components/providers/CommandCenterProvider.jsx
import React, {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CommandPalette from '../components/ui/CommandPalette';

const Ctx = createContext(null);

export const CommandCenterProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [groups, setGroups] = useState({});

    const go = useCallback(
        (to) => {
            setOpen(false);
            setQuery('');
            navigate(to);
        },
        [navigate]
    );

    // Базові дії доступні скрізь
    const baseActions = useMemo(
        () => [
            { id: 'go-students',  icon: 'Users',      label: 'Open Students',   hint: 'Go to student management', run: () => go('/student-management') },
            { id: 'go-faculty',   icon: 'UserPlus',   label: 'Open Faculty',     hint: 'Teachers & staff',         run: () => go('/faculty-management') },
            { id: 'go-attend',    icon: 'CheckSquare',label: 'Open Attendance',  hint: 'Track attendance',         run: () => go('/attendance-tracking') },
            { id: 'go-grades',    icon: 'BookOpen',   label: 'Open Grades',      hint: 'Grade management',         run: () => go('/grade-management') },
            { id: 'go-activity',  icon: 'BarChart3',  label: 'Open Activities',  hint: 'Activity feed',            run: () => go('/activities') },
            { id: 'go-profile',   icon: 'User',       label: 'Open Profile',     hint: 'Profile & settings',       run: () => go('/profile') },
            { id: 'go-help',      icon: 'HelpCircle', label: 'Help & Support',   hint: 'Open help center',         run: () => go('/help') },
        ],
        [go]
    );

    const actions = useMemo(
        () => [...baseActions, ...Object.values(groups).flat()],
        [baseActions, groups]
    );

    // Реєстрація дій зі сторінок (повертає disposer)
    const registerActions = useCallback((key, items) => {
        setGroups((prev) => ({ ...prev, [key]: items || [] }));
        return () =>
            setGroups((prev) => {
                const n = { ...prev };
                delete n[key];
                return n;
            });
    }, []);

    // Глобальні хоткеї (Cmd/Ctrl+K, G then A/P/F)
    useEffect(() => {
        const onKey = (e) => {
            const tag = (e.target?.tagName || '').toLowerCase();
            const editable =
                tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

            // Palette toggle
            if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation?.();
                setOpen((o) => !o);
                return;
            }

            // G-combos
            if (!editable && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey) {
                if (e.code === 'KeyG') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation?.();
                    window.__maisCombo = { last: 'g', at: Date.now() };
                    return;
                }
                const st = window.__maisCombo;
                if (st?.last === 'g' && Date.now() - st.at < 1000) {
                    if (e.code === 'KeyA') {
                        e.preventDefault();
                        go('/activities');
                    } else if (e.code === 'KeyP') {
                        e.preventDefault();
                        go('/profile');
                    } else if (e.code === 'KeyF') {
                        e.preventDefault();
                        go('/faculty-management'); // Вчителі
                    }
                    window.__maisCombo = { last: null, at: 0 };
                }
            }
        };

        // capture=true, щоб не блокувався батьківськими обробниками
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [go]);

    // 🔒 Автозакриття палетки при зміні маршруту (включно з кліками/переадресаціями)
    useEffect(() => {
        if (open) {
            setOpen(false);
            setQuery('');
        }
        // реагуємо на будь-які зміни локації
    }, [location.pathname, location.search, location.hash]); // eslint-disable-line react-hooks/exhaustive-deps

    const ctx = useMemo(
        () => ({
            open,
            setOpen,
            query,
            setQuery,
            actions,
            registerActions,
        }),
        [open, query, actions, registerActions]
    );

    return (
        <Ctx.Provider value={ctx}>
            {children}
            {/* Глобальна палетка — змонтована один раз у корені */}
            <CommandPalette
                open={open}
                onClose={() => {
                    setOpen(false);
                    setQuery('');
                }}
                actions={actions}
                query={query}
                onQuery={setQuery}
            />
        </Ctx.Provider>
    );
};
