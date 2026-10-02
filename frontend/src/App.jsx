import { useState } from "react";
import { Menu } from "lucide-react";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

import Dashboard from "./pages/Dashboard";
import Timer from "./pages/Timer";
import Heatmap from "./pages/Heatmap";
import Syllabus from "./pages/Syllabus";
import History from "./pages/History";
import Statistics from "./pages/Statistics";
import Settings from "./pages/Settings";
import Leaderboard from "./pages/Leaderboard";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

import { StudyProvider } from "./context/StudyContext";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { TimerProvider } from "./context/TimerContext";
import { useExamCountdown } from "./context/useExamCountdown";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { daysLeft, isPast } = useExamCountdown();

  return (
    <BrowserRouter>
      {/* ==================================================
          NORMAL USER AUTH
      ================================================== */}

      <AuthProvider>
        {/* ==================================================
            ADMIN AUTH

            This is separate from normal user auth.
        ================================================== */}

        <AdminAuthProvider>
          <StudyProvider>
            <TimerProvider>
            <Routes>

              {/* ============================================
                  NORMAL USER PUBLIC PAGES
              ============================================ */}

              <Route
                path="/login"
                element={<Login />}
              />

              <Route
                path="/signup"
                element={<Signup />}
              />

              {/* ============================================
                  ADMIN PUBLIC LOGIN
              ============================================ */}

              <Route
                path="/admin/login"
                element={<AdminLogin />}
              />

              {/* ============================================
                  ADMIN PROTECTED APPLICATION
              ============================================ */}

              <Route
                element={
                  <AdminProtectedRoute />
                }
              >
                <Route
                  path="/admin"
                  element={<AdminDashboard />}
                />
              </Route>

              {/* ============================================
                  NORMAL USER PROTECTED APPLICATION
              ============================================ */}

              <Route
                element={<ProtectedRoute />}
              >
                <Route
                  path="/*"
                  element={
                    <div className="gate-app-shell min-h-screen bg-gray-50 text-gray-900 dark:bg-[#0b1120] dark:text-white">

                      {/* ====================================
                          SIDEBAR
                      ==================================== */}

                      <Sidebar
                        isOpen={sidebarOpen}
                        setIsOpen={setSidebarOpen}
                      />

                      <div className="md:ml-[272px]">

                        {/* ==================================
                            MOBILE HEADER
                        ================================== */}

                        <header className="gate-mobile-header sticky top-0 z-30 flex h-16 items-center border-b px-4 backdrop-blur md:hidden">

                          <button
                            onClick={() =>
                              setSidebarOpen(true)
                            }
                            aria-label="Open navigation"
                            className="rounded-xl p-2 text-zinc-500 hover:bg-black/5 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                          >
                            <Menu size={22} />
                          </button>

                          <div className="ml-3 min-w-0">
                            <h1 className="text-base font-semibold text-white">
                              MPSC Rajyaseva
                            </h1>

                            <p className="text-xs text-zinc-500">
                              Study Tracker
                            </p>
                          </div>

                          <div className="ml-auto flex items-center gap-2 rounded-lg bg-purple-500/10 px-2.5 py-1.5 text-right">
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-purple-300">MPSC exam</p>
                              <p className="mt-0.5 text-[8px] text-zinc-500">{daysLeft === null ? "Set date in Settings" : isPast ? "Date passed" : "Days remaining"}</p>
                            </div>
                            {daysLeft !== null && !isPast && <span className="text-sm font-bold text-white">{daysLeft}</span>}
                          </div>
                        </header>

                        {/* ==================================
                            MAIN CONTENT
                        ================================== */}

                        <main className="gate-main-content min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">

                          <div className="gate-page-enter mx-auto w-full max-w-7xl">

                            <Routes>

                              {/* Dashboard */}

                              <Route
                                path="/"
                                element={
                                  <Dashboard />
                                }
                              />

                              {/* Timer */}

                              <Route
                                path="/timer"
                                element={
                                  <Timer />
                                }
                              />

                              {/* Heatmap */}

                              <Route
                                path="/heatmap"
                                element={
                                  <Heatmap />
                                }
                              />

                              {/* Syllabus */}

                              <Route
                                path="/syllabus"
                                element={
                                  <Syllabus />
                                }
                              />

                              {/* History */}

                              <Route
                                path="/history"
                                element={
                                  <History />
                                }
                              />

                              {/* Statistics */}

                              <Route
                                path="/statistics"
                                element={
                                  <Statistics />
                                }
                              />

                              {/* Leaderboard */}

                              <Route
                                path="/leaderboard"
                                element={
                                  <Leaderboard />
                                }
                              />

                              {/* Settings */}

                              <Route
                                path="/settings"
                                element={
                                  <Settings />
                                }
                              />

                            </Routes>

                          </div>

                        </main>

                      </div>

                    </div>
                  }
                />
              </Route>

            </Routes>
            </TimerProvider>
          </StudyProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
