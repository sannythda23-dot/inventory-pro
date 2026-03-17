/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ActivityLogs from './pages/ActivityLogs';
import Profile from './pages/Profile';
import Login from './pages/Login';

export default function App() {
  const [user, setUser] = React.useState<any>(null);
  const [role, setRole] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setRole(userDoc.data().role);
        } else {
          // Fallback if doc doesn't exist yet (e.g., during login process)
          setRole(firebaseUser.email === 'sannythda23@gmail.com' ? 'admin' : 'user');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-10 h-10 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" replace /> : <Login />} 
          />
          
          <Route 
            path="/" 
            element={
              user ? (
                <Layout isAdmin={isAdmin} user={user}>
                  <Dashboard />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route 
            path="/inventory" 
            element={
              user ? (
                <Layout isAdmin={isAdmin} user={user}>
                  <Inventory isAdmin={isAdmin} />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route 
            path="/logs" 
            element={
              user && isAdmin ? (
                <Layout isAdmin={isAdmin} user={user}>
                  <ActivityLogs />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />

          <Route 
            path="/profile" 
            element={
              user ? (
                <Layout isAdmin={isAdmin} user={user}>
                  <Profile />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
