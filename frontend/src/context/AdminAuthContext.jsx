import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const AdminAuthContext = createContext(null);

const API_BASE_URL = "/api";

const ADMIN_TOKEN_KEY = "gate_admin_access_token";
const ADMIN_USER_KEY = "gate_admin_user";

const REQUEST_TIMEOUT = 10000;

/*
 * The access token itself lasts 7 days (set by the backend),
 * but the admin panel previously had NO way to refresh it -
 * once it expired, or any request got a transient 401, the
 * admin was logged out immediately with no way back except
 * logging in again. Proactively refreshing (mirroring the
 * normal-user AuthContext) keeps a long-lived admin session
 * alive as long as the underlying refresh cookie is valid.
 */
const ADMIN_SESSION_REFRESH_INTERVAL = 12 * 60 * 60 * 1000;

function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try {
      const savedAdmin =
        localStorage.getItem(ADMIN_USER_KEY);

      return savedAdmin
        ? JSON.parse(savedAdmin)
        : null;
    } catch {
      localStorage.removeItem(ADMIN_USER_KEY);
      return null;
    }
  });

  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  });

  const [isAdminLoading, setIsAdminLoading] =
    useState(false);

  /*
   * Only one refresh request in flight at a time.
   */
  const refreshPromiseRef = useRef(null);

  const saveAdminAuth = useCallback(
    (token, adminData) => {
      if (token) {
        localStorage.setItem(
          ADMIN_TOKEN_KEY,
          token
        );

        setAdminToken(token);
      }

      if (adminData) {
        localStorage.setItem(
          ADMIN_USER_KEY,
          JSON.stringify(adminData)
        );

        setAdmin(adminData);
      }
    },
    []
  );

  const clearAdminAuth = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);

    setAdminToken(null);
    setAdmin(null);
  }, []);

  const adminLogin = useCallback(
    async (email, password) => {
      setIsAdminLoading(true);

      try {
        /*
         * Admin uses the existing normal login endpoint.
         * The backend returns the user's role.
         */
        const response = await fetchWithTimeout(
          buildApiUrl("/auth/login"),
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Login failed."
          );
        }

        if (!data.accessToken || !data.user) {
          throw new Error(
            "Login response is incomplete."
          );
        }

        /*
         * IMPORTANT:
         * Only ADMIN users can enter the admin panel.
         */
        if (data.user.role !== "ADMIN") {
          throw new Error(
            "This account does not have administrator access."
          );
        }

        if (data.user.isActive === false) {
          throw new Error(
            "This administrator account is disabled."
          );
        }

        saveAdminAuth(
          data.accessToken,
          data.user
        );

        return data;
      } finally {
        setIsAdminLoading(false);
      }
    },
    [saveAdminAuth]
  );

  /*
   * Refresh the admin's access token using the same
   * HttpOnly refresh cookie the normal login/refresh
   * flow already sets (admin login goes through the
   * same /auth/login endpoint). Returns true if the
   * admin session is still valid afterwards.
   */
  const refreshAdminSession = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      try {
        const response = await fetchWithTimeout(
          buildApiUrl("/auth/refresh"),
          {
            method: "POST",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          return false;
        }

        const data = await response.json();

        if (
          !data?.success ||
          !data.accessToken ||
          !data.user
        ) {
          return false;
        }

        /*
         * A non-admin account should never be able to
         * keep an admin session alive via refresh.
         */
        if (data.user.role !== "ADMIN") {
          clearAdminAuth();
          return false;
        }

        if (data.user.isActive === false) {
          clearAdminAuth();
          return false;
        }

        saveAdminAuth(data.accessToken, data.user);

        return true;
      } catch (error) {
        console.warn(
          "Admin session refresh failed:",
          error?.message
        );

        return false;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [clearAdminAuth, saveAdminAuth]);

  const adminLogout = useCallback(async () => {
    try {
      await fetchWithTimeout(
        buildApiUrl("/auth/logout"),
        {
          method: "POST",
          credentials: "include",
          headers: adminToken
            ? {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type":
                  "application/json",
              }
            : {
                "Content-Type":
                  "application/json",
              },
        }
      );
    } catch (error) {
      console.error(
        "Admin logout error:",
        error
      );
    } finally {
      clearAdminAuth();
    }
  }, [adminToken, clearAdminAuth]);

  const adminFetch = useCallback(
    async (path, options = {}) => {
      async function makeRequest(currentToken) {
        return fetchWithTimeout(
          buildApiUrl(path),
          {
            ...options,
            credentials: "include",
            headers: {
              ...(options.headers || {}),
              Authorization: `Bearer ${currentToken}`,
              "Content-Type":
                options.body &&
                typeof options.body !== "string"
                  ? "application/json"
                  : options.headers?.[
                      "Content-Type"
                    ] ||
                    "application/json",
            },
            body:
              options.body &&
              typeof options.body !== "string"
                ? JSON.stringify(options.body)
                : options.body,
          }
        );
      }

      let token =
        localStorage.getItem(
          ADMIN_TOKEN_KEY
        );

      if (!token) {
        throw new Error(
          "Administrator authentication required."
        );
      }

      let response = await makeRequest(token);

      /*
       * Access token expired or was rejected.
       *
       * Try refreshing it once via the refresh
       * cookie before giving up and logging out -
       * this is what was missing before, and is
       * why the admin panel used to log admins out
       * as soon as the access token aged out.
       */
      if (response.status === 401) {
        const refreshed = await refreshAdminSession();

        if (refreshed) {
          token = localStorage.getItem(ADMIN_TOKEN_KEY);
          response = await makeRequest(token);
        }

        if (response.status === 401) {
          clearAdminAuth();
        }
      }

      return response;
    },
    [clearAdminAuth, refreshAdminSession]
  );

  const checkAdminAuth = useCallback(async () => {
    const token =
      localStorage.getItem(
        ADMIN_TOKEN_KEY
      );

    const savedAdmin =
      localStorage.getItem(
        ADMIN_USER_KEY
      );

    if (!token || !savedAdmin) {
      clearAdminAuth();
      return false;
    }

    try {
      const response = await fetchWithTimeout(
        buildApiUrl("/auth/me"),
        {
          method: "GET",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          /*
           * The access token may simply be old.
           * Try refreshing before treating this
           * as a real logout.
           */
          const refreshed = await refreshAdminSession();

          return refreshed;
        }

        return false;
      }

      const data = await response.json();

      if (
        !data.success ||
        !data.user ||
        data.user.role !== "ADMIN" ||
        data.user.isActive === false
      ) {
        clearAdminAuth();
        return false;
      }

      saveAdminAuth(token, data.user);

      return true;
    } catch (error) {
      console.error(
        "Admin authentication check failed:",
        error
      );

      return Boolean(token && savedAdmin);
    }
  }, [clearAdminAuth, saveAdminAuth, refreshAdminSession]);

  /*
   * Proactively refresh the admin's access token in the
   * background so a long-open admin panel tab doesn't run
   * into a dead token. Also refresh whenever the tab
   * regains focus after being in the background, since
   * that's when a stale token is most likely to be used.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        localStorage.getItem(ADMIN_TOKEN_KEY) &&
        navigator.onLine
      ) {
        refreshAdminSession();
      }
    }, ADMIN_SESSION_REFRESH_INTERVAL);

    function handleVisibilityOrFocus() {
      if (
        document.visibilityState === "visible" &&
        localStorage.getItem(ADMIN_TOKEN_KEY) &&
        navigator.onLine
      ) {
        refreshAdminSession();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityOrFocus
    );

    window.addEventListener(
      "focus",
      handleVisibilityOrFocus
    );

    return () => {
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityOrFocus
      );

      window.removeEventListener(
        "focus",
        handleVisibilityOrFocus
      );
    };
  }, [refreshAdminSession]);

  const value = useMemo(
    () => ({
      admin,
      adminToken,

      isAdminAuthenticated: Boolean(
        admin &&
          adminToken &&
          admin.role === "ADMIN"
      ),

      isAdminLoading,

      adminLogin,
      adminLogout,
      adminFetch,
      checkAdminAuth,
      clearAdminAuth,
      refreshAdminSession,
    }),
    [
      admin,
      adminToken,
      isAdminLoading,
      adminLogin,
      adminLogout,
      adminFetch,
      checkAdminAuth,
      clearAdminAuth,
      refreshAdminSession,
    ]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context =
    useContext(AdminAuthContext);

  if (!context) {
    throw new Error(
      "useAdminAuth must be used inside AdminAuthProvider"
    );
  }

  return context;
}