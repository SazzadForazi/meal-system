import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getUser, logout } from "../lib/auth.js";

export default function Layout({ children }) {
  const user = getUser();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/auth/login");
  };

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">Multi-Mess</div>
        <div className="who">
          <div className="whoName">{user?.name || "Unknown"}</div>
          <div className="whoRole">{user?.role || ""}</div>
        </div>

        <nav className="nav">
          {user?.role === "super_admin" ? (
            <NavLink to="/dashboard" className="navItem">
              Messes
            </NavLink>
          ) : (
            <>
              <NavLink to="/dashboard" className="navItem">
                Dashboard
              </NavLink>
              <NavLink to="/members" className="navItem">
                Members
              </NavLink>
              <NavLink to="/meals" className="navItem">
                Meals
              </NavLink>
              <NavLink to="/bazaar" className="navItem">
                Bazaar
              </NavLink>
              <NavLink to="/reports" className="navItem">
                Reports
              </NavLink>
            </>
          )}
        </nav>

        <button className="btn danger" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="main">
        <div className="page">{children}</div>
      </main>
    </div>
  );
}

