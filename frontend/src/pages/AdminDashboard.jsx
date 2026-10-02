import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Copy,
  Database,
  Eye,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Timer,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import ConfirmDialog from "../components/ConfirmDialog";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const {
    admin,
    adminFetch,
    adminLogout,
  } = useAdminAuth();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] =
    useState(null);

  const [loginAttempts, setLoginAttempts] =
    useState([]);

  const [sessions, setSessions] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [activeSection, setActiveSection] =
    useState("overview");

  const [resetPassword, setResetPassword] =
    useState(null);

  const [showMobileMenu, setShowMobileMenu] =
    useState(false);

  const [copiedPassword, setCopiedPassword] =
    useState(false);

  const [userMenu, setUserMenu] =
    useState(null);

  const [confirmState, setConfirmState] = useState({ open: false });
  const confirmResolverRef = useRef(null);

  const requestConfirmation = ({ title, message, confirmText = "Confirm", danger = false }) =>
    new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({ open: true, title, message, confirmText, danger });
    });

  const closeConfirmation = (confirmed) => {
    const resolve = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmState({ open: false });
    resolve?.(confirmed);
  };

  const showMessage = (text) => {
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  };

  const handleAuthError = (response) => {
    if (response.status === 401) {
      navigate("/admin/login", {
        replace: true,
      });

      return true;
    }

    return false;
  };

  const loadDashboard = async (
    showLoader = true
  ) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const [
        statsResponse,
        usersResponse,
      ] = await Promise.all([
        adminFetch("/admin/stats"),
        adminFetch("/admin/users"),
      ]);

      if (
        handleAuthError(statsResponse) ||
        handleAuthError(usersResponse)
      ) {
        return;
      }

      const statsData =
        await statsResponse.json();

      const usersData =
        await usersResponse.json();

      if (!statsResponse.ok) {
        throw new Error(
          statsData.message ||
            "Unable to load statistics."
        );
      }

      if (!usersResponse.ok) {
        throw new Error(
          usersData.message ||
            "Unable to load users."
        );
      }

      setStats(statsData.stats || null);
      setUsers(usersData.users || []);
    } catch (err) {
      console.error(
        "Dashboard loading error:",
        err
      );

      setError(
        err.message ||
          "Unable to load admin dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadLoginAttempts = async () => {
    try {
      const response = await adminFetch(
        "/admin/login-attempts"
      );

      if (handleAuthError(response)) {
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load login attempts."
        );
      }

      setLoginAttempts(
        data.attempts || []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load login attempts."
      );
    }
  };

  const loadSessions = async () => {
    try {
      const response = await adminFetch(
        "/admin/sessions"
      );

      if (handleAuthError(response)) {
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load active sessions."
        );
      }

      setSessions(data.sessions || []);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load active sessions."
      );
    }
  };


  const handleDeleteLoginAttempt = async (attempt) => {
    const confirmed = await requestConfirmation({
      title: "Delete login attempt",
      message: `Delete the login attempt for ${attempt.email}? This action cannot be undone.`,
      confirmText: "Delete Attempt",
      danger: true,
    });

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await adminFetch(
        `/admin/login-attempts/${attempt.id}`,
        { method: "DELETE" }
      );

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to delete login attempt.");
      }

      setLoginAttempts((current) =>
        current.filter((item) => item.id !== attempt.id)
      );
      showMessage("Login attempt deleted.");
    } catch (err) {
      setError(err.message || "Unable to delete login attempt.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearLoginAttempts = async () => {
    const confirmed = await requestConfirmation({
      title: "Clear all login attempts",
      message: "Delete all recorded login attempts? This action cannot be undone.",
      confirmText: "Clear All",
      danger: true,
    });

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await adminFetch("/admin/login-attempts", {
        method: "DELETE",
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to clear login attempts.");
      }

      setLoginAttempts([]);
      showMessage(data.message || "All login attempts cleared.");
    } catch (err) {
      setError(err.message || "Unable to clear login attempts.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeActiveSession = async (session) => {
    const name = session.user?.name || session.user?.email || "this user";
    const confirmed = await requestConfirmation({
      title: "Revoke session",
      message: `Revoke the active session for ${name}?`,
      confirmText: "Revoke Session",
      danger: true,
    });

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await adminFetch(
        `/admin/sessions/${session.id}`,
        { method: "DELETE" }
      );

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to revoke session.");
      }

      setSessions((current) =>
        current.filter((item) => item.id !== session.id)
      );
      showMessage("Session revoked.");
    } catch (err) {
      setError(err.message || "Unable to revoke session.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAllActiveSessions = async () => {
    const confirmed = await requestConfirmation({
      title: "Revoke all active sessions",
      message: "Revoke every currently active authentication session? Users will need to sign in again.",
      confirmText: "Revoke All",
      danger: true,
    });

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await adminFetch("/admin/sessions", {
        method: "DELETE",
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to revoke active sessions.");
      }

      setSessions([]);
      showMessage(data.message || "All active sessions revoked.");
    } catch (err) {
      setError(err.message || "Unable to revoke active sessions.");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadLoginAttempts();
  }, []);

  useEffect(() => {
    setShowMobileMenu(false);

    if (activeSection === "login-attempts") {
      loadLoginAttempts();
    }

    if (activeSection === "sessions") {
      loadSessions();
    }
  }, [activeSection]);

  const handleLogout = async () => {
    await adminLogout();

    navigate("/admin/login", {
      replace: true,
    });
  };

  const handleViewUser = async (userId) => {
    setActionLoading(true);
    setError("");

    try {
      const response = await adminFetch(
        `/admin/users/${userId}`
      );

      if (handleAuthError(response)) {
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load user."
        );
      }

      setSelectedUser(data.user);
      setUserMenu(null);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load user details."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const action = user.isActive
      ? "disable"
      : "enable";

    const confirmed = await requestConfirmation({
      title: `${action === "disable" ? "Disable" : "Enable"} user`,
      message: `Are you sure you want to ${action} ${user.name}?`,
      confirmText: action === "disable" ? "Disable User" : "Enable User",
      danger: action === "disable",
    });

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await adminFetch(
        `/admin/users/${user.id}/status`,
        {
          method: "PATCH",
          body: {
            isActive: !user.isActive,
          },
        }
      );

      if (handleAuthError(response)) {
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to update user status."
        );
      }

      showMessage(
        `User ${action}d successfully.`
      );

      setUserMenu(null);

      await loadDashboard(false);

      if (
        selectedUser &&
        selectedUser.id === user.id
      ) {
        await handleViewUser(user.id);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to update user status."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSessions = async (user) => {
    const confirmed = await requestConfirmation({
      title: "Revoke active sessions",
      message: `Revoke all active sessions for ${user.name}?`,
      confirmText: "Revoke Sessions",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await adminFetch(
        `/admin/users/${user.id}/revoke-sessions`,
        {
          method: "POST",
        }
      );

      if (handleAuthError(response)) {
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to revoke sessions."
        );
      }

      showMessage(
        "All user sessions were revoked."
      );

      setUserMenu(null);

      await loadDashboard(false);

      if (
        selectedUser &&
        selectedUser.id === user.id
      ) {
        await handleViewUser(user.id);
      }

      if (activeSection === "sessions") {
        await loadSessions();
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to revoke sessions."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (user) => {
    const confirmed = await requestConfirmation({
      title: "Generate temporary password",
      message: `Generate a new temporary password for ${user.name}?`,
      confirmText: "Generate Password",
    });

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setError("");
    setResetPassword(null);
    setCopiedPassword(false);

    try {
      const response = await adminFetch(
        `/admin/users/${user.id}/reset-password`,
        {
          method: "POST",
        }
      );

      if (handleAuthError(response)) {
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to reset password."
        );
      }

      setResetPassword({
        user: user.name,
        email: user.email,
        password:
          data.temporaryPassword || "",
      });

      showMessage(
        "Temporary password generated."
      );

      setUserMenu(null);
    } catch (err) {
      setError(
        err.message ||
          "Unable to reset password."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRole = async (user) => {
    if (user.id === admin?.id) {
      showMessage("You cannot change your own admin role.");
      return;
    }
    const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    const confirmed = await requestConfirmation({
      title: "Change user role",
      message: `Change ${user.name}'s role to ${nextRole}?`,
      confirmText: `Make ${nextRole}`,
      danger: nextRole === "USER",
    });
    if (!confirmed) return;
    setActionLoading(true);
    setError("");
    try {
      const response = await adminFetch(`/admin/users/${user.id}/role`, {
        method: "PATCH",
        body: { role: nextRole },
      });
      if (handleAuthError(response)) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to change user role.");
      showMessage(`User role changed to ${nextRole}.`);
      setUserMenu(null);
      await loadDashboard(false);
      if (selectedUser?.id === user.id) await handleViewUser(user.id);
    } catch (err) {
      setError(err.message || "Unable to change user role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStudyHistory = async (user) => {
    const confirmed = await requestConfirmation({
      title: "Delete study history",
      message: `Delete ALL recorded study history for ${user.name}? This cannot be undone.`,
      confirmText: "Delete History",
      danger: true,
    });
    if (!confirmed) return;
    setActionLoading(true);
    setError("");
    try {
      const response = await adminFetch(`/admin/users/${user.id}/study-history`, { method: "DELETE" });
      if (handleAuthError(response)) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete study history.");
      showMessage(`Deleted ${data.deletedCount || 0} study history records.`);
      setUserMenu(null);
      if (selectedUser?.id === user.id) await handleViewUser(user.id);
      await loadDashboard(false);
    } catch (err) {
      setError(err.message || "Unable to delete study history.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearActiveTimer = async (user) => {
    const confirmed = await requestConfirmation({
      title: "Clear active timer",
      message: `Force-clear ${user.name}'s active timer? Any unsaved active time will not be added to history.`,
      confirmText: "Clear Timer",
      danger: true,
    });
    if (!confirmed) return;
    setActionLoading(true);
    setError("");
    try {
      const response = await adminFetch(`/admin/users/${user.id}/active-timer/clear`, { method: "POST" });
      if (handleAuthError(response)) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to clear active timer.");
      showMessage(data.message || "Active timer cleared.");
      setUserMenu(null);
      if (selectedUser?.id === user.id) await handleViewUser(user.id);
    } catch (err) {
      setError(err.message || "Unable to clear active timer.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmed = await requestConfirmation({
      title: `Delete ${user.name}?`,
      message: "This will permanently remove the user's account and associated study data.",
      confirmText: "Delete User",
      danger: true,
    });

    if (!confirmed) return;

    const secondConfirmation = await requestConfirmation({
      title: "This action cannot be undone",
      message: "The user's account and associated study data will be permanently deleted. Continue?",
      confirmText: "Yes, Delete Permanently",
      danger: true,
    });

    if (!secondConfirmation) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await adminFetch(
        `/admin/users/${user.id}`,
        {
          method: "DELETE",
        }
      );

      if (handleAuthError(response)) {
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to delete user."
        );
      }

      showMessage(
        "User deleted successfully."
      );

      setSelectedUser(null);
      setUserMenu(null);

      await loadDashboard(false);
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete user."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!resetPassword?.password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        resetPassword.password
      );

      setCopiedPassword(true);

      window.setTimeout(() => {
        setCopiedPassword(false);
      }, 2500);
    } catch {
      setError(
        "Unable to copy the temporary password."
      );
    }
  };

  const filteredUsers = useMemo(() => {
    const query =
      search.toLowerCase().trim();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name
          ?.toLowerCase()
          .includes(query) ||
        user.email
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          user.isActive) ||
        (statusFilter === "disabled" &&
          !user.isActive) ||
        (statusFilter === "admin" &&
          user.role === "ADMIN") ||
        (statusFilter === "user" &&
          user.role !== "ADMIN");

      return (
        matchesSearch && matchesStatus
      );
    });
  }, [users, search, statusFilter]);

  const activeUsers = users.filter(
    (user) => user.isActive
  ).length;

  const disabledUsers = users.filter(
    (user) => !user.isActive
  ).length;

  const adminUsers = users.filter(
    (user) => user.role === "ADMIN"
  ).length;

  const successfulLogins =
    loginAttempts.filter(
      (attempt) => attempt.successful
    ).length;

  const failedLogins =
    loginAttempts.filter(
      (attempt) => !attempt.successful
    ).length;

  const formatDate = (date) => {
    if (!date) {
      return "Never";
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "Unknown";
    }

    return parsed.toLocaleString();
  };

  const formatRelativeDate = (date) => {
    if (!date) {
      return "Never";
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "Unknown";
    }

    const difference =
      Date.now() - parsed.getTime();

    const minutes = Math.floor(
      difference / 60000
    );

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(
      minutes / 60
    );

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(
      hours / 24
    );

    if (days < 30) {
      return `${days}d ago`;
    }

    return parsed.toLocaleDateString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) {
      return "0 min";
    }

    const minutes = Math.floor(
      Number(seconds) / 60
    );

    const hours = Math.floor(
      minutes / 60
    );

    const remainingMinutes =
      minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }

    return `${remainingMinutes}m`;
  };

  const navigationItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "users",
      label: "Users",
      icon: Users,
      count: users.length,
    },
    {
      id: "login-attempts",
      label: "Login Attempts",
      icon: Shield,
      count: loginAttempts.length,
    },
    {
      id: "sessions",
      label: "Active Sessions",
      icon: Activity,
      count: sessions.length,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-purple-500" />
          </div>

          <p className="text-sm font-medium text-zinc-300">
            Loading admin dashboard
          </p>

          <p className="mt-1 text-xs text-zinc-600">
            Preparing your control center...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#080808]/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setShowMobileMenu(
                  (current) => !current
                )
              }
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white md:hidden"
            >
              {showMobileMenu ? (
                <X size={19} />
              ) : (
                <Menu size={19} />
              )}
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-900/20">
              <ShieldCheck
                size={19}
                className="text-white"
              />
            </div>

            <div>
              <h1 className="text-sm font-semibold sm:text-base">
                MPSC Tracker
              </h1>

              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                <p className="text-[10px] text-zinc-500 sm:text-xs">
                  Administrator Control Center
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                loadDashboard(false)
              }
              disabled={refreshing}
              className="hidden rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white disabled:opacity-50 sm:block"
              title="Refresh dashboard"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
            </button>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-zinc-200">
                {admin?.name ||
                  "Administrator"}
              </p>

              <p className="max-w-48 truncate text-[11px] text-zinc-600">
                {admin?.email}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-bold text-purple-300">
              {getInitials(
                admin?.name ||
                  "Administrator"
              )}
            </div>

            <button
              onClick={handleLogout}
              className="hidden items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400 sm:flex"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-[calc(100vh-64px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-zinc-800/80 bg-[#080808] md:block">
          <div className="sticky top-16 p-4">
            <div className="mb-6 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                  <Shield size={19} />
                </div>

                <div>
                  <p className="text-xs font-semibold text-zinc-200">
                    Admin Mode
                  </p>

                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    Full system access
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/5 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                <span className="text-[10px] text-emerald-400">
                  System operational
                </span>
              </div>
            </div>

            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
              Management
            </p>

            <nav className="space-y-1">
              {navigationItems.map(
                (item) => {
                  const Icon = item.icon;

                  return (
                    <NavButton
                      key={item.id}
                      active={
                        activeSection ===
                        item.id
                      }
                      icon={Icon}
                      label={item.label}
                      count={item.count}
                      onClick={() =>
                        setActiveSection(
                          item.id
                        )
                      }
                    />
                  );
                }
              )}
            </nav>

            <div className="mt-8 border-t border-zinc-900 pt-5">
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
                System
              </p>

              <div className="space-y-3 px-3">
                <SystemIndicator
                  icon={Server}
                  label="API Server"
                  status="Online"
                />

                <SystemIndicator
                  icon={Database}
                  label="Database"
                  status="Connected"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div className="fixed inset-x-0 top-16 z-30 border-b border-zinc-800 bg-[#080808] p-4 shadow-2xl md:hidden">
            <nav className="grid grid-cols-2 gap-2">
              {navigationItems.map(
                (item) => {
                  const Icon = item.icon;

                  return (
                    <NavButton
                      key={item.id}
                      active={
                        activeSection ===
                        item.id
                      }
                      icon={Icon}
                      label={item.label}
                      count={item.count}
                      onClick={() =>
                        setActiveSection(
                          item.id
                        )
                      }
                    />
                  );
                }
              )}
            </nav>

            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}

        {/* Main */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1600px]">
            {/* Alerts */}
            {error && (
              <AlertBox
                type="error"
                message={error}
                onClose={() =>
                  setError("")
                }
              />
            )}

            {message && (
              <AlertBox
                type="success"
                message={message}
                onClose={() =>
                  setMessage("")
                }
              />
            )}

            {/* Overview */}
            {activeSection ===
              "overview" && (
              <section>
                <PageHeader
                  eyebrow="Dashboard"
                  title="System Overview"
                  description="Monitor users, activity and security across the MPSC Tracker."
                  icon={LayoutDashboard}
                  action={
                    <button
                      onClick={() =>
                        loadDashboard(false)
                      }
                      disabled={refreshing}
                      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-purple-500/30 hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw
                        size={15}
                        className={
                          refreshing
                            ? "animate-spin"
                            : ""
                        }
                      />
                      Refresh
                    </button>
                  }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Total Users"
                    value={
                      stats?.totalUsers ??
                      users.length
                    }
                    subtitle="Registered accounts"
                    icon={Users}
                    accent="purple"
                  />

                  <StatCard
                    title="Active Users"
                    value={
                      stats?.activeUsers ??
                      activeUsers
                    }
                    subtitle="Currently enabled"
                    icon={UserCheck}
                    accent="emerald"
                  />

                  <StatCard
                    title="Disabled Users"
                    value={
                      stats?.inactiveUsers ??
                      disabledUsers
                    }
                    subtitle="Restricted accounts"
                    icon={UserMinus}
                    accent="red"
                  />

                  <StatCard
                    title="Administrators"
                    value={
                      stats?.adminUsers ??
                      adminUsers
                    }
                    subtitle="Privileged accounts"
                    icon={ShieldCheck}
                    accent="blue"
                  />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniStat
                    title="New Today"
                    value={
                      stats?.newUsersToday ??
                      0
                    }
                    icon={Zap}
                  />

                  <MiniStat
                    title="New This Week"
                    value={
                      stats?.newUsersThisWeek ??
                      0
                    }
                    icon={BarChart3}
                  />

                  <MiniStat
                    title="Study Sessions"
                    value={
                      stats?.totalStudySessions ??
                      0
                    }
                    icon={Timer}
                  />

                  <MiniStat
                    title="Currently Studying"
                    value={
                      stats?.currentlyStudying ??
                      0
                    }
                    icon={Activity}
                  />
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                          Study Activity
                        </p>

                        <h3 className="mt-1 text-lg font-semibold text-zinc-200">
                          Platform engagement
                        </h3>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                        <Activity size={19} />
                      </div>
                    </div>

                    <div className="mt-7 grid gap-4 sm:grid-cols-2">
                      <ActivityMetric
                        label="Total study time"
                        value={formatDuration(
                          stats?.totalStudyDuration ??
                            0
                        )}
                        icon={Clock3}
                      />

                      <ActivityMetric
                        label="Study sessions"
                        value={
                          stats?.totalStudySessions ??
                          0
                        }
                        icon={Timer}
                      />
                    </div>

                    <div className="mt-6">
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-zinc-600">
                          Active account ratio
                        </span>

                        <span className="text-zinc-400">
                          {users.length
                            ? Math.round(
                                (activeUsers /
                                  users.length) *
                                  100
                              )
                            : 0}
                          %
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-700"
                          style={{
                            width: `${
                              users.length
                                ? Math.round(
                                    (activeUsers /
                                      users.length) *
                                      100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                          System Health
                        </p>

                        <h3 className="mt-1 text-lg font-semibold text-zinc-200">
                          All systems operational
                        </h3>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2
                          size={19}
                        />
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      <HealthRow
                        icon={Server}
                        label="API Server"
                        value="Online"
                      />

                      <HealthRow
                        icon={Database}
                        label="PostgreSQL"
                        value="Connected"
                      />

                      <HealthRow
                        icon={Shield}
                        label="Authentication"
                        value="Protected"
                      />

                      <HealthRow
                        icon={Activity}
                        label="User tracking"
                        value="Running"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Recent Users
                      </p>

                      <h3 className="mt-1 text-lg font-semibold">
                        Latest accounts
                      </h3>
                    </div>

                    <button
                      onClick={() =>
                        setActiveSection(
                          "users"
                        )
                      }
                      className="flex items-center gap-1 text-xs text-purple-400 transition hover:text-purple-300"
                    >
                      View all
                      <ChevronRight
                        size={14}
                      />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {users
                      .slice(0, 4)
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() =>
                            handleViewUser(
                              user.id
                            )
                          }
                          className="group rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-purple-500/30 hover:bg-zinc-900"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={
                                user.name
                              }
                            />

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-200">
                                {user.name}
                              </p>

                              <p className="truncate text-[11px] text-zinc-600">
                                {user.email}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <StatusBadge
                              active={
                                user.isActive
                              }
                            />

                            <span className="text-[10px] text-zinc-700 transition group-hover:text-zinc-500">
                              {formatRelativeDate(
                                user.createdAt
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </section>
            )}

            {/* Users */}
            {activeSection === "users" && (
              <section>
                <PageHeader
                  eyebrow="Management"
                  title="Users"
                  description="Search, inspect and manage registered MPSC Tracker accounts."
                  icon={Users}
                  action={
                    <button
                      onClick={() =>
                        loadDashboard(false)
                      }
                      disabled={refreshing}
                      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-purple-500/30 hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw
                        size={15}
                        className={
                          refreshing
                            ? "animate-spin"
                            : ""
                        }
                      />
                      Refresh
                    </button>
                  }
                />

                <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                      <Search
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
                      />

                      <input
                        type="search"
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Search by name or email..."
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500/50"
                      />
                    </div>

                    <div className="flex gap-2 overflow-x-auto">
                      {[
                        ["all", "All"],
                        [
                          "active",
                          "Active",
                        ],
                        [
                          "disabled",
                          "Disabled",
                        ],
                        ["user", "Users"],
                        ["admin", "Admins"],
                      ].map(
                        ([value, label]) => (
                          <button
                            key={value}
                            onClick={() =>
                              setStatusFilter(
                                value
                              )
                            }
                            className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                              statusFilter ===
                              value
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20"
                                : "bg-zinc-900 text-zinc-500 hover:text-zinc-200"
                            }`}
                          >
                            {label}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between px-1">
                    <p className="text-[11px] text-zinc-600">
                      Showing{" "}
                      <span className="text-zinc-400">
                        {
                          filteredUsers.length
                        }
                      </span>{" "}
                      of{" "}
                      <span className="text-zinc-400">
                        {users.length}
                      </span>{" "}
                      accounts
                    </p>

                    {search && (
                      <button
                        onClick={() =>
                          setSearch("")
                        }
                        className="text-[11px] text-purple-400 hover:text-purple-300"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="border-b border-zinc-800 bg-zinc-900/60">
                        <tr>
                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            User
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Role
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Status
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Sessions
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Last Login
                          </th>

                          <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredUsers.length ===
                        0 ? (
                          <tr>
                            <td
                              colSpan="6"
                              className="px-5 py-16 text-center"
                            >
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-600">
                                <Search
                                  size={20}
                                />
                              </div>

                              <p className="mt-4 text-sm font-medium text-zinc-400">
                                No users found
                              </p>

                              <p className="mt-1 text-xs text-zinc-700">
                                Try changing your
                                search or filter.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map(
                            (user) => (
                              <tr
                                key={
                                  user.id
                                }
                                className="group border-b border-zinc-900 transition hover:bg-zinc-900/40 last:border-0"
                              >
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar
                                      name={
                                        user.name
                                      }
                                    />

                                    <div className="min-w-0">
                                      <p className="max-w-52 truncate font-medium text-zinc-200">
                                        {
                                          user.name
                                        }
                                      </p>

                                      <p className="mt-0.5 max-w-60 truncate text-xs text-zinc-600">
                                        {
                                          user.email
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <RoleBadge
                                    role={
                                      user.role
                                    }
                                  />
                                </td>

                                <td className="px-5 py-4">
                                  <StatusBadge
                                    active={
                                      user.isActive
                                    }
                                  />
                                </td>

                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-2 text-zinc-400">
                                    <Activity
                                      size={14}
                                    />

                                    {user
                                      ._count
                                      ?.authSessions ??
                                      user.activeSessions ??
                                      0}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <p className="text-xs text-zinc-500">
                                    {formatRelativeDate(
                                      user.lastLoginAt
                                    )}
                                  </p>
                                </td>

                                <td className="px-5 py-4">
                                  <div className="flex justify-end">
                                    <button
                                      onClick={() =>
                                        handleViewUser(
                                          user.id
                                        )
                                      }
                                      className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-purple-500/40 hover:bg-purple-500/5 hover:text-purple-400"
                                    >
                                      <Eye
                                        size={
                                          14
                                        }
                                      />
                                      View
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Login Attempts */}
            {activeSection ===
              "login-attempts" && (
              <section>
                <PageHeader
                  eyebrow="Security"
                  title="Login Attempts"
                  description="Review successful and failed authentication activity."
                  icon={Shield}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={loadLoginAttempts}
                        className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-purple-500/30 hover:text-white"
                      >
                        <RefreshCw size={15} />
                        Refresh
                      </button>
                      <button
                        onClick={handleClearLoginAttempts}
                        disabled={actionLoading || loginAttempts.length === 0}
                        className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                        Clear All
                      </button>
                    </div>
                  }
                />

                <div className="mb-6 grid gap-4 sm:grid-cols-3">
                  <SecurityStat
                    title="Total Attempts"
                    value={
                      loginAttempts.length
                    }
                    icon={Shield}
                  />

                  <SecurityStat
                    title="Successful"
                    value={successfulLogins}
                    icon={CheckCircle2}
                    positive
                  />

                  <SecurityStat
                    title="Failed"
                    value={failedLogins}
                    icon={XCircle}
                    danger
                  />
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80">
                  <div className="border-b border-zinc-800 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Shield
                        size={16}
                        className="text-purple-400"
                      />

                      <p className="text-sm font-medium">
                        Authentication activity
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[750px] text-left text-sm">
                      <thead className="border-b border-zinc-800 bg-zinc-900/50">
                        <tr>
                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Email
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Result
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            IP Address
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Time
                          </th>

                          <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {loginAttempts.length ===
                        0 ? (
                          <EmptyTableRow
                            colSpan="5"
                            icon={Shield}
                            message="No login attempts found."
                          />
                        ) : (
                          loginAttempts.map(
                            (attempt) => (
                              <tr
                                key={
                                  attempt.id
                                }
                                className="border-b border-zinc-900 last:border-0"
                              >
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-500">
                                      <Shield
                                        size={
                                          14
                                        }
                                      />
                                    </div>

                                    <span className="text-zinc-300">
                                      {
                                        attempt.email
                                      }
                                    </span>
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                                      attempt.successful
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-red-500/10 text-red-400"
                                    }`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        attempt.successful
                                          ? "bg-emerald-400"
                                          : "bg-red-400"
                                      }`}
                                    />

                                    {attempt.successful
                                      ? "Successful"
                                      : "Failed"}
                                  </span>
                                </td>

                                <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                                  {attempt.ipAddress ||
                                    "Unknown"}
                                </td>

                                <td className="px-5 py-4">
                                  <p className="text-xs text-zinc-400">
                                    {formatRelativeDate(
                                      attempt.attemptedAt
                                    )}
                                  </p>

                                  <p className="mt-0.5 text-[10px] text-zinc-700">
                                    {formatDate(
                                      attempt.attemptedAt
                                    )}
                                  </p>
                                </td>

                                <td className="px-5 py-4 text-right">
                                  <button
                                    onClick={() => handleDeleteLoginAttempt(attempt)}
                                    disabled={actionLoading}
                                    aria-label={`Delete login attempt for ${attempt.email}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-500 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            )
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Sessions */}
            {activeSection ===
              "sessions" && (
              <section>
                <PageHeader
                  eyebrow="Security"
                  title="Active Sessions"
                  description="Monitor currently active authenticated sessions."
                  icon={Activity}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={loadSessions}
                        className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-purple-500/30 hover:text-white"
                      >
                        <RefreshCw size={15} />
                        Refresh
                      </button>
                      <button
                        onClick={handleRevokeAllActiveSessions}
                        disabled={actionLoading || sessions.length === 0}
                        className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                        Clear All
                      </button>
                    </div>
                  }
                />

                <div className="mb-6 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Activity
                        size={20}
                      />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {sessions.length} active{" "}
                        {sessions.length ===
                        1
                          ? "session"
                          : "sessions"}
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        Refresh this page to see
                        the latest session state.
                      </p>
                    </div>

                    <div className="ml-auto hidden h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50 sm:block" />
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead className="border-b border-zinc-800 bg-zinc-900/50">
                        <tr>
                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            User
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Created
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Expires
                          </th>

                          <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Status
                          </th>

                          <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {sessions.length ===
                        0 ? (
                          <EmptyTableRow
                            colSpan="5"
                            icon={Activity}
                            message="No active sessions found."
                          />
                        ) : (
                          sessions.map(
                            (session) => (
                              <tr
                                key={
                                  session.id
                                }
                                className="border-b border-zinc-900 transition hover:bg-zinc-900/40 last:border-0"
                              >
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar
                                      name={
                                        session
                                          .user
                                          ?.name ||
                                        "Unknown"
                                      }
                                    />

                                    <div>
                                      <p className="font-medium text-zinc-200">
                                        {session
                                          .user
                                          ?.name ||
                                          "Unknown"}
                                      </p>

                                      <p className="mt-0.5 text-xs text-zinc-600">
                                        {session
                                          .user
                                          ?.email ||
                                          "Unknown"}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <p className="text-xs text-zinc-500">
                                    {formatRelativeDate(
                                      session.createdAt
                                    )}
                                  </p>
                                </td>

                                <td className="px-5 py-4">
                                  <p className="text-xs text-zinc-500">
                                    {formatDate(
                                      session.expiresAt
                                    )}
                                  </p>
                                </td>

                                <td className="px-5 py-4">
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    Active
                                  </span>
                                </td>

                                <td className="px-5 py-4 text-right">
                                  <button
                                    onClick={() => handleRevokeActiveSession(session)}
                                    disabled={actionLoading}
                                    aria-label={`Revoke session for ${session.user?.name || session.user?.email || "user"}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-500 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            )
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() =>
            setSelectedUser(null)
          }
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-800 bg-[#090909] shadow-2xl shadow-black/50"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={
                    selectedUser.name
                  }
                  large
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-semibold">
                      {selectedUser.name}
                    </h3>

                    <RoleBadge
                      role={
                        selectedUser.role
                      }
                    />
                  </div>

                  <p className="mt-0.5 truncate text-xs text-zinc-600">
                    {selectedUser.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  setSelectedUser(null)
                }
                className="ml-3 rounded-xl p-2 text-zinc-600 transition hover:bg-zinc-900 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-81px)] overflow-y-auto p-5 sm:p-6">
              {/* User information */}
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem
                  label="Account Status"
                  value={
                    <StatusBadge
                      active={
                        selectedUser.isActive
                      }
                    />
                  }
                />

                <InfoItem
                  label="Password Status"
                  value={
                    selectedUser.mustChangePassword
                      ? "Password change required"
                      : "Permanent password"
                  }
                />

                <InfoItem
                  label="Created"
                  value={formatDate(
                    selectedUser.createdAt
                  )}
                />

                <InfoItem
                  label="Last Login"
                  value={formatDate(
                    selectedUser.lastLoginAt
                  )}
                />

                <InfoItem
                  label="Last Seen"
                  value={formatDate(
                    selectedUser.lastSeenAt
                  )}
                />

                <InfoItem
                  label="User ID"
                  value={
                    <span className="break-all font-mono text-[11px]">
                      {selectedUser.id}
                    </span>
                  }
                />
              </div>

              {/* Actions */}
              {selectedUser.id !== admin?.id && (
                <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-zinc-200">
                      Account Actions
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Manage this user's account and
                      active sessions.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <ActionButton
                      icon={
                        selectedUser.isActive
                          ? UserMinus
                          : UserCheck
                      }
                      label={
                        selectedUser.isActive
                          ? "Disable User"
                          : "Enable User"
                      }
                      disabled={
                        actionLoading
                      }
                      onClick={() =>
                        handleToggleStatus(
                          selectedUser
                        )
                      }
                    />

                    <ActionButton
                      icon={Activity}
                      label="Revoke Sessions"
                      disabled={actionLoading}
                      onClick={() => handleRevokeSessions(selectedUser)}
                    />

                    <ActionButton
                      icon={ShieldCheck}
                      label={selectedUser.role === "ADMIN" ? "Make User" : "Make Admin"}
                      disabled={actionLoading}
                      onClick={() => handleChangeRole(selectedUser)}
                    />

                    <ActionButton
                      icon={Timer}
                      label="Clear Active Timer"
                      disabled={actionLoading}
                      onClick={() => handleClearActiveTimer(selectedUser)}
                    />

                    <ActionButton
                      icon={Database}
                      label="Clear Study History"
                      danger
                      disabled={actionLoading}
                      onClick={() => handleDeleteStudyHistory(selectedUser)}
                    />

                    {selectedUser.role !== "ADMIN" && (
                      <ActionButton
                        icon={KeyRound}
                        label="Reset Password"
                        disabled={actionLoading}
                        onClick={() => handleResetPassword(selectedUser)}
                      />
                    )}

                    <ActionButton
                      icon={Trash2}
                      label="Delete User"
                      danger
                      disabled={
                        actionLoading
                      }
                      onClick={() =>
                        handleDeleteUser(
                          selectedUser
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {/* Study sessions */}
              <div className="mt-6">
                <SectionTitle
                  icon={Timer}
                  title="Recent Study Sessions"
                  subtitle="Latest recorded study activity."
                />

                {selectedUser.studySessions
                  ?.length ? (
                  <div className="mt-3 space-y-2">
                    {selectedUser.studySessions.map(
                      (session) => (
                        <div
                          key={
                            session.id
                          }
                          className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-700"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                                <Timer
                                  size={
                                    15
                                  }
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-zinc-300">
                                  {session.subject ||
                                    "Study Session"}
                                </p>

                                <p className="mt-1 text-[10px] text-zinc-600">
                                  {formatDate(
                                    session.createdAt ||
                                      session.startedAt
                                  )}
                                </p>
                              </div>
                            </div>

                            <span className="shrink-0 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs text-zinc-500">
                              {formatDuration(
                                session.duration ||
                                  session.durationSeconds ||
                                  0
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={Timer}
                    message="No study sessions recorded."
                  />
                )}
              </div>

              {/* Completed topics */}
              <div className="mt-6">
                <SectionTitle
                  icon={CheckCircle2}
                  title="Completed Topics"
                  subtitle="Topics completed by this user."
                />

                {selectedUser
                  .completedTopics
                  ?.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selectedUser.completedTopics.map(
                      (topic) => (
                        <div
                          key={
                            topic.id
                          }
                          className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                        >
                          <div className="flex gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                              <Check
                                size={14}
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm text-zinc-300">
                                {topic.topic ||
                                  topic.name ||
                                  "Completed Topic"}
                              </p>

                              <p className="mt-1 text-[10px] text-zinc-600">
                                {formatDate(
                                  topic.completedAt ||
                                    topic.createdAt
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    message="No completed topics."
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Temporary Password Modal */}
      {resetPassword && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() =>
            setResetPassword(null)
          }
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-purple-500/20 bg-[#090909] shadow-2xl shadow-purple-950/20"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="border-b border-zinc-800 bg-gradient-to-r from-purple-500/10 to-transparent px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                    <KeyRound
                      size={19}
                    />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Temporary Password
                    </h3>

                    <p className="text-[11px] text-zinc-600">
                      One-time display
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setResetPassword(null)
                  }
                  className="rounded-xl p-2 text-zinc-600 hover:bg-zinc-900 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs text-zinc-600">
                  User
                </p>

                <p className="mt-1 text-sm font-medium text-zinc-300">
                  {resetPassword.user}
                </p>

                <p className="mt-0.5 text-xs text-zinc-600">
                  {resetPassword.email}
                </p>
              </div>

              <p className="mt-5 text-xs font-medium uppercase tracking-wider text-zinc-600">
                Temporary password
              </p>

              <div className="mt-2 flex items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-sm text-purple-300">
                  {resetPassword.password}
                </code>

                <button
                  onClick={
                    copyTemporaryPassword
                  }
                  className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-400 transition hover:border-purple-500/30 hover:text-purple-300"
                  title="Copy password"
                >
                  {copiedPassword ? (
                    <Check
                      size={16}
                    />
                  ) : (
                    <Copy
                      size={16}
                    />
                  )}
                </button>
              </div>

              {copiedPassword && (
                <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                  <Check size={12} />
                  Password copied to clipboard.
                </p>
              )}

              <div className="mt-4 rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-3">
                <div className="flex gap-2">
                  <AlertCircle
                    size={15}
                    className="mt-0.5 shrink-0 text-yellow-500"
                  />

                  <p className="text-xs leading-5 text-yellow-500/80">
                    Save this password now. It is
                    shown only once. The user should
                    use it to log in and create a
                    permanent password.
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  setResetPassword(null)
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                <Check size={16} />
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        danger={confirmState.danger}
        onConfirm={() => closeConfirmation(true)}
        onCancel={() => closeConfirmation(false)}
      />
    </div>
  );
}

/* =========================================================
   Components
========================================================= */

function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="flex items-start gap-3">
        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-400 sm:flex">
          <Icon size={20} />
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-400">
            {eyebrow}
          </p>

          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {title}
          </h2>

          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 sm:text-sm">
            {description}
          </p>
        </div>
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>

  );
}

function NavButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-purple-500/10 text-purple-300 shadow-inner"
          : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
      }`}
    >
      <Icon
        size={17}
        className={
          active
            ? "text-purple-400"
            : "text-zinc-600 group-hover:text-zinc-400"
        }
      />

      <span className="flex-1">
        {label}
      </span>

      {count !== undefined && (
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] ${
            active
              ? "bg-purple-500/10 text-purple-300"
              : "bg-zinc-900 text-zinc-700"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}) {
  const accentClasses = {
    purple: {
      box: "bg-purple-500/10 text-purple-400",
      glow: "bg-purple-500",
    },
    emerald: {
      box: "bg-emerald-500/10 text-emerald-400",
      glow: "bg-emerald-500",
    },
    red: {
      box: "bg-red-500/10 text-red-400",
      glow: "bg-red-500",
    },
    blue: {
      box: "bg-blue-500/10 text-blue-400",
      glow: "bg-blue-500",
    },
  };

  const classes =
    accentClasses[accent] ||
    accentClasses.purple;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-700">
      <div
        className={`absolute -right-10 -top-10 h-24 w-24 rounded-full ${classes.glow} opacity-[0.04] blur-2xl transition duration-500 group-hover:opacity-[0.1]`}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-600">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {value}
          </p>

          <p className="mt-1 text-[10px] text-zinc-700">
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${classes.box}`}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  title,
  value,
  icon: Icon,
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 transition hover:border-zinc-700">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-500">
        <Icon size={16} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-zinc-700">
          {title}
        </p>

        <p className="mt-0.5 text-lg font-semibold text-zinc-300">
          {value}
        </p>
      </div>
    </div>
  );
}

function ActivityMetric({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 text-zinc-600">
        <Icon size={14} />

        <span className="text-[10px] uppercase tracking-wider">
          {label}
        </span>
      </div>

      <p className="mt-2 text-xl font-semibold text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function SecurityStat({
  title,
  value,
  icon: Icon,
  positive,
  danger,
}) {
  let boxClass =
    "bg-purple-500/10 text-purple-400";

  if (positive) {
    boxClass =
      "bg-emerald-500/10 text-emerald-400";
  }

  if (danger) {
    boxClass =
      "bg-red-500/10 text-red-400";
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${boxClass}`}
      >
        <Icon size={18} />
      </div>

      <div>
        <p className="text-xs text-zinc-600">
          {title}
        </p>

        <p className="mt-1 text-2xl font-semibold">
          {value}
        </p>
      </div>
    </div>
  );
}

function HealthRow({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-900/30 px-3 py-3">
      <div className="flex items-center gap-3">
        <Icon
          size={15}
          className="text-zinc-600"
        />

        <span className="text-xs text-zinc-400">
          {label}
        </span>
      </div>

      <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {value}
      </span>
    </div>
  );
}

function SystemIndicator({
  icon: Icon,
  label,
  status,
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon
        size={13}
        className="text-zinc-700"
      />

      <span className="flex-1 text-[10px] text-zinc-600">
        {label}
      </span>

      <span className="flex items-center gap-1 text-[9px] text-emerald-500">
        <span className="h-1 w-1 rounded-full bg-emerald-400" />
        {status}
      </span>
    </div>
  );
}

function Avatar({
  name,
  large = false,
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/15 to-indigo-500/10 font-semibold text-purple-300 ${
        large
          ? "h-11 w-11 text-sm"
          : "h-9 w-9 text-xs"
      }`}
    >
      {getInitials(name)}
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
        active
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? "bg-emerald-400"
            : "bg-red-400"
        }`}
      />

      {active ? "Active" : "Disabled"}
    </span>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === "ADMIN";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${
        isAdmin
          ? "bg-purple-500/10 text-purple-400"
          : "bg-zinc-800 text-zinc-500"
      }`}
    >
      {isAdmin && <Shield size={10} />}

      {role}
    </span>
  );
}

function InfoItem({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-700">
        {label}
      </p>

      <div className="mt-2 text-sm text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger = false,
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
          : "border-zinc-800 text-zinc-400 hover:border-purple-500/30 hover:bg-purple-500/5 hover:text-purple-300"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-500">
        <Icon size={14} />
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-300">
          {title}
        </p>

        <p className="mt-0.5 text-[10px] text-zinc-700">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}) {
  return (
    <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 px-5 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-700">
        <Icon size={17} />
      </div>

      <p className="mt-3 text-xs text-zinc-600">
        {message}
      </p>
    </div>
  );
}

function EmptyTableRow({
  colSpan,
  icon: Icon,
  message,
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-5 py-16 text-center"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-zinc-700">
          <Icon size={18} />
        </div>

        <p className="mt-3 text-xs text-zinc-600">
          {message}
        </p>
      </td>
    </tr>
  );
}

function AlertBox({
  type,
  message,
  onClose,
}) {
  const success = type === "success";

  return (
    <div
      className={`mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 ${
        success
          ? "border-emerald-500/15 bg-emerald-500/5 text-emerald-400"
          : "border-red-500/15 bg-red-500/5 text-red-400"
      }`}
    >
      {success ? (
        <CheckCircle2
          size={17}
          className="shrink-0"
        />
      ) : (
        <AlertCircle
          size={17}
          className="shrink-0"
        />
      )}

      <p className="flex-1 text-xs">
        {message}
      </p>

      <button
        onClick={onClose}
        className="rounded-lg p-1 opacity-60 transition hover:bg-white/5 hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function getInitials(name) {
  if (!name) {
    return "A";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}