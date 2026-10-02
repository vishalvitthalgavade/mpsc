import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

const API_URL = "http://localhost:5000";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore login using the HttpOnly refresh cookie.
  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/refresh`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setAccessToken(data.accessToken);
        setUser(data.user);
      }
    } catch (error) {
      // Backend may be offline.
      console.log("Session restore unavailable");
    } finally {
      setLoading(false);
    }
  }

  async function signup(name, email, password) {
    const response = await fetch(
      `${API_URL}/api/auth/signup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Signup failed"
      );
    }

    setAccessToken(data.accessToken);
    setUser(data.user);

    return data;
  }

  async function login(email, password) {
    const response = await fetch(
      `${API_URL}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Login failed"
      );
    }

    setAccessToken(data.accessToken);
    setUser(data.user);

    return data;
  }

  async function logout() {
    try {
      await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  const value = {
    user,
    accessToken,
    loading,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}