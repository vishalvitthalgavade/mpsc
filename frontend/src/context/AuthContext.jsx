import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AuthContext = createContext(null);

/*
====================================================
API BASE URL
====================================================
*/

const API_BASE_URL = "/api";

const ACCESS_TOKEN_KEY = "gate-access-token";
const USER_KEY = "gate-user";

/*
====================================================
SESSION SETTINGS
====================================================
*/

// Access token lasts 7 days. Refresh well before that.
const SESSION_REFRESH_INTERVAL = 12 * 60 * 60 * 1000;

// Refresh when returning from a long background period.
const BACKGROUND_REFRESH_THRESHOLD = 5 * 60 * 1000;

// Prevent duplicate refresh requests.
const MIN_REFRESH_GAP = 30 * 1000;

const REQUEST_TIMEOUT = 20000;

/*
====================================================
BUILD API URL
====================================================
*/

function buildApiUrl(path) {
  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  const cleanPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return `${API_BASE_URL}${cleanPath}`;
}

/*
====================================================
SAFE STORAGE HELPERS
====================================================
*/

function getStoredUser() {
  try {
    const user = localStorage.getItem(USER_KEY);

    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.warn(
      "Unable to read stored user:",
      error
    );

    return null;
  }
}

function getStoredToken() {
  try {
    return localStorage.getItem(
      ACCESS_TOKEN_KEY
    );
  } catch (error) {
    console.warn(
      "Unable to read stored token:",
      error
    );

    return null;
  }
}

function isAccessTokenFresh(token) {
  if (!token) {
    return false;
  }

  try {
    const payload = JSON.parse(
      atob(token.split(".")[1])
    );

    if (!payload?.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now() + 30 * 1000;
  } catch {
    return false;
  }
}

/*
====================================================
FETCH WITH TIMEOUT
====================================================
*/

async function fetchWithTimeout(
  url,
  options = {},
  timeout = REQUEST_TIMEOUT
) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/*
====================================================
AUTH PROVIDER
====================================================
*/

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    return getStoredUser();
  });

  const [accessToken, setAccessToken] = useState(
    () => {
      return getStoredToken();
    }
  );

  const [isLoading, setIsLoading] =
    useState(true);

  /*
   * Only one refresh request is allowed
   * at a time.
   */
  const refreshPromiseRef = useRef(null);

  /*
   * Prevent initialization from running twice.
   */
  const initializedRef = useRef(false);

  /*
   * Last known activity.
   */
  const lastActivityRef = useRef(
    Date.now()
  );

  /*
   * Last successful refresh.
   */
  const lastRefreshRef = useRef(0);

  /*
   * Interval reference.
   */
  const refreshIntervalRef = useRef(null);

  /*
   * Time when the page became hidden.
   */
  const hiddenAtRef = useRef(null);

/*
====================================================
SAVE AUTH DATA
====================================================
*/

  function saveAuth(data) {
    if (data?.accessToken) {
      setAccessToken(data.accessToken);

      try {
        localStorage.setItem(
          ACCESS_TOKEN_KEY,
          data.accessToken
        );
      } catch (error) {
        console.warn(
          "Unable to save access token:",
          error
        );
      }
    }

    if (data?.user) {
      setUser(data.user);

      try {
        localStorage.setItem(
          USER_KEY,
          JSON.stringify(data.user)
        );
      } catch (error) {
        console.warn(
          "Unable to save user:",
          error
        );
      }
    }
  }

/*
====================================================
CLEAR AUTH
====================================================
*/

  function clearAuth() {
    setUser(null);
    setAccessToken(null);

    try {
      localStorage.removeItem(
        ACCESS_TOKEN_KEY
      );

      localStorage.removeItem(USER_KEY);
    } catch (error) {
      console.warn(
        "Unable to clear local authentication:",
        error
      );
    }
  }

/*
====================================================
HAS STORED AUTH
====================================================
*/

  function hasStoredAuth() {
    return Boolean(
      getStoredUser() ||
        getStoredToken()
    );
  }

/*
====================================================
REFRESH SESSION
====================================================
*/

  async function refreshSession({
    clearOnInvalid = true,
    force = false,
  } = {}) {
    /*
     * If another refresh is already running,
     * use the same promise.
     */
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    /*
     * Nothing to refresh if the user has
     * absolutely no local authentication state.
     */
    if (!hasStoredAuth()) {
      return false;
    }

    /*
     * Don't make network requests while offline.
     */
    if (!navigator.onLine) {
      return true;
    }

    /*
     * Avoid unnecessary refresh requests.
     */
    const now = Date.now();

    if (
      !force &&
      now - lastRefreshRef.current <
        MIN_REFRESH_GAP
    ) {
      return true;
    }

    refreshPromiseRef.current =
      (async () => {
        try {
          const response =
            await fetchWithTimeout(
              buildApiUrl("/auth/refresh"),
              {
                method: "POST",
                credentials: "include",
                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          /*
           * Refresh token/session rejected.
           *
           * Retry once before clearing auth.
           */
          if (
            response.status === 401 ||
            response.status === 403
          ) {
            console.warn(
              "Refresh returned:",
              response.status
            );

            try {
              await new Promise(
                (resolve) => {
                  window.setTimeout(
                    resolve,
                    500
                  );
                }
              );

              const retryResponse =
                await fetchWithTimeout(
                  buildApiUrl(
                    "/auth/refresh"
                  ),
                  {
                    method: "POST",
                    credentials:
                      "include",
                    headers: {
                      Accept:
                        "application/json",
                    },
                  }
                );

              if (retryResponse.ok) {
                const retryData =
                  await retryResponse.json();

                if (retryData?.success) {
                  saveAuth(retryData);

                  lastRefreshRef.current =
                    Date.now();

                  lastActivityRef.current =
                    Date.now();

                  return true;
                }
              }
            } catch (retryError) {
              console.warn(
                "Refresh retry failed:",
                retryError?.message
              );
            }

            /*
             * Only clear authentication after
             * the server has rejected the refresh
             * session twice.
             */
            if (
              clearOnInvalid &&
              !isAccessTokenFresh(getStoredToken())
            ) {
              clearAuth();
            }

            return isAccessTokenFresh(getStoredToken());
          }

          /*
           * Server errors such as 500, 502, etc.
           * should NOT immediately log the user out.
           */
          if (!response.ok) {
            console.warn(
              "Refresh request failed:",
              response.status
            );

            return hasStoredAuth();
          }

          const data =
            await response.json();

          if (!data?.success) {
            console.warn(
              "Refresh response was unsuccessful."
            );

            if (
              clearOnInvalid &&
              !isAccessTokenFresh(getStoredToken())
            ) {
              clearAuth();
            }

            return isAccessTokenFresh(getStoredToken());
          }

          /*
           * Store the newly rotated access token.
           */
          saveAuth(data);

          lastRefreshRef.current =
            Date.now();

          lastActivityRef.current =
            Date.now();

          return true;
        } catch (error) {
          /*
           * Network errors/timeouts should NOT
           * destroy an otherwise valid local session.
           */
          if (
            error?.name === "AbortError"
          ) {
            console.warn(
              "Refresh request timed out."
            );
          } else {
            console.warn(
              "Refresh unavailable:",
              error?.message
            );
          }

          return hasStoredAuth();
        } finally {
          refreshPromiseRef.current =
            null;
        }
      })();

    return refreshPromiseRef.current;
  }

/*
====================================================
INITIAL AUTH CHECK
====================================================
*/

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    let mounted = true;

    async function initializeAuth() {
      try {
        const storedUser =
          getStoredUser();

        const storedToken =
          getStoredToken();

        /*
         * Restore local authentication immediately.
         */
        if (
          storedUser ||
          storedToken
        ) {
          if (mounted) {
            setUser(storedUser);
            setAccessToken(storedToken);

            /*
             * IMPORTANT:
             * Stop showing the loading screen
             * immediately.
             */
            setIsLoading(false);
          }

          /*
           * Refresh in the background.
           *
           * We deliberately DO NOT await this.
           */
          if (navigator.onLine) {
            refreshSession({
              clearOnInvalid: false,
              force: true,
            }).catch((error) => {
              console.warn(
                "Initial background refresh failed:",
                error?.message
              );
            });
          }

          return;
        }

        /*
         * No local auth.
         *
         * The HttpOnly refresh cookie may still
         * contain a valid session.
         *
         * Try to restore it in the background.
         */
        if (navigator.onLine) {
          refreshSession({
            clearOnInvalid: true,
            force: true,
          }).catch((error) => {
            console.warn(
              "Cookie session restore failed:",
              error?.message
            );
          });
        }
      } catch (error) {
        console.error(
          "Authentication initialization error:",
          error
        );
      } finally {
        /*
         * NEVER leave the application stuck
         * on the loading screen.
         */
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

/*
====================================================
SIGNUP
====================================================
*/

  async function signup(
    name,
    email,
    password
  ) {
    const response =
      await fetchWithTimeout(
        buildApiUrl("/auth/signup"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Signup failed."
      );
    }

    saveAuth(data);

    lastActivityRef.current =
      Date.now();

    lastRefreshRef.current =
      Date.now();

    return data;
  }

/*
====================================================
LOGIN
====================================================
*/

  async function login(
    email,
    password
  ) {
    const response =
      await fetchWithTimeout(
        buildApiUrl("/auth/login"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Login failed."
      );
    }

    saveAuth(data);

    lastActivityRef.current =
      Date.now();

    lastRefreshRef.current =
      Date.now();

    return data;
  }

/*
====================================================
UPDATE PROFILE
====================================================
*/

  async function updateProfile(name) {
    const response =
      await authFetch(
        "/auth/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            name,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Could not update profile."
      );
    }

    if (data?.user) {
      saveAuth({
        user: data.user,
      });
    }

    return data;
  }

/*
====================================================
CHANGE PASSWORD
====================================================
*/

  async function changePassword(
    currentPassword,
    newPassword
  ) {
    const response =
      await authFetch(
        "/auth/change-password",
        {
          method: "PUT",
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Could not change password."
      );
    }

    /*
     * Backend returns updated user with
     * mustChangePassword=false.
     */
    if (data?.user) {
      saveAuth({
        user: data.user,
      });
    } else if (user) {
      const updatedUser = {
        ...user,
        mustChangePassword: false,
      };

      saveAuth({
        user: updatedUser,
      });
    }

    lastActivityRef.current =
      Date.now();

    return data;
  }

/*
====================================================
LOGOUT
====================================================
*/

  async function logout() {
    try {
      await fetchWithTimeout(
        buildApiUrl("/auth/logout"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept:
              "application/json",
          },
        }
      );
    } catch (error) {
      console.warn(
        "Logout request unavailable:",
        error?.message
      );
    }

    clearAuth();

    lastRefreshRef.current = 0;
    lastActivityRef.current =
      Date.now();

    hiddenAtRef.current = null;
  }

/*
====================================================
AUTHENTICATED FETCH
====================================================
*/

  async function authFetch(
    url,
    options = {}
  ) {
    let token =
      accessToken ||
      getStoredToken();

    const fullUrl =
      buildApiUrl(url);

    /*
     * Refresh before making an API request
     * when the current session is getting old.
     */
    const timeSinceRefresh =
      Date.now() -
      lastRefreshRef.current;

    if (
      hasStoredAuth() &&
      navigator.onLine &&
      timeSinceRefresh >=
        SESSION_REFRESH_INTERVAL
    ) {
      await refreshSession({
        clearOnInvalid: false,
        force: true,
      });

      token = getStoredToken();
    }

    async function makeRequest(
      currentToken
    ) {
      const headers = new Headers(
        options.headers || {}
      );

      if (currentToken) {
        headers.set(
          "Authorization",
          `Bearer ${currentToken}`
        );
      }

      if (
        options.body &&
        !headers.has("Content-Type")
      ) {
        headers.set(
          "Content-Type",
          "application/json"
        );
      }

      headers.set(
        "Accept",
        "application/json"
      );

      return fetchWithTimeout(
        fullUrl,
        {
          ...options,
          headers,
          credentials: "include",
        }
      );
    }

    let response =
      await makeRequest(token);

    /*
     * Access token expired.
     *
     * Refresh and retry the request.
     */
    if (response.status === 401) {
      const refreshed =
        await refreshSession({
          clearOnInvalid: !isAccessTokenFresh(
            getStoredToken()
          ),
          force: true,
        });

      if (refreshed) {
        token = getStoredToken();

        response =
          await makeRequest(token);
      }
    }

    lastActivityRef.current =
      Date.now();

    return response;
  }

/*
====================================================
PROACTIVE SESSION REFRESH
====================================================
*/

  useEffect(() => {
    async function proactiveRefresh() {
      if (!hasStoredAuth()) {
        return;
      }

      if (!navigator.onLine) {
        return;
      }

      /*
       * Don't refresh hidden/background pages.
       *
       * Visibility handler will refresh when the
       * user returns.
       */
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      await refreshSession({
        clearOnInvalid: false,
        force: true,
      });
    }

    refreshIntervalRef.current =
      window.setInterval(
        proactiveRefresh,
        SESSION_REFRESH_INTERVAL
      );

    return () => {
      if (
        refreshIntervalRef.current
      ) {
        window.clearInterval(
          refreshIntervalRef.current
        );

        refreshIntervalRef.current = null;
      }
    };
  }, []);

/*
====================================================
VISIBILITY HANDLER
====================================================
*/

  useEffect(() => {
    async function handleVisibilityChange() {
      /*
       * User leaves the page.
       */
      if (
        document.visibilityState ===
        "hidden"
      ) {
        hiddenAtRef.current =
          Date.now();

        return;
      }

      /*
       * Ignore anything other than visible.
       */
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      const now = Date.now();

      const hiddenDuration =
        hiddenAtRef.current
          ? now -
            hiddenAtRef.current
          : 0;

      /*
       * User has returned after being away.
       *
       * Refresh immediately.
       */
      if (
        hiddenDuration >=
        BACKGROUND_REFRESH_THRESHOLD
      ) {
        if (
          hasStoredAuth() &&
          navigator.onLine
        ) {
          await refreshSession({
            clearOnInvalid: false,
            force: true,
          });
        }
      } else {
        /*
         * Even if the user was away briefly,
         * refresh if the current session is old.
         */
        const timeSinceRefresh =
          now -
          lastRefreshRef.current;

        if (
          hasStoredAuth() &&
          navigator.onLine &&
          timeSinceRefresh >=
            SESSION_REFRESH_INTERVAL
        ) {
          await refreshSession({
            clearOnInvalid: false,
            force: true,
          });
        }
      }

      hiddenAtRef.current = null;

      lastActivityRef.current =
        Date.now();
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

/*
====================================================
WINDOW FOCUS
====================================================
*/

  useEffect(() => {
    async function handleFocus() {
      const now = Date.now();

      const timeSinceRefresh =
        now -
        lastRefreshRef.current;

      /*
       * Focus is an additional safety mechanism
       * for browsers where visibilitychange may
       * not fire as expected.
       */
      if (
        hasStoredAuth() &&
        navigator.onLine &&
        timeSinceRefresh >=
          BACKGROUND_REFRESH_THRESHOLD
      ) {
        await refreshSession({
          clearOnInvalid: false,
          force: true,
        });
      }

      lastActivityRef.current =
        Date.now();
    }

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, []);

/*
====================================================
ONLINE EVENT
====================================================
*/

  useEffect(() => {
    async function handleOnline() {
      if (!hasStoredAuth()) {
        return;
      }

      await refreshSession({
        clearOnInvalid: false,
        force: true,
      });

      lastActivityRef.current =
        Date.now();
    }

    window.addEventListener(
      "online",
      handleOnline
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );
    };
  }, []);

/*
====================================================
CONTEXT VALUE
====================================================
*/

  const value = {
    user,
    accessToken,
    isLoading,

    isAuthenticated:
      Boolean(user),

    mustChangePassword:
      Boolean(
        user?.mustChangePassword
      ),

    signup,
    login,
    logout,

    refreshSession,
    authFetch,

    updateProfile,
    changePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/*
====================================================
USE AUTH
====================================================
*/

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}