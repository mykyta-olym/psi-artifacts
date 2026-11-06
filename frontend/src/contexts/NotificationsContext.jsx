// src/contexts/NotificationsContext.jsx
import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { getActivities } from "../data/activitiesApi";
import { useAuth } from "./AuthContext";

const NotificationsContext = createContext(null);
export const useNotifications = () => useContext(NotificationsContext);

/**
 * NotificationsContext with real activity feed from API
 */
export default function NotificationsProvider({ children }) {
    const { user } = useAuth();
    const [activityFeed, setActivityFeed] = useState([]);
    const [activitiesLoading, setActivitiesLoading] = useState(false);

    const loadActivities = useCallback(async () => {
        if (!user?.email) {
            setActivityFeed([]);
            return;
        }
        
        setActivitiesLoading(true);
        try {
            const result = await getActivities({ 
                perPage: 50,
                sort: 'time',
                dir: 'desc'
            });
            let items = result?.items || result?.data || result?.activities || [];
            
            // Backend already filters activities appropriately by role
            // Teachers: see ALL activities
            // Students: see only their own activities
            // No additional filtering needed here
            
            setActivityFeed(Array.isArray(items) ? items : []);
        } catch (err) {
            console.error('[NotificationsContext] Failed to load activities:', err);
            setActivityFeed([]);
        } finally {
            setActivitiesLoading(false);
        }
    }, [user?.email, user?.role]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    const value = useMemo(() => ({
        notifications: [],
        unread: [],
        readList: [],
        unreadCount: 0,
        setNotifications: () => {},
        push: () => {},
        markRead: () => {},
        markUnread: () => {},
        markAllRead: () => {},
        clearAll: () => {},
        activityFeed,
        activitiesLoading,
        addActivity: () => {},
        clearActivity: () => {},
        resolveActivities: () => Promise.resolve(),
        markActivitiesNeedsAction: () => Promise.resolve(),
        removeActivities: () => Promise.resolve(),
        notifyScheduleChange: () => {},
        setGroupMembers: () => {},
        getGroupMembers: () => [],
        queueForUsers: () => {},
        refreshActivities: loadActivities,
    }), [activityFeed, activitiesLoading, loadActivities]);

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
