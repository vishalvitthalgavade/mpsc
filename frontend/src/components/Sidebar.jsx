import {
  LayoutDashboard,
  Timer,
  Flame,
  BookOpen,
  History,
  BarChart3,
  Trophy,
  X,
  LogOut,
  Sun,
  Moon,
  Settings,
  User,
} from "lucide-react";

import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useTimer } from "../context/TimerContext";
import { useExamCountdown } from "../context/useExamCountdown";
import { NavLink, useNavigate } from "react-router-dom";

function formatSidebarTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [
      hours,
      minutes,
      seconds,
    ]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
}

function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    isRunning,
    timerMode,
    simpleSeconds,
    pomodoroSeconds,
    pauseSimpleTimer,
    pausePomodoro,
    startSimpleTimer,
    startPomodoro,
    simpleRunning,
    pomodoroRunning,
  } = useTimer();

  const navigate = useNavigate();
  const { daysLeft, isPast } = useExamCountdown();

  const menuItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Timer",
      path: "/timer",
      icon: Timer,
    },
    {
      name: "Heatmap",
      path: "/heatmap",
      icon: Flame,
    },
    {
      name: "Syllabus",
      path: "/syllabus",
      icon: BookOpen,
    },
    {
      name: "History",
      path: "/history",
      icon: History,
    },
    {
      name: "Statistics",
      path: "/statistics",
      icon: BarChart3,
    },
    {
      name: "Leaderboard",
      path: "/leaderboard",
      icon: Trophy,
    },
  ];

  async function handleLogout() {
    await logout();

    setIsOpen(false);
    navigate("/login", { replace: true });
  }

  function openSettings() {
    setIsOpen(false);
    navigate("/settings");
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`gate-sidebar 
          fixed left-0 top-0 z-50
          flex h-screen w-64 flex-col
          border-r
          transition-all duration-300

          ${
            theme === "dark"
              ? "border-zinc-800 bg-zinc-950"
              : "border-gray-200 bg-white"
          }

          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        {/* MPSC Rajyaseva */}
        <div
          className={`
            border-b px-5 py-5

            ${
              theme === "dark"
                ? "border-zinc-800"
                : "border-gray-200"
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1
                className={`
                  text-xl font-bold
                  ${
                    theme === "dark"
                      ? "text-white"
                      : "text-gray-900"
                  }
                `}
              >
                MPSC Rajyaseva
              </h1>

              <p
                className={`
                  mt-1 text-sm
                  ${
                    theme === "dark"
                      ? "text-zinc-500"
                      : "text-gray-500"
                  }
                `}
              >
                Study Tracker
              </p>
            </div>

            {/* Mobile Close */}
            <button
              onClick={() => setIsOpen(false)}
              className={`
                rounded-lg p-2 transition
                md:hidden

                ${
                  theme === "dark"
                    ? "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }
              `}
            >
              <X size={22} />
            </button>
          </div>

          <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${theme === "dark" ? "border-purple-500/20 bg-purple-500/10" : "border-purple-200 bg-purple-50"}`}>
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${theme === "dark" ? "text-purple-300" : "text-purple-700"}`}>MPSC Exam</p>
              <p className={`mt-1 text-xs ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>
                {daysLeft === null ? "Set date in Settings" : isPast ? "Exam date passed" : "Days remaining"}
              </p>
            </div>
            {daysLeft === null ? (
              <NavLink to="/settings" onClick={() => setIsOpen(false)} className="text-xs font-semibold text-purple-600 dark:text-purple-300">Set date</NavLink>
            ) : !isPast ? (
              <span className={`text-2xl font-extrabold leading-none ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{daysLeft}</span>
            ) : (
              <NavLink to="/settings" onClick={() => setIsOpen(false)} className="text-xs font-semibold text-purple-600 dark:text-purple-300">Change</NavLink>
            )}
          </div>
        </div>

        {isRunning && (
          <div className="px-4 pt-3">
            <div
              className={`gate-timer-card-live rounded-xl border px-3 py-3 ${
                theme === "dark"
                  ? "border-purple-500/20 bg-purple-500/10"
                  : "border-purple-200 bg-purple-50"
              }`}
            >
              <p
                className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                  theme === "dark"
                    ? "text-purple-300"
                    : "text-purple-700"
                }`}
              >
                <span className="gate-live-dot" aria-hidden="true" />
                {timerMode === "pomodoro" ? "Pomodoro" : "Study timer"}
              </p>
              <p
                className={`mt-1 font-mono text-xl font-bold tabular-nums gate-timer-digits gate-timer-live ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                <span
                  key={
                    timerMode === "pomodoro" ? pomodoroSeconds : simpleSeconds
                  }
                  className="gate-timer-tick"
                >
                  {formatSidebarTime(
                    timerMode === "pomodoro"
                      ? pomodoroSeconds
                      : simpleSeconds
                  )}
                </span>
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (simpleRunning) {
                      pauseSimpleTimer();
                    } else if (pomodoroRunning) {
                      pausePomodoro();
                    } else if (timerMode === "pomodoro") {
                      startPomodoro();
                    } else {
                      startSimpleTimer();
                    }
                  }}
                  className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-purple-500 active:scale-[0.97]"
                >
                  {simpleRunning || pomodoroRunning ? "Pause" : "Start"}
                </button>
                <NavLink
                  to="/timer"
                  onClick={() => setIsOpen(false)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-[0.97] ${
                    theme === "dark"
                      ? "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                      : "bg-white text-gray-700 hover:bg-slate-100"
                  }`}
                >
                  Open
                </NavLink>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-purple-600 text-white"
                      : theme === "dark"
                        ? "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div
          className={`
            border-t p-4
            ${
              theme === "dark"
                ? "border-zinc-800"
                : "border-gray-200"
            }
          `}
        >
          {/* Clickable User / Settings */}
          {user && (
            <button
              type="button"
              onClick={openSettings}
              className={`
                mb-3 flex w-full items-center gap-3 rounded-xl
                border px-3 py-3 text-left transition

                ${
                  theme === "dark"
                    ? "border-zinc-800 bg-zinc-900/70 hover:border-purple-500/30 hover:bg-zinc-900"
                    : "border-gray-200 bg-gray-100 hover:border-purple-200 hover:bg-purple-50"
                }
              `}
            >
              <div
                className={`
                  flex h-10 w-10 shrink-0 items-center justify-center
                  rounded-full text-sm font-bold

                  ${
                    theme === "dark"
                      ? "bg-purple-600/20 text-purple-300"
                      : "bg-purple-100 text-purple-700"
                  }
                `}
              >
                {user.name?.trim()?.charAt(0)?.toUpperCase() || (
                  <User size={18} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`
                    truncate text-sm font-semibold
                    ${
                      theme === "dark"
                        ? "text-white"
                        : "text-gray-900"
                    }
                  `}
                >
                  {user.name}
                </p>

                <p
                  className={`
                    mt-0.5 truncate text-xs
                    ${
                      theme === "dark"
                        ? "text-zinc-500"
                        : "text-gray-500"
                    }
                  `}
                >
                  {user.email}
                </p>

                <p
                  className={`
                    mt-1 text-[10px] font-medium
                    ${
                      theme === "dark"
                        ? "text-purple-400"
                        : "text-purple-600"
                    }
                  `}
                >
                  Account Settings
                </p>
              </div>

              <Settings
                size={17}
                className={
                  theme === "dark"
                    ? "shrink-0 text-zinc-500"
                    : "shrink-0 text-gray-400"
                }
              />
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`
              mb-2 flex w-full items-center
              justify-between rounded-lg px-3 py-3
              text-sm font-medium transition

              ${
                theme === "dark"
                  ? "text-zinc-300 hover:bg-zinc-900"
                  : "text-gray-700 hover:bg-gray-100"
              }
            `}
          >
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon size={19} />
              ) : (
                <Sun size={19} />
              )}

              <span>
                {theme === "dark"
                  ? "Dark Mode"
                  : "Light Mode"}
              </span>
            </div>

            <div
              className={`
                relative h-6 w-11
                rounded-full transition-colors

                ${
                  theme === "dark"
                    ? "bg-purple-600"
                    : "bg-gray-300"
                }
              `}
            >
              <div
                className={`
                  absolute top-1 h-4 w-4
                  rounded-full bg-white
                  shadow-sm transition-transform

                  ${
                    theme === "dark"
                      ? "translate-x-6"
                      : "translate-x-1"
                  }
                `}
              />
            </div>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`
              flex w-full items-center gap-3
              rounded-lg px-3 py-2.5
              text-sm font-medium transition

              ${
                theme === "dark"
                  ? "text-zinc-400 hover:bg-red-950/40 hover:text-red-400"
                  : "text-gray-600 hover:bg-red-50 hover:text-red-600"
              }
            `}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>

          <p
            className={`
              mt-3 text-center text-xs
              ${
                theme === "dark"
                  ? "text-zinc-700"
                  : "text-gray-400"
              }
            `}
          >
            MPSC Rajyaseva Tracker
          </p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
