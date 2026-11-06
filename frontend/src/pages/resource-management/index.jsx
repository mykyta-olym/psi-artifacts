// src/pages/resource-management/index.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import TabBar from '../../components/ui/TabBar';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Reveal from '../../components/motion/Reveal';
import { motion } from 'framer-motion';
import { ToastsProvider, useToasts } from '../../components/ui/Toasts';
import SubjectsManagement from './components/SubjectsManagement';
import FacultiesManagement from './components/FacultiesManagement';
import ProgramsManagement from './components/ProgramsManagement';
import DepartmentsManagement from './components/DepartmentsManagement';
import RoomsManagement from './components/RoomsManagement';
import EquipmentManagement from './components/EquipmentManagement';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatLastLogin } from '../../utils/datetime';
import { ANIMATION_DELAYS } from '../../constants/animations';
import { fetchRooms } from '../../data/roomsApi';
import { fetchFaculty } from '../../data/maisApiAdapter';
import useDataUpdates from '../../hooks/useDataUpdates';
import useResourcesHub from '../../hooks/useResourcesHub';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';

const ResourceManagementInner = () => {
  const [activeTab, setActiveTab] = useState('subjects');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const { user, userProfile } = useAuth() || {};
  const navigate = useNavigate();
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
  
  // Load rooms and faculty for dropdowns
  const loadSharedData = useCallback(async () => {
    try {
      const [roomsData, facultyData] = await Promise.all([
        fetchRooms(),
        fetchFaculty({ pageSize: 500, sort: 'fullName', order: 'asc' })
      ]);
      console.log('[ResourceManagement] Loaded rooms:', roomsData?.length);
      console.log('[ResourceManagement] Loaded faculty:', facultyData?.length, facultyData);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setFaculty(Array.isArray(facultyData) ? facultyData : []);
    } catch (error) {
      console.error('Failed to load shared data:', error);
      setRooms([]);
      setFaculty([]);
    }
  }, []);
  
  useEffect(() => {
    loadSharedData();
  }, [loadSharedData]);

  // Handle real-time updates via SignalR
  const handleDataUpdate = useCallback((payload) => {
    console.log('[ResourceManagement] Received data update:', payload);
    if (payload?.type === 'room.updated' || payload?.type === 'equipment.updated') {
      notify('info', 'Resources have been updated', { title: 'Real-time Update' });
      loadSharedData();
    }
  }, [loadSharedData, notify]);

  useDataUpdates(handleDataUpdate);

  // Use ResourcesHub for real-time resource updates
  useResourcesHub({
    onResourceAdded: useCallback((payload) => {
      console.log('[ResourceManagement] Resource added via ResourcesHub:', payload);
      handleDataUpdate({ type: 'room.updated', action: 'added', ...payload });
    }, [handleDataUpdate]),
    onResourceUpdated: useCallback((payload) => {
      console.log('[ResourceManagement] Resource updated via ResourcesHub:', payload);
      handleDataUpdate({ type: 'room.updated', action: 'updated', ...payload });
    }, [handleDataUpdate]),
    onResourceRemoved: useCallback((payload) => {
      console.log('[ResourceManagement] Resource removed via ResourcesHub:', payload);
      handleDataUpdate({ type: 'room.updated', action: 'removed', ...payload });
    }, [handleDataUpdate]),
    onResourceBooked: useCallback((payload) => {
      console.log('[ResourceManagement] Resource booked via ResourcesHub:', payload);
      handleDataUpdate({ type: 'room.updated', action: 'booked', ...payload });
    }, [handleDataUpdate])
  });

  const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';
  
  const handleLogout = () => navigate('/login');

  return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Header 
          userRole={user?.role || 'teacher'} 
          userName={user?.name || userProfile?.fullName || 'User'} 
          onLogout={handleLogout} 
        />
        <RoleSidebar
          userRole={user?.role || 'teacher'}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <div
          className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}
          role="main"
          aria-label="Resource management"
        >
          <main className="flex-1">
            <div className="px-6 pt-20 pb-6">
              <NavigationBreadcrumb />

              <Reveal as={motion.section} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true} className="mb-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                      <Icon name="Database" size={28} />
                      Resource Management
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Manage subjects, faculties, departments, programs, rooms, and equipment
                    </p>
                  </div>
                </div>
                
                {/* Quick Action Panel */}
                <QuickActionPanel
                  actions={[
                    {
                      label: 'View Statistics',
                      icon: 'BarChart3',
                      variant: 'primary',
                      onClick: () => {
                        // Show stats modal or navigate to stats page
                        console.log('View Statistics clicked');
                      },
                    },
                    {
                      label: 'Import Data',
                      icon: 'Upload',
                      variant: 'default',
                      onClick: () => {
                        // Open import modal
                        console.log('Import Data clicked');
                      },
                    },
                    {
                      label: 'Export Data',
                      icon: 'Download',
                      variant: 'default',
                      onClick: () => {
                        // Export current data
                        console.log('Export Data clicked');
                      },
                    },
                  ]}
                />
              </Reveal>

              {/* Tabs */}
              <Reveal as={motion.div} delay={ANIMATION_DELAYS.TABS} variant="keycap" waitForLoaders={true} className="mb-6">
                <div className="bg-card rounded-lg border border-border p-3">
                  <TabBar
                    value={activeTab}
                    onChange={setActiveTab}
                    items={[
                      { value: 'subjects', label: 'Subjects', icon: 'Book' },
                      { value: 'faculties', label: 'Faculties', icon: 'Building2' },
                      { value: 'departments', label: 'Departments', icon: 'Building' },
                      { value: 'programs', label: 'Programs', icon: 'GraduationCap' },
                      { value: 'rooms', label: 'Rooms', icon: 'DoorOpen' },
                      { value: 'equipment', label: 'Equipment', icon: 'Package' },
                    ]}
                    className="gap-2"
                  />
                </div>
              </Reveal>

              {/* Tab Content */}
              {activeTab === 'subjects' && (
                <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                  <SubjectsManagement />
                </Reveal>
              )}
              
              {activeTab === 'faculties' && (
                <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                  <FacultiesManagement />
                </Reveal>
              )}
              
              {activeTab === 'departments' && (
                <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                  <DepartmentsManagement />
                </Reveal>
              )}
              
              {activeTab === 'programs' && (
                <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                  <ProgramsManagement />
                </Reveal>
              )}
              
              {activeTab === 'rooms' && (
                <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                  <RoomsManagement onRoomsChange={loadSharedData} />
                </Reveal>
              )}
              
              {activeTab === 'equipment' && (
                <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                  <EquipmentManagement rooms={rooms} faculty={faculty} />
                </Reveal>
              )}
            </div>

            <PageFooter
              left={[
                'MAIS 2.0 • Teacher Portal',
                lastLoginLabel,
              ]}
              actions={[
                <Button
                  key="help"
                  variant="ghost"
                  size="sm"
                  iconName="HelpCircle"
                  onClick={() => navigate('/help')}
                >
                  Help
                </Button>,
              ]}
            />
          </main>
        </div>
      </div>
  );
};

const ResourceManagement = () => (
  <ToastsProvider>
    <ResourceManagementInner />
  </ToastsProvider>
);

export default ResourceManagement;

