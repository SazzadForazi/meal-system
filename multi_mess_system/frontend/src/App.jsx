import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import RequestMess from "./pages/RequestMess.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Members from "./pages/Members.jsx";
import Meals from "./pages/Meals.jsx";
import Bazaar from "./pages/Bazaar.jsx";
import Reports from "./pages/Reports.jsx";
import { getToken, api } from "./lib/api.js";
import { refreshMe } from "./lib/auth.js";

function RequireAuth({ children }) {
  const token = getToken();
  const location = useLocation();
  if (!token) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setBooted(true);
        return;
      }
      try {
        await refreshMe();
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  if (!booted) return <div className="loading">Loading…</div>;

  return (
    <Routes>
      <Route path="/auth/login" element={<Login />} />
      <Route path="/request-mess" element={<RequestMess />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/members"
        element={
          <RequireAuth>
            <Layout>
              <Members />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/meals"
        element={
          <RequireAuth>
            <Layout>
              <Meals />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/bazaar"
        element={
          <RequireAuth>
            <Layout>
              <Bazaar />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <Layout>
              <Reports />
            </Layout>
          </RequireAuth>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
