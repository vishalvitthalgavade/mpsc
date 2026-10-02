import CustomSelect from "../components/CustomSelect";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Trash2,
  Filter,
  Search,
  X,
  History as HistoryIcon,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from "lucide-react";

import { useStudy } from "../context/useStudy";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

/* =========================================================
   HELPERS
========================================================= */

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(dateValue) {
  if (!dateValue) return "Unknown date";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateValue) {
  if (!dateValue) return "--";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDisplayTimeRange(session) {
  const completed = session.completedAt ? new Date(session.completedAt) : null;
  const started = session.startedAt ? new Date(session.startedAt) : null;
  const durationSeconds = Math.max(0, Number(session.duration) || 0);

  const validStarted = started && !Number.isNaN(started.getTime()) ? started : null;
  const validCompleted = completed && !Number.isNaN(completed.getTime()) ? completed : null;

  if (!validStarted && !validCompleted) return null;
  if (!validCompleted) return `${formatTime(validStarted)} → running`;
  if (!validStarted) {
    const derivedStart = new Date(validCompleted.getTime() - durationSeconds * 1000);
    return `${formatTime(derivedStart)} → ${formatTime(validCompleted)}`;
  }

  // A merged/paused session can span a larger wall-clock interval than the
  // amount of actual study time. When the stored timestamps are clearly
  // inconsistent with the recorded duration, anchor the display to the
  // completed time so the UI never claims a false continuous study interval.
  const wallClockSeconds = Math.max(0, Math.round((validCompleted - validStarted) / 1000));

  // A completed timer with a positive duration must never render the same
  // start/end clock time. Some older/offline records contain identical
  // timestamps even though the recorded duration is valid. In that case,
  // derive the start from the real recorded duration.
  if (durationSeconds > 0 && wallClockSeconds === 0) {
    const derivedStart = new Date(
      validCompleted.getTime() - durationSeconds * 1000
    );
    return `${formatTime(derivedStart)} → ${formatTime(validCompleted)}`;
  }

  // Merged/paused sessions can legitimately span a larger wall-clock
  // interval than their active study duration. Keep the real completion
  // time and derive the earliest active-study start when the stored range
  // is clearly inconsistent.
  if (durationSeconds > 0 && wallClockSeconds > durationSeconds + 300) {
    const derivedStart = new Date(validCompleted.getTime() - durationSeconds * 1000);
    return `${formatTime(derivedStart)} → ${formatTime(validCompleted)}`;
  }

  return `${formatTime(validStarted)} → ${formatTime(validCompleted)}`;
}

function getSessionDate(session) {
  return (
    session.completedAt ||
    session.date ||
    session.createdAt ||
    session.startedAt
  );
}

function getDateKey(dateValue) {
  if (!dateValue) return "unknown";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "unknown";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeType(type) {
  return String(type || "").trim().toLowerCase();
}

function isPomodoro(type) {
  return normalizeType(type) === "pomodoro";
}

function isRegularTimer(type) {
  const value = normalizeType(type);
  return value === "regular" || value === "regular timer";
}

function isStudySession(type) {
  const value = normalizeType(type);
  return (
    value === "study" ||
    value === "regular" ||
    value === "regular timer" ||
    value === "pomodoro"
  );
}

function getTypeLabel(type) {
  const value = normalizeType(type);

  if (value === "pomodoro") return "Pomodoro";
  if (value === "regular" || value === "regular timer") return "Regular Timer";
  if (value === "study") return "Study";
  if (value === "shortbreak") return "Short Break";
  if (value === "longbreak") return "Long Break";

  return type || "Study";
}

function getTypeBadgeClass(type) {
  const value = normalizeType(type);

  if (value === "pomodoro") {
    return "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-300";
  }

  if (value === "regular" || value === "regular timer") {
    return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300";
  }

  if (value === "study") {
    return "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-300";
  }

  if (value === "shortbreak" || value === "longbreak") {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-300";
  }

  return "border-gray-200 bg-gray-100 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function getStartOfWeek(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function getEndOfWeek(date = new Date()) {
  const result = getStartOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getEndOfMonth(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
}

/* =========================================================
   HISTORY
========================================================= */

export default function History() {
  const {
    sessions,
    deleteSession,
    isLoading,
    isSyncing,
    isOnline,
  } = useStudy();
  const { authFetch } = useAuth();

  // Theme is intentionally read so the page follows the app theme.
  useTheme();

  const [activeStudy, setActiveStudy] = useState(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null);

  const fetchActiveStudy = useCallback(async () => {
    try {
      const response = await authFetch("/sessions/active");
      if (!response.ok) return;

      const data = await response.json();
      const active = data?.activeStudy;
      setActiveStudy(
        active?.isRunning
          ? { ...active, elapsedSeconds: Number(active.elapsedSeconds || 0) }
          : null
      );
      setLiveUpdatedAt(new Date());
    } catch (error) {
      console.warn("History live timer refresh failed:", error);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchActiveStudy();
    const interval = window.setInterval(fetchActiveStudy, 10_000);
    return () => window.clearInterval(interval);
  }, [fetchActiveStudy]);

  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("all");
  const [collapsedDays, setCollapsedDays] = useState(null);

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    type: null,
    sessionId: null,
  });

  const liveSeconds = Number(activeStudy?.elapsedSeconds || 0);

  const liveSession = useMemo(() => {
    if (!activeStudy) return null;
    const now = new Date().toISOString();
    return {
      id: `live-${activeStudy.id}`,
      clientId: `live-${activeStudy.id}`,
      userId: activeStudy.userId,
      subject: activeStudy.subject || "No subject",
      topic: activeStudy.topic || "No topic",
      duration: liveSeconds,
      type: activeStudy.type || "Study",
      startedAt: activeStudy.startedAt || now,
      completedAt: now,
      createdAt: now,
      isLive: true,
    };
  }, [activeStudy, liveSeconds]);

  const liveSecondsInRange = useCallback((start, end) => {
    if (!activeStudy || liveSeconds <= 0) return 0;
    const timerStart = new Date(activeStudy.startedAt || Date.now()).getTime();
    const now = Date.now();
    const overlapStart = Math.max(timerStart, start.getTime());
    const overlapEnd = Math.min(now, end.getTime());
    if (overlapEnd <= overlapStart) return 0;

    const possible = Math.floor((overlapEnd - overlapStart) / 1000);
    const elapsedBeforeRange = Math.max(0, Math.floor((overlapStart - timerStart) / 1000));
    return Math.max(0, Math.min(liveSeconds - elapsedBeforeRange, possible));
  }, [activeStudy, liveSeconds]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const dateA = new Date(getSessionDate(a)).getTime();
      const dateB = new Date(getSessionDate(b)).getTime();
      return dateB - dateA;
    });
  }, [sessions]);

  /* Today + previous 6 calendar days */
  const lastSevenDaySessions = useMemo(() => {
    const today = new Date();

    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    const historySessions = liveSession
      ? [liveSession, ...sortedSessions]
      : sortedSessions;

    return historySessions.filter((session) => {
      const value = getSessionDate(session);
      if (!value) return false;

      const date = new Date(value);

      return (
        !Number.isNaN(date.getTime()) &&
        date >= start &&
        date <= end
      );
    });
  }, [liveSession, sortedSessions]);

  const availableDates = useMemo(() => {
    const dates = new Map();

    lastSevenDaySessions.forEach((session) => {
      const value = getSessionDate(session);
      if (!value) return;

      const key = getDateKey(value);
      if (key === "unknown") return;

      dates.set(key, formatDate(value));
    });

    return [...dates.entries()];
  }, [lastSevenDaySessions]);

  /* All-time, including the currently running timer. */
  const totalTimeStudied = useMemo(() => {
    const saved = sessions.reduce(
      (total, session) => total + (Number(session.duration) || 0),
      0
    );
    return saved + liveSeconds;
  }, [sessions, liveSeconds]);

  /* Current Sunday-Saturday week */
  const weeklyStats = useMemo(() => {
    const today = new Date();
    const weekStart = getStartOfWeek(today);
    const weekEnd = getEndOfWeek(today);
    const dailySeconds = Array(7).fill(0);

    sessions.forEach((session) => {
      const dateValue = getSessionDate(session);
      if (!dateValue) return;

      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;
      if (date < weekStart || date > weekEnd) return;

      dailySeconds[date.getDay()] += Number(session.duration) || 0;
    });

    if (liveSeconds > 0) {
      const liveDate = new Date(activeStudy?.startedAt || Date.now());
      dailySeconds[liveDate.getDay()] += liveSecondsInRange(weekStart, weekEnd);
    }

    const totalSeconds = dailySeconds.reduce(
      (sum, value) => sum + value,
      0
    );

    return {
      totalSeconds,
      averageSeconds: totalSeconds / 7,
      studyDays: dailySeconds.filter((seconds) => seconds > 0).length,
      dailySeconds,
      weekStart,
      weekEnd,
    };
  }, [activeStudy, liveSeconds, liveSecondsInRange, sessions]);

  /* Current month */
  const monthlyTotal = useMemo(() => {
    const today = new Date();
    const monthStart = getStartOfMonth(today);
    const monthEnd = getEndOfMonth(today);

    const saved = sessions.reduce((total, session) => {
      const dateValue = getSessionDate(session);
      if (!dateValue) return total;

      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return total;

      if (date >= monthStart && date <= monthEnd) {
        return total + (Number(session.duration) || 0);
      }

      return total;
    }, 0);

    return saved + liveSecondsInRange(monthStart, monthEnd);
  }, [liveSecondsInRange, sessions]);

  const filteredSessions = useMemo(() => {
    return lastSevenDaySessions.filter((session) => {
      const normalized = normalizeType(session.type);

      let typeMatch = true;

      if (filterType === "pomodoro") {
        typeMatch = isPomodoro(normalized);
      }

      if (filterType === "regular") {
        typeMatch = isRegularTimer(normalized);
      }

      if (filterType === "study") {
        typeMatch = normalized === "study";
      }

      const query = searchQuery.trim().toLowerCase();

      const searchMatch =
        !query ||
        String(session.subject || "").toLowerCase().includes(query) ||
        String(session.topic || "").toLowerCase().includes(query) ||
        String(session.type || "").toLowerCase().includes(query);

      const sessionDate = getSessionDate(session);

      const dateMatch =
        selectedDate === "all" ||
        getDateKey(sessionDate) === selectedDate;

      return typeMatch && searchMatch && dateMatch;
    });
  }, [lastSevenDaySessions, filterType, searchQuery, selectedDate]);

  const filteredTotalDuration = useMemo(() => {
    return filteredSessions.reduce(
      (total, session) => total + (Number(session.duration) || 0),
      0
    );
  }, [filteredSessions]);

  const studySessionCount = useMemo(() => {
    return filteredSessions.filter((session) =>
      isStudySession(session.type)
    ).length;
  }, [filteredSessions]);

  const groupedSessions = useMemo(() => {
    const groups = {};

    filteredSessions.forEach((session) => {
      const dateValue = getSessionDate(session);
      const dateKey = dateValue ? getDateKey(dateValue) : "unknown";
      const key = dateKey === "unknown" ? "unknown" : dateKey;

      if (!groups[key]) {
        groups[key] = {
          dateValue,
          sessions: [],
        };
      }

      groups[key].sessions.push(session);
    });

    return Object.entries(groups).sort(([, groupA], [, groupB]) => {
      const dateA = new Date(groupA.dateValue || 0).getTime();
      const dateB = new Date(groupB.dateValue || 0).getTime();
      return dateB - dateA;
    });
  }, [filteredSessions]);

  const todayKey = useMemo(() => getDateKey(new Date()), []);

  const toggleDay = (dateKey) => {
    if (dateKey === todayKey) return;

    setCollapsedDays((current) => {
      const next = current
        ? new Set(current)
        : new Set(
            groupedSessions
              .map(([key]) => key)
              .filter((key) => key !== todayKey)
          );

      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const handleDelete = (id) => {
    setDeleteModal({
      open: true,
      type: "single",
      sessionId: id,
    });
  };

  const confirmDelete = async () => {
    if (deleteModal.type === "single") {
      await deleteSession(deleteModal.sessionId);
    }

    setDeleteModal({
      open: false,
      type: null,
      sessionId: null,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      open: false,
      type: null,
      sessionId: null,
    });
  };

  const clearFilters = () => {
    setFilterType("all");
    setSearchQuery("");
    setSelectedDate("all");
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <div className="gate-skeleton h-7 w-40 rounded-lg" />
          <div className="gate-skeleton h-4 w-64 rounded-lg" />
        </div>
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="gate-skeleton h-11 w-full max-w-xs rounded-xl sm:w-56" />
          <div className="gate-skeleton h-11 w-28 rounded-xl" />
          <div className="gate-skeleton h-11 w-28 rounded-xl" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="gate-skeleton h-4 w-1/3 rounded-lg" />
                  <div className="gate-skeleton h-3 w-1/2 rounded-lg" />
                </div>
                <div className="gate-skeleton h-6 w-16 shrink-0 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-full w-full max-w-full overflow-x-hidden bg-gray-50 px-2 py-3 text-gray-900 transition-colors duration-300 dark:bg-[#0b1120] dark:text-white sm:px-5 sm:py-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[1420px] min-w-0 space-y-3 sm:space-y-5 lg:space-y-6">

          {/* =================================================
              HEADER
          ================================================= */}
          <header className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 sm:px-5 sm:py-5 lg:px-7 lg:py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 sm:h-12 sm:w-12">
                  <HistoryIcon
                    size={23}
                    className="text-purple-500 dark:text-purple-400"
                  />
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-2xl lg:text-3xl">
                    Study History
                  </h1>
                  <p className="mt-0.5 line-clamp-1 text-[9px] leading-4 text-gray-500 dark:text-zinc-500 sm:mt-1 sm:text-sm">
                    Your completed study sessions from the last 7 days
                  </p>
                </div>
              </div>

              <div
                className={`self-start flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[9px] font-medium sm:self-auto sm:gap-2 sm:px-3 sm:py-2 sm:text-xs ${
                  isOnline
                    ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
                    : "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isOnline
                      ? "bg-green-500 dark:bg-green-400"
                      : "bg-yellow-500 dark:bg-yellow-400"
                  }`}
                />
                {isSyncing
                  ? "Syncing..."
                  : isOnline
                  ? "Online"
                  : "Offline"}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-gray-400 dark:text-zinc-600 sm:text-xs">
              {liveUpdatedAt
                ? `Live timer checked at ${liveUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : "Checking live timer..."}
            </p>
          </header>

          {liveSession && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 dark:bg-green-500/[0.04]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Timer running live</span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-500 dark:text-zinc-500">
                  {liveSession.subject} · {liveSession.topic}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-green-600 dark:text-green-400">
                {formatDuration(liveSeconds)}
              </span>
            </div>
          )}

          {/* =================================================
              ANALYTICS — 3 CARDS
              Mobile: 3 compact columns
              Laptop: 3 roomy columns
          ================================================= */}
          <section className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-4 lg:gap-6">
            {/* WEEKLY */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:p-5 lg:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 min-h-[22px] break-words text-[8px] leading-[10px] font-medium text-gray-500 dark:text-zinc-500 sm:min-h-0 sm:text-sm sm:leading-normal">
                    Weekly Average
                  </p>
                  <p className="mt-1 text-[14px] font-bold leading-tight text-gray-900 dark:text-white sm:mt-2 sm:text-2xl">
                    {formatDuration(Math.round(weeklyStats.averageSeconds))}
                  </p>
                </div>

                <div className="hidden shrink-0 rounded-xl bg-purple-500/10 p-2 sm:block">
                  <TrendingUp
                    size={19}
                    className="text-purple-500 dark:text-purple-400"
                  />
                </div>
              </div>

              <div className="mt-1.5 sm:mt-5">
                <div className="flex items-center justify-between gap-2 text-[8px] text-gray-500 dark:text-zinc-500 sm:text-xs">
                  <span>Sunday</span>
                  <span>Saturday</span>
                </div>

                <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800 sm:mt-2 sm:h-2">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{
                      width:
                        weeklyStats.totalSeconds > 0
                          ? `${Math.min(
                              100,
                              (weeklyStats.totalSeconds / (7 * 4 * 3600)) *
                                100
                            )}%`
                          : "0%",
                    }}
                  />
                </div>

                <p className="mt-1 line-clamp-2 break-words text-[7px] leading-[9px] text-gray-400 dark:text-zinc-600 sm:mt-2 sm:text-xs">
                  {weeklyStats.studyDays} of 7 days studied
                </p>
              </div>
            </div>

            {/* MONTHLY */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:p-5 lg:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 min-h-[22px] break-words text-[8px] leading-[10px] font-medium text-gray-500 dark:text-zinc-500 sm:min-h-0 sm:text-sm sm:leading-normal">
                    Monthly Total
                  </p>
                  <p className="mt-1 text-[14px] font-bold leading-tight text-gray-900 dark:text-white sm:mt-2 sm:text-2xl">
                    {formatDuration(monthlyTotal)}
                  </p>
                </div>

                <div className="hidden shrink-0 rounded-xl bg-blue-500/10 p-2 sm:block">
                  <BarChart3
                    size={19}
                    className="text-blue-500 dark:text-blue-400"
                  />
                </div>
              </div>

              <p className="mt-2 line-clamp-2 break-words text-[7px] leading-[9px] text-gray-400 dark:text-zinc-600 sm:mt-6 sm:text-xs">
                {new Date().toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* ALL TIME */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:p-5 lg:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 min-h-[22px] break-words text-[8px] leading-[10px] font-medium text-gray-500 dark:text-zinc-500 sm:min-h-0 sm:text-sm sm:leading-normal">
                    Total Time Studied
                  </p>
                  <p className="mt-1 text-[14px] font-bold leading-tight text-gray-900 dark:text-white sm:mt-2 sm:text-2xl">
                    {formatDuration(totalTimeStudied)}
                  </p>
                </div>

                <div className="hidden shrink-0 rounded-xl bg-green-500/10 p-2 sm:block">
                  <Clock3
                    size={19}
                    className="text-green-500 dark:text-green-400"
                  />
                </div>
              </div>

              <p className="mt-2 line-clamp-2 break-words text-[7px] leading-[9px] text-gray-400 dark:text-zinc-600 sm:mt-6 sm:text-xs">
                All saved study sessions
              </p>
            </div>
          </section>

          {/* =================================================
              SUMMARY — 3 CARDS
          ================================================= */}
          <section className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-4 lg:gap-6">
            {/* SESSIONS */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:p-5 lg:p-6">
              <div className="mb-1.5 flex items-start justify-between gap-1 sm:mb-4">
                <p className="line-clamp-2 min-h-[22px] break-words text-[8px] leading-[10px] font-medium text-gray-500 dark:text-zinc-500 sm:min-h-0 sm:text-sm sm:leading-normal">
                  Last 7 Days · Sessions
                </p>
                <div className="hidden shrink-0 rounded-xl bg-purple-500/10 p-2 sm:block">
                  <HistoryIcon
                    size={17}
                    className="text-purple-500 dark:text-purple-400"
                  />
                </div>
              </div>

              <p className="text-[15px] font-bold leading-tight text-gray-900 dark:text-white sm:text-2xl">
                {filteredSessions.length}
              </p>

              <p className="mt-1 line-clamp-2 break-words text-[7px] leading-[9px] text-gray-400 dark:text-zinc-600 sm:text-xs">
                Matching your filters
              </p>
            </div>

            {/* STUDY */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:p-5 lg:p-6">
              <div className="mb-1.5 flex items-start justify-between gap-1 sm:mb-4">
                <p className="line-clamp-2 min-h-[22px] break-words text-[8px] leading-[10px] font-medium text-gray-500 dark:text-zinc-500 sm:min-h-0 sm:text-sm sm:leading-normal">
                  Last 7 Days · Study
                </p>
                <div className="hidden shrink-0 rounded-xl bg-blue-500/10 p-2 sm:block">
                  <Clock3
                    size={17}
                    className="text-blue-500 dark:text-blue-400"
                  />
                </div>
              </div>

              <p className="text-[15px] font-bold leading-tight text-gray-900 dark:text-white sm:text-2xl">
                {studySessionCount}
              </p>

              <p className="mt-1 line-clamp-2 break-words text-[7px] leading-[9px] text-gray-400 dark:text-zinc-600 sm:text-xs">
                Pomodoro + regular study
              </p>
            </div>

            {/* FILTERED TIME */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:p-5 lg:p-6">
              <div className="mb-1.5 flex items-start justify-between gap-1 sm:mb-4">
                <p className="line-clamp-2 min-h-[22px] break-words text-[8px] leading-[10px] font-medium text-gray-500 dark:text-zinc-500 sm:min-h-0 sm:text-sm sm:leading-normal">
                  Last 7 Days · Study Time
                </p>
                <div className="hidden shrink-0 rounded-xl bg-green-500/10 p-2 sm:block">
                  <CalendarDays
                    size={17}
                    className="text-green-500 dark:text-green-400"
                  />
                </div>
              </div>

              <p className="text-[15px] font-bold leading-tight text-gray-900 dark:text-white sm:text-2xl">
                {formatDuration(filteredTotalDuration)}
              </p>

              <p className="mt-1 line-clamp-2 break-words text-[7px] leading-[9px] text-gray-400 dark:text-zinc-600 sm:text-xs">
                Time represented by filters
              </p>
            </div>
          </section>

          {/* =================================================
              FILTERS
          ================================================= */}
          <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:p-5 lg:p-6">
            <div className="mb-3 flex items-center gap-2">
              <Filter
                size={17}
                className="text-purple-500 dark:text-purple-400"
              />
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Filters
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {/* SEARCH */}
              <div className="relative min-w-0">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-600"
                />

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search subject or topic..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-9 text-[13px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-600 sm:py-3 sm:text-sm"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-white"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* TYPE */}
              <CustomSelect
                ariaLabel="Timer type"
                value={filterType}
                onChange={setFilterType}
                options={[
                  { value: "all", label: "All Timer Types" },
                  { value: "regular", label: "Regular Timer" },
                  { value: "pomodoro", label: "Pomodoro" },
                  { value: "study", label: "Study" },
                ]}
              />

              {/* DATE */}
              <CustomSelect
                ariaLabel="History date"
                value={selectedDate}
                onChange={setSelectedDate}
                options={[
                  { value: "all", label: "All Dates" },
                  ...availableDates.map(([dateKey, label]) => ({ value: dateKey, label })),
                ]}
              />
            </div>

            {(filterType !== "all" ||
              searchQuery ||
              selectedDate !== "all") && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-xs font-medium text-purple-500 hover:text-purple-400 dark:text-purple-400"
              >
                Clear filters
              </button>
            )}
          </section>

          {/* =================================================
              EMPTY STATE
          ================================================= */}
          {filteredSessions.length === 0 && (
            <section className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:px-6 sm:py-16">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-900">
                <HistoryIcon
                  size={25}
                  className="text-gray-400 dark:text-zinc-600"
                />
              </div>

              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {sessions.length === 0
                  ? "No study sessions yet"
                  : lastSevenDaySessions.length === 0
                  ? "No sessions in the last 7 days"
                  : "No matching sessions"}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-zinc-500">
                {sessions.length === 0
                  ? "Complete a timer session and your study activity will appear here."
                  : lastSevenDaySessions.length === 0
                  ? "Your older sessions are still saved, but there is no activity in the current 7-day window."
                  : "Try changing your search or filters."}
              </p>

              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-500"
                >
                  Clear Filters
                </button>
              )}
            </section>
          )}

          {/* =================================================
              7-DAY NOTICE
          ================================================= */}
          <div className="rounded-xl border border-purple-500/15 bg-purple-500/[0.04] px-3 py-2.5 dark:bg-purple-500/[0.03] sm:rounded-2xl sm:px-5 sm:py-3">
            <div className="flex items-center gap-2">
              <HistoryIcon
                size={16}
                className="shrink-0 text-purple-500 dark:text-purple-400"
              />
              <p className="text-xs font-medium text-purple-700 dark:text-purple-300 sm:text-sm">
                Showing today and the previous 6 days
              </p>
            </div>
          </div>

          {/* =================================================
              SESSION HISTORY
          ================================================= */}
          <div className="space-y-5 sm:space-y-7">
            {groupedSessions.map(([dateKey, group]) => {
              const dayTotal = group.sessions.reduce(
                (total, session) =>
                  total + (Number(session.duration) || 0),
                0
              );

              return (
                <section key={dateKey}>
                  {/* DATE HEADER */}
                  {(() => {
                    const isToday = dateKey === todayKey;
                    const isCollapsed = !isToday && (collapsedDays === null ? true : collapsedDays.has(dateKey));

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleDay(dateKey)}
                          aria-expanded={!isCollapsed}
                          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${formatDate(group.dateValue)} sessions`}
                          className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-purple-500/[0.04] sm:mb-3 sm:gap-3 sm:px-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight size={17} className="shrink-0 text-purple-500 dark:text-purple-400" />
                            ) : (
                              <ChevronDown size={17} className="shrink-0 text-purple-500 dark:text-purple-400" />
                            )}
                            <CalendarDays size={17} className="hidden shrink-0 text-purple-500 dark:text-purple-400 sm:block" />
                            <h2 className="truncate font-semibold text-gray-900 dark:text-white">
                              {isToday ? "Today" : dateKey === "unknown" ? "Unknown Date" : formatDate(group.dateValue)}
                            </h2>
                            {isToday && (
                              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-300">
                                Always visible
                              </span>
                            )}
                          </div>

                          <span className="shrink-0 text-[11px] text-gray-500 dark:text-zinc-500 sm:text-xs">
                            {group.sessions.length}{" "}
                            {group.sessions.length === 1 ? "session" : "sessions"}
                            {" · "}
                            {formatDuration(dayTotal)}
                          </span>
                        </button>

                        {/* SESSIONS */}
                        {!isCollapsed && (
                          <div className="space-y-2.5 animate-[gate-collapse-in_.2s_ease-out] sm:space-y-3">
                            {group.sessions.map((session) => (
                      <article
                        key={session.id || session.clientId}
                        className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 sm:rounded-2xl sm:p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          {/* LEFT */}
                          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-zinc-900">
                              <Clock3
                                size={19}
                                className="text-purple-500 dark:text-purple-400"
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                                <h3 className="max-w-full truncate font-semibold text-gray-900 dark:text-white">
                                  {session.subject || "No subject"}
                                </h3>

                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] ${getTypeBadgeClass(
                                    session.type
                                  )}`}
                                >
                                  {getTypeLabel(session.type)}
                                </span>

                                {session.isLive ? (
                                  <span className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium leading-none text-green-600 dark:text-green-400">
                                    Live
                                  </span>
                                ) : session.id?.startsWith("local-") ? (
                                  <span className="inline-flex items-center rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium leading-none text-yellow-600 dark:text-yellow-400">
                                    Pending sync
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium leading-none text-green-600 dark:text-green-400">
                                    Synced
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 truncate text-sm text-gray-500 dark:text-zinc-500">
                                {session.topic || "No topic"}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 dark:text-zinc-600 sm:gap-x-4 sm:text-xs">
                                {getDisplayTimeRange(session) ? (
                                  <span className="tabular-nums">
                                    {getDisplayTimeRange(session)}
                                  </span>
                                ) : (
                                  <span>Time unavailable</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* RIGHT */}
                          <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-3 dark:border-zinc-800 sm:shrink-0 sm:justify-end sm:border-0 sm:pt-0">
                            <div className="text-left sm:text-right">
                              <p className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                                {formatDuration(session.duration)}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-zinc-600">
                                duration
                              </p>
                            </div>

                            {!session.isLive && (
                              <button
                                type="button"
                                onClick={() => handleDelete(session.id)}
                                title="Delete session"
                                aria-label="Delete session"
                                className="rounded-xl p-2.5 text-gray-400 transition hover:bg-red-500/10 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400"
                              >
                                <Trash2 size={17} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </section>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================
          DELETE MODAL
      ===================================================== */}
      {deleteModal.open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle
                  size={22}
                  className="text-red-500 dark:text-red-400"
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete this session?
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-zinc-400">
                  This study session will be permanently removed from your
                  history.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
