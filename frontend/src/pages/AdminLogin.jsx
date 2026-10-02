import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function AdminLogin() {
  const navigate = useNavigate();

  const {
    adminLogin,
    isAdminAuthenticated,
    isAdminLoading,
  } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [error, setError] = useState("");

  if (isAdminAuthenticated) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    try {
      await adminLogin(
        email.trim(),
        password
      );

      navigate("/admin", {
        replace: true,
      });
    } catch (err) {
      setError(
        err.message ||
          "Administrator login failed."
      );
    }
  };

  return (
    <div className="gate-auth-shell text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-7 w-7 text-purple-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.5 12l1.7 1.7 3.8-4"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-semibold">
              MPSC Tracker
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Administrator Portal
            </p>
          </div>

          {/* Login Card */}
          <div className="gate-auth-card p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-medium">
                Admin Login
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Sign in with an administrator account.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="admin-email"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Email
                </label>

                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="admin@example.com"
                  autoComplete="username"
                  disabled={isAdminLoading}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="admin-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isAdminLoading}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    disabled={isAdminLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isAdminLoading}
                className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAdminLoading
                  ? "Signing in..."
                  : "Sign in as Administrator"}
              </button>
            </form>

            <div className="mt-6 border-t border-zinc-800 pt-5 text-center">
              <button
                type="button"
                onClick={() =>
                  navigate("/login")
                }
                className="text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                ← Back to user login
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-700">
            Authorized administrators only
          </p>
        </div>
      </div>
    </div>
  );
}