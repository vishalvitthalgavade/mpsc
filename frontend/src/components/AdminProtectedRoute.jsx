import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function AdminProtectedRoute() {
  const {
    isAdminAuthenticated,
    isAdminLoading,
  } = useAdminAuth();

  if (isAdminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-purple-500" />

          <p className="text-sm text-zinc-400">
            Loading admin panel...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <Navigate
        to="/admin/login"
        replace
      />
    );
  }

  return <Outlet />;
}