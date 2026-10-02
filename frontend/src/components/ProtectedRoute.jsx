import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth();

  /*
   * These are the exact keys used by AuthContext.
   */
  const hasStoredAuth =
    Boolean(
      localStorage.getItem(
        "gate-access-token"
      )
    ) ||
    Boolean(
      localStorage.getItem(
        "gate-user"
      )
    );

  /*
   * If there is no saved authentication,
   * the user is logged out.
   */
  if (!hasStoredAuth && !isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
   * Wait while AuthContext performs its
   * initial authentication check.
   */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-purple-500" />

          <p className="text-sm text-zinc-400">
            Loading your study tracker...
          </p>
        </div>
      </div>
    );
  }

  /*
   * Authentication finished but the session
   * is not valid.
   */
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
}