import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import AuditForm from './pages/AuditForm';
import HistoryPage from './pages/HistoryPage';
import ViewAuditPage from './pages/ViewAuditPage';
import AccountPage from './pages/AccountPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import GlobalLoader from './components/GlobalLoader';
import NotificationContainer from './components/NotificationContainer';

const PrivateRoute = ({ children, roles }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <GlobalLoader />;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (userData && userData.status === 'PendingApproval') {
      return <Navigate to="/pending-approval" />;
  }

  if (roles && userData && !roles.includes(userData.role)) {
    return <Navigate to="/home" />;
  }

  return children;
};


function App() {
  const { loading } = useAuth();

  return (
    <>
      <NotificationContainer />
      {loading ? <GlobalLoader /> : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />

          <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute><AuditForm /></PrivateRoute>} />
          <Route path="/audit/:id" element={<PrivateRoute><AuditForm /></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
          <Route path="/view-audit/:id" element={<PrivateRoute><ViewAuditPage /></PrivateRoute>} />
          <Route path="/account" element={<PrivateRoute><AccountPage /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
      )}
    </>
  );
}

export default App;