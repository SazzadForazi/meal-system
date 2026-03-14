import React from "react";
import { getUser } from "../lib/auth.js";
import SuperAdmin from "./SuperAdmin.jsx";

export default function Dashboard() {
  const user = getUser();
  if (user?.role === "super_admin") return <SuperAdmin />;
  return (
    <div>
      <h1 className="h1">Dashboard</h1>
      <div className="card">
        <div className="muted">Use the sidebar to manage members, meals, bazaar, and reports.</div>
      </div>
    </div>
  );
}

