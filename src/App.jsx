import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import ProtectedRoute from "./components/ProtectedRoute";

// Public Pages
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";

// HR Pages
import DashboardPage from "./pages/DashboardPage";
import JobPostingPage from "./pages/JobPostingPage";
import CandidatePage from "./pages/CandidatePage";
import JobCandidatesPage from "./pages/JobCandidatesPage";
import ReportsPage from "./pages/ReportsPage";
import ActivityLogPage from "./pages/ActivityLogPage";

// Applicant Pages
import DashboardApplicantPage from "./pages/DashboardApplicantPage";
import BrowseJobsPage from "./pages/BrowseJobsPage";
import MyApplicationsPage from "./pages/MyApplicationsPage";
import ApplicantProfilePage from "./pages/ApplicantProfilePage";

// Create a wrapper for public routes that redirects if logged in
function PublicRoute({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (session) {
    const userRole = session.user?.user_metadata?.role;
    if (userRole === 'hr') {
      return <Navigate to="/hr/dashboard" replace />;
    } else {
      return <Navigate to="/applicant/dashboard" replace />;
    }
  }

  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'sans-serif'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ==================== PUBLIC ROUTES ==================== */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/signup" 
          element={
            <PublicRoute>
              <SignUpPage />
            </PublicRoute>
          } 
        />

        {/* ==================== ROOT REDIRECT ==================== */}
        <Route 
          path="/" 
          element={
            session ? (
              session.user?.user_metadata?.role === 'hr' 
                ? <Navigate to="/hr/dashboard" replace />
                : <Navigate to="/applicant/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* ==================== HR ROUTES ==================== */}
        <Route 
          path="/hr/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['hr']}>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        
 <Route 
          path="/hr/activitylog" 
          element={
            <ProtectedRoute allowedRoles={['hr']}>
              <ActivityLogPage />
            </ProtectedRoute>
          } 
        />


        <Route 
          path="/hr/jobs" 
          element={
            <ProtectedRoute allowedRoles={['hr']}>
              <JobPostingPage />
            </ProtectedRoute>
          } 
        />
        
      <Route 
          path="/hr/reports" 
          element={
            <ProtectedRoute allowedRoles={['hr']}>
              <ReportsPage />
            </ProtectedRoute>
          } 
        />

        {/* Recent Applications - Navbar link */}
        <Route 
          path="/hr/candidates" 
          element={
            <ProtectedRoute allowedRoles={['hr']}>
              <CandidatePage />
            </ProtectedRoute>
          } 
        />

        {/* Job-Specific Candidates - Drill down from jobs page */}
        <Route 
          path="/hr/jobs/:jobId/candidates" 
          element={
            <ProtectedRoute allowedRoles={['hr']}>
              <JobCandidatesPage />
            </ProtectedRoute>
          } 
        />

        {/* ==================== APPLICANT ROUTES ==================== */}
        <Route 
          path="/applicant/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['applicant']}>
              <DashboardApplicantPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/applicant/jobs" 
          element={
            <ProtectedRoute allowedRoles={['applicant']}>
              <BrowseJobsPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/applicant/applications" 
          element={
            <ProtectedRoute allowedRoles={['applicant']}>
              <MyApplicationsPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/applicant/profile" 
          element={
            <ProtectedRoute allowedRoles={['applicant']}>
              <ApplicantProfilePage />
            </ProtectedRoute>
          } 
        />

        {/* ==================== CATCH ALL ==================== */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;