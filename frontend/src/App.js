import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import GuidelinesPublic from "@/pages/GuidelinesPublic";
import Dashboard from "@/pages/Dashboard";
import Book from "@/pages/Book";
import MyBookings from "@/pages/MyBookings";
import MyTeam from "@/pages/MyTeam";
import Profile from "@/pages/Profile";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Approvals from "@/pages/admin/Approvals";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminTeams from "@/pages/admin/AdminTeams";
import AdminSeats from "@/pages/admin/AdminSeats";
import AdminViolations from "@/pages/admin/AdminViolations";
import AdminReports from "@/pages/admin/AdminReports";
import AdminGuidelines from "@/pages/admin/AdminGuidelines";
import AdminConfiguration from "@/pages/admin/AdminConfiguration";
import "@/App.css";

function ProtectedRoute({ children, adminOnly }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-navy">
        <div className="animate-pulse text-sm label-eyebrow">Loading workspace…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !["super_admin", "admin"].includes(user.role)) return <Navigate to="/dashboard" replace />;
  if (user.status === "pending") return <Navigate to="/login?msg=pending" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/guidelines" element={<GuidelinesPublic />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/book" element={<ProtectedRoute><Book /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute><MyTeam /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/approvals" element={<ProtectedRoute adminOnly><Approvals /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/teams" element={<ProtectedRoute adminOnly><AdminTeams /></ProtectedRoute>} />
          <Route path="/admin/seats" element={<ProtectedRoute adminOnly><AdminSeats /></ProtectedRoute>} />
          <Route path="/admin/violations" element={<ProtectedRoute adminOnly><AdminViolations /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute adminOnly><AdminReports /></ProtectedRoute>} />
          <Route path="/admin/guidelines" element={<ProtectedRoute adminOnly><AdminGuidelines /></ProtectedRoute>} />
          <Route path="/admin/configuration" element={<ProtectedRoute adminOnly><AdminConfiguration /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
