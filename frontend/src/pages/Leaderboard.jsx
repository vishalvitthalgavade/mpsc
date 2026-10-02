import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Trophy,
  Clock3,
  RefreshCw,
  Users,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";


/*
====================================================
FORMAT STUDY TIME
====================================================
*/

function formatStudyTime(totalSeconds) {
  const seconds = Math.max(
    0,
    Number(totalSeconds) || 0
  );

  const hours = Math.floor(
    seconds / 3600
  );

  const minutes = Math.floor(
    (seconds % 3600) / 60
  );

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}


/*
====================================================
LEADERBOARD
====================================================
*/

function Leaderboard() {
  const { authFetch } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === "dark";

  const [selectedDate, setSelectedDate] =
    useState("today");

  const [leaderboard, setLeaderboard] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);


  /*
  ==================================================
  LOAD LEADERBOARD
  ==================================================
  */

  const loadLeaderboard = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await authFetch(
          `/sessions/leaderboard?date=${selectedDate}`
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to load leaderboard."
          );
        }

        setLeaderboard(
          Array.isArray(data?.leaderboard)
            ? data.leaderboard
            : []
        );

        setLastUpdated(
          new Date()
        );
      } catch (err) {
        console.error(
          "LEADERBOARD ERROR:",
          err
        );

        setError(
          err?.message ||
            "Unable to load leaderboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authFetch, selectedDate]
  );


  /*
  ==================================================
  INITIAL LOAD + DATE SWITCH
  ==================================================
  */

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);


  /*
  ==================================================
  LIVE REFRESH
  ==================================================

  Today updates every 5 seconds.

  Yesterday is fixed, so it doesn't need
  continuous polling.
  ==================================================
  */

  useEffect(() => {
    if (selectedDate !== "today") {
      return undefined;
    }

    const interval = setInterval(() => {
      loadLeaderboard();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [
    selectedDate,
    loadLeaderboard,
  ]);


  /*
  ==================================================
  MANUAL REFRESH
  ==================================================
  */

  function handleRefresh() {
    loadLeaderboard(true);
  }


  /*
  ==================================================
  LAST UPDATED TEXT
  ==================================================
  */

  function getLastUpdatedText() {
    if (!lastUpdated) {
      return "Not updated yet";
    }

    return lastUpdated.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  }


  /*
  ==================================================
  RENDER
  ==================================================
  */

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-300 ${
        isDark
          ? "bg-zinc-950 text-white"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">

        {/* ========================================
            HEADER
        ======================================== */}

        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-3">

            <div
              className={`shrink-0 rounded-xl p-3 ${
                isDark
                  ? "bg-purple-500/10"
                  : "bg-purple-100"
              }`}
            >
              <Trophy
                size={24}
                className="text-purple-500"
              />
            </div>

            <div>
              <h1
                className={`text-xl font-bold sm:text-3xl ${
                  isDark
                    ? "text-white"
                    : "text-slate-900"
                }`}
              >
                Study Leaderboard
              </h1>

              <p
                className={`mt-1 text-xs sm:text-sm ${
                  isDark
                    ? "text-zinc-500"
                    : "text-slate-500"
                }`}
              >
                Compare daily study time with
                other MPSC Rajyaseva students.
              </p>
            </div>

          </div>


          {/* REFRESH */}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
              isDark
                ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

        </div>


        {/* ========================================
            SLIDING TODAY / YESTERDAY TAB
        ======================================== */}

        <div
          className={`mb-6 rounded-2xl border p-1.5 sm:mb-8 ${
            isDark
              ? "border-zinc-800 bg-zinc-900"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="relative grid grid-cols-2">

            {/* SLIDING BACKGROUND */}

            <div
              className={`absolute inset-y-0 w-1/2 rounded-xl bg-purple-600 transition-transform duration-300 ${
                selectedDate === "yesterday"
                  ? "translate-x-full"
                  : "translate-x-0"
              }`}
            />

            <button
              type="button"
              onClick={() =>
                setSelectedDate("today")
              }
              className={`relative z-10 min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                selectedDate === "today"
                  ? "text-white"
                  : isDark
                  ? "text-zinc-400 hover:text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Today

              {selectedDate === "today" && (
                <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-white" />
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedDate("yesterday")
              }
              className={`relative z-10 min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                selectedDate === "yesterday"
                  ? "text-white"
                  : isDark
                  ? "text-zinc-400 hover:text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Yesterday
            </button>

          </div>
        </div>


        {/* ========================================
            LIVE STATUS
        ======================================== */}

        <div
          className={`mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            isDark
              ? "border-zinc-800 bg-zinc-900/50"
              : "border-slate-200 bg-white"
          }`}
        >

          <div className="flex items-center gap-2">

            <span
              className={`h-2.5 w-2.5 rounded-full ${
                selectedDate === "today"
                  ? "animate-pulse bg-green-500"
                  : "bg-zinc-400"
              }`}
            />

            <span
              className={`text-xs sm:text-sm ${
                isDark
                  ? "text-zinc-400"
                  : "text-slate-500"
              }`}
            >
              {selectedDate === "today"
                ? "Live study time"
                : "Yesterday's final study time"}
            </span>

          </div>

          <span
            className={`text-xs ${
              isDark
                ? "text-zinc-600"
                : "text-slate-400"
            }`}
          >
            Updated {getLastUpdatedText()}
          </span>

        </div>


        {/* ========================================
            ERROR
        ======================================== */}

        {error && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              isDark
                ? "border-red-900/50 bg-red-950/30 text-red-300"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {error}
          </div>
        )}


        {/* ========================================
            LEADERBOARD CARD
        ======================================== */}

        <div
          className={`overflow-hidden rounded-2xl border ${
            isDark
              ? "border-zinc-800 bg-zinc-900/60"
              : "border-slate-200 bg-white"
          }`}
        >

          {/* TABLE HEADER */}

          <div
            className={`hidden grid-cols-[80px_1fr_180px] gap-4 border-b px-5 py-4 text-xs font-semibold uppercase tracking-wider sm:grid ${
              isDark
                ? "border-zinc-800 text-zinc-500"
                : "border-slate-200 text-slate-400"
            }`}
          >
            <div>Rank</div>
            <div>Student</div>
            <div className="text-right">
              Study Time
            </div>
          </div>


          {/* LOADING */}

          {loading && (
            <div className="space-y-3 p-4 sm:p-5">

              {[1, 2, 3, 4, 5].map(
                (item) => (
                  <div
                    key={item}
                    className="gate-skeleton h-16 rounded-xl"
                  />
                )
              )}

            </div>
          )}


          {/* EMPTY */}

          {!loading &&
            leaderboard.length === 0 && (
              <div className="px-6 py-16 text-center">

                <Users
                  size={40}
                  className={`mx-auto mb-3 ${
                    isDark
                      ? "text-zinc-700"
                      : "text-slate-300"
                  }`}
                />

                <p
                  className={`font-medium ${
                    isDark
                      ? "text-zinc-300"
                      : "text-slate-700"
                  }`}
                >
                  No users found
                </p>

              </div>
            )}


          {/* ROWS */}

          {!loading &&
            leaderboard.map(
              (user) => (
                <div
                  key={user.userId}
                  className={`grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b px-3 py-4 last:border-b-0 sm:grid-cols-[80px_1fr_180px] sm:gap-4 sm:px-5 ${
                    user.isCurrentUser
                      ? isDark
                        ? "bg-purple-500/10"
                        : "bg-purple-50"
                      : isDark
                      ? "hover:bg-zinc-800/40"
                      : "hover:bg-slate-50"
                  } transition-colors`}
                >

                  {/* RANK */}

                  <div className="flex items-center sm:justify-center">

                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                        user.rank === 1
                          ? "bg-yellow-500/15 text-yellow-500"
                          : user.rank === 2
                          ? "bg-slate-400/15 text-slate-400"
                          : user.rank === 3
                          ? "bg-orange-500/15 text-orange-500"
                          : isDark
                          ? "bg-zinc-800 text-zinc-400"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {user.rank}
                    </div>

                  </div>


                  {/* USER */}

                  <div className="min-w-0">

                    <div className="flex min-w-0 items-center gap-2">

                      <span
                        className={`truncate text-sm font-semibold sm:text-base ${
                          isDark
                            ? "text-white"
                            : "text-slate-900"
                        }`}
                      >
                        {user.name}
                      </span>

                      {user.isCurrentUser && (
                        <span className="shrink-0 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          YOU
                        </span>
                      )}

                    </div>

                    <div
                      className={`mt-1 flex items-center gap-1 text-xs ${
                        isDark
                          ? "text-zinc-500"
                          : "text-slate-400"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          user.isStudying
                            ? "bg-green-500"
                            : user.isOnline
                            ? "bg-blue-500"
                            : "bg-zinc-400"
                        }`}
                      />

                      {user.isStudying
                        ? "Studying"
                        : "Online"}
                    </div>

                  </div>


                  {/* TIME */}

                  <div className="text-right">

                    <div
                      className={`text-sm font-bold tabular-nums sm:text-base ${
                        user.isCurrentUser
                          ? "text-purple-500"
                          : isDark
                          ? "text-white"
                          : "text-slate-900"
                      }`}
                    >
                      {formatStudyTime(
                        user.studyTime
                      )}
                    </div>

                    <div
                      className={`mt-1 text-[10px] sm:text-xs ${
                        isDark
                          ? "text-zinc-600"
                          : "text-slate-400"
                      }`}
                    >
                      total study
                    </div>

                  </div>

                </div>
              )
            )}

        </div>


        {/* ========================================
            FOOTER INFO
        ======================================== */}

        <div
          className={`mt-4 flex items-start gap-2 text-xs leading-5 ${
            isDark
              ? "text-zinc-600"
              : "text-slate-400"
          }`}
        >
          <Clock3
            size={14}
            className="mt-0.5 shrink-0"
          />

          <p>
            Today's leaderboard updates automatically
            while students are actively studying.
            Yesterday's results remain fixed.
          </p>
        </div>

      </div>
    </div>
  );
}

export default Leaderboard;