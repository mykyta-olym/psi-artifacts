// src/Routes.jsx
import React, { Suspense, useEffect } from "react";
import { Routes as RouterRoutes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import ScrollToTop from "components/ScrollToTop";
import NotFound from "pages/NotFound";
import Login from "pages/Login";
import ActivateAccount from "pages/ActivateAccount";
import GradeManagement from "pages/grade-management";
import AttendanceTracking from "pages/attendance-tracking";
import StudentManagement from "pages/student-management";
import ClassScheduleManagement from "pages/class-schedule-management";
import TeacherDashboard from "pages/teacher-dashboard";
import StudentDashboard from "pages/student-dashboard";
import Activities from "pages/activities";
import FacultyPage from "pages/faculty-management";
import HelpPage from "pages/help";
import { CommandCenterProvider } from "providers/CommandCenterProvider";
import ProfilePage from "pages/profile";
import ChatPage from "pages/chat";
import ForgotPassword from "pages/ForgotPassword";
import LoaderOverlay from "components/LoaderOverlay";
import StudentStudies from "./pages/student-studies/StudentStudies";
import Terminy from "pages/terminy";
import TerminyTeacher from "pages/terminy/TeacherExamTerms";
import Zapis from "pages/zapis";
import Anketa from "pages/anketa";
import FinalThesisPage from "pages/final-thesis/FinalThesis";
import FinalThesisTeacher from "pages/final-thesis/FinalThesisTeacher";
import PrintReportsPage from "pages/print-reports";
import Welcome from "pages/Welcome";
import StudySelection from "pages/study-selection/index.jsx";
import ResourceManagement from "pages/resource-management";
import { ToastsProvider, useToasts } from "components/ui/Toasts";
import { setGlobalToastNotifier } from "utils/globalErrorHandler";

// Component to setup global error handler with toast notifier
function GlobalErrorHandlerSetup() {
    const { notify } = useToasts();
    
    useEffect(() => {
        if (notify) {
            setGlobalToastNotifier(notify);
        }
    }, [notify]);
    
    return null;
}

const PATH_EXISTS = new Set([
    "/",
    "/login",
    "/activate",
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
    "/terminy/teacher",
    "/zapis",
    "/anketa",
    "/final-thesis",
    "/final-thesis/teacher",
    "/print-reports",
    "/study-select",
    "/resource-management",
]);

const HOME_BY_ROLE = {
    teacher: "/teacher-dashboard",
    student: "/student-dashboard",
};

const getHomeForRole = (role) => {
    const target = HOME_BY_ROLE[role] || "/login";
    return PATH_EXISTS.has(target) ? target : "/login";
};

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoaderOverlay label="Synchronizing data..." />;
    return user ? children : <Navigate to="/login" replace />;
};

const RoleRoute = ({ allowedRoles, children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoaderOverlay label="Synchronizing data..." />;
    if (!user) return <Navigate to="/login" replace />;
    if (!allowedRoles.includes(user.role)) {
        const safe = getHomeForRole(user.role);
        return <Navigate to={safe} replace />;
    }
    return children;
};

const AuthGate = () => {
    const { user, loading } = useAuth();
    if (loading) return <LoaderOverlay label="Preparing the workspace..." />;
    if (!user) return <Navigate to="/login" replace />;
    const safe = getHomeForRole(user.role);
    return <Navigate to={safe} replace />;
};

const Routes = () => {
    return (
        <CommandCenterProvider>
            <ToastsProvider>
                <GlobalErrorHandlerSetup />
            <ScrollToTop />
            <Suspense fallback={<LoaderOverlay label="Loading modules..." />}>
                <RouterRoutes>
                    <Route path="/" element={<Welcome />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/activate" element={<ActivateAccount />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    <Route
                        path="/study-select"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["student"]}>
                                    <StudySelection />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teacher-dashboard"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher"]}>
                                    <TeacherDashboard />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/student-dashboard"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["student"]}>
                                    <StudentDashboard />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/grade-management"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher"]}>
                                    <GradeManagement />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/attendance-tracking"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher"]}>
                                    <AttendanceTracking />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/student-management"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher", "student"]}>
                                    <StudentManagement />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/class-schedule-management"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher", "student"]}>
                                    <ClassScheduleManagement />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/activities"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher", "student"]}>
                                    <Activities />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/faculty-management"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher", "student"]}>
                                    <FacultyPage />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <ProfilePage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/chat"
                        element={
                            <ProtectedRoute>
                                <ChatPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/student-studies"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["student"]}>
                                    <StudentStudies />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/terminy"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["student"]}>
                                    <Terminy />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/terminy/teacher"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher"]}>
                                    <TerminyTeacher />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/zapis"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["student"]}>
                                    <Zapis />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/anketa"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher", "student"]}>
                                    <Anketa />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/final-thesis"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["student"]}>
                                    <FinalThesisPage />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/final-thesis/teacher"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher"]}>
                                    <FinalThesisTeacher />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/print-reports"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher", "student"]}>
                                    <PrintReportsPage />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/resource-management"
                        element={
                            <ProtectedRoute>
                                <RoleRoute allowedRoles={["teacher"]}>
                                    <ResourceManagement />
                                </RoleRoute>
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/help" element={<HelpPage />} />
                    <Route path="*" element={<NotFound />} />
                </RouterRoutes>
            </Suspense>
            </ToastsProvider>
        </CommandCenterProvider>
    );
};

export default Routes;