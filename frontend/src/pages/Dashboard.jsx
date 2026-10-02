import CustomSelect from "../components/CustomSelect";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  Clock,
  Flame,
  BookOpen,
  CalendarDays,
  Play,
  ArrowRight,
  CheckCircle2,
  CloudOff,
} from "lucide-react";

import { MPSC_SYLLABUS } from "../data/syllabus";
import { useStudy } from "../context/useStudy";
import { useAuth } from "../context/AuthContext";

function formatStudyTime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "0m";
}

function formatSessionTime(date) {
  if (!date) {
    return "--";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLocalDateKey(date) {
  if (!date) {
    return null;
  }

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  const year = d.getFullYear();

  const month = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    d.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSessionDate(session) {
  return (
    session.completedAt ||
    session.date ||
    session.createdAt ||
    session.startedAt
  );
}


/*
 * Calculate consecutive study days.
 *
 * If studied today:
 * today → yesterday → ...
 *
 * If not studied today but studied yesterday:
 * yesterday → day before → ...
 */
function calculateStreak(sessions) {
  if (!sessions.length) {
    return 0;
  }

  const studyDays = new Set(
    sessions
      .map((session) =>
        getLocalDateKey(
          getSessionDate(session)
        )
      )
      .filter(Boolean)
  );

  const today = new Date();

  const todayKey =
    getLocalDateKey(today);

  const yesterday = new Date(today);

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  const yesterdayKey =
    getLocalDateKey(yesterday);

  let currentDate;

  if (studyDays.has(todayKey)) {
    currentDate = new Date(today);
  } else if (studyDays.has(yesterdayKey)) {
    currentDate = new Date(yesterday);
  } else {
    return 0;
  }

  let streak = 0;

  while (true) {
    const dateKey =
      getLocalDateKey(currentDate);

    if (!studyDays.has(dateKey)) {
      break;
    }

    streak++;

    currentDate.setDate(
      currentDate.getDate() - 1
    );
  }

  return streak;
}


function getSessionStatus(session) {
  if (session?.id?.startsWith("local-")) {
    return {
      label: "Pending sync",
      icon: CloudOff,
      className:
        "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
    };
  }

  return {
    label: "Synced",
    icon: CheckCircle2,
    className:
      "border-green-500/20 bg-green-500/10 text-green-400",
  };
}


function Dashboard() {
  const {
    sessions,
    completedTopics,
    isSyncing,
    isOnline,
  } = useStudy();
  const { user } = useAuth();

  const journeyStorageKey = `mpsc-rajyaseva-journey:${user?.id || "local"}`;
  const journeyStages = ["Foundation", "Prelims", "Mains", "Interview"];
  const [completedStages, setCompletedStages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(journeyStorageKey) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      setCompletedStages(JSON.parse(localStorage.getItem(journeyStorageKey) || "[]"));
    } catch {
      setCompletedStages([]);
    }
  }, [journeyStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(journeyStorageKey, JSON.stringify(completedStages));
    } catch {
      // Journey checkpoints are optional and should never block the dashboard.
    }
  }, [journeyStorageKey, completedStages]);

  const goalStorageKey = `gate-study-goals:${user?.id || "local"}`;
  const [goals, setGoals] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(goalStorageKey) || "null");
      return {
        daily: Number(saved?.daily) > 0 ? Number(saved.daily) : 120 * 60,
        weekly: Number(saved?.weekly) > 0 ? Number(saved.weekly) : 14 * 60 * 60,
      };
    } catch {
      return { daily: 120 * 60, weekly: 14 * 60 * 60 };
    }
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(goalStorageKey) || "null");
      if (saved) {
        setGoals({
          daily: Number(saved.daily) > 0 ? Number(saved.daily) : 120 * 60,
          weekly: Number(saved.weekly) > 0 ? Number(saved.weekly) : 14 * 60 * 60,
        });
      }
    } catch {
      // Goal preferences are optional and should never block the app.
    }
  }, [goalStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(goalStorageKey, JSON.stringify(goals));
    } catch {
      // Goal preferences are optional and should never block the app.
    }
  }, [goalStorageKey, goals]);


  // --------------------------------------------------
  // TODAY
  // --------------------------------------------------

  const todayKey =
    getLocalDateKey(new Date());

  const todaySessions = useMemo(() => {
    return sessions.filter(
      (session) =>
        getLocalDateKey(
          getSessionDate(session)
        ) === todayKey
    );
  }, [sessions, todayKey]);


  const todaySeconds = useMemo(() => {
    return todaySessions.reduce(
      (total, session) =>
        total +
        Number(session.duration || 0),
      0
    );
  }, [todaySessions]);

  const weeklySeconds = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());

    return sessions.reduce((total, session) => {
      const value = new Date(getSessionDate(session));
      if (Number.isNaN(value.getTime()) || value < start || value > now) {
        return total;
      }
      return total + Number(session.duration || 0);
    }, 0);
  }, [sessions]);

  const dailyGoalProgress = Math.min(100, Math.round((todaySeconds / goals.daily) * 100));
  const weeklyGoalProgress = Math.min(100, Math.round((weeklySeconds / goals.weekly) * 100));

  const latestSession = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(getSessionDate(b)).getTime() - new Date(getSessionDate(a)).getTime())[0] || null;
  }, [sessions]);

  const insight = useMemo(() => {
    if (!sessions.length) return "Start your first session to unlock personalized study insights.";

    const longest = sessions.reduce((best, item) =>
      Number(item.duration || 0) > Number(best.duration || 0) ? item : best
    );
    return `Your longest recorded session is ${formatStudyTime(longest.duration)}${longest.subject ? ` in ${longest.subject}` : ""}.`;
  }, [sessions]);


  // --------------------------------------------------
  // TOTAL
  // --------------------------------------------------

  const totalSeconds = useMemo(() => {
    return sessions.reduce(
      (total, session) =>
        total +
        Number(session.duration || 0),
      0
    );
  }, [sessions]);


  // --------------------------------------------------
  // STREAK
  // --------------------------------------------------

  const currentStreak = useMemo(() => {
    return calculateStreak(sessions);
  }, [sessions]);


  // --------------------------------------------------
  // SYLLABUS PROGRESS
  // --------------------------------------------------

  const syllabusStats = useMemo(() => {
    let total = 0;
    let completed = 0;

    const completedSet = new Set(
      (completedTopics || [])
        .filter((item) => item?.completed)
        .map(
          (item) =>
            `${item.subject}|||${item.unit}|||${item.topic}`
        )
    );

    Object.entries(MPSC_SYLLABUS).forEach(
      ([subject, units]) => {
        Object.entries(units).forEach(
          ([unit, topics]) => {
            total += topics.length;

            topics.forEach((topic) => {
              const key =
                `${subject}|||${unit}|||${topic}`;

              if (completedSet.has(key)) {
                completed++;
              }
            });
          }
        );
      }
    );

    return {
      total,
      completed,
      percentage:
        total === 0
          ? 0
          : Math.round(
              (completed / total) * 100
            ),
    };
  }, [completedTopics]);


  // --------------------------------------------------
  // DATE
  // --------------------------------------------------

  const currentDate =
    new Date().toLocaleDateString(
      "en-IN",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );


  // --------------------------------------------------
  // RECENT TODAY'S SESSIONS
  // --------------------------------------------------

  const recentTodaySessions = useMemo(() => {
    return [...todaySessions]
      .sort(
        (a, b) =>
          new Date(
            getSessionDate(b)
          ).getTime() -
          new Date(
            getSessionDate(a)
          ).getTime()
      )
      .slice(0, 5);
  }, [todaySessions]);


  return (
    <div className="w-full overflow-x-hidden bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-[#0b1120] dark:text-white">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <p className="mb-1.5 text-xs text-gray-500 dark:text-zinc-500 sm:mb-2 sm:text-sm">
            {currentDate}
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {(() => {
              const hour = new Date().getHours();
              const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
              return `${greeting}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`;
            })()}
          </h1>

          <p className="mt-1.5 max-w-md text-xs leading-5 text-gray-500 dark:text-zinc-500 sm:mt-2 sm:text-base">
            Track your MPSC Rajyaseva preparation and stay consistent.
          </p>

        </div>

        <Link
          to="/timer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-600/20 transition hover:bg-purple-500 active:scale-[0.98] sm:w-auto"
        >
          <Play size={18} />
          Start Studying
        </Link>

        <Link
          to="/statistics"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:text-purple-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-purple-500/40 dark:hover:text-white sm:w-auto"
        >
          View Progress
          <ArrowRight size={17} />
        </Link>

      </div>


      {/* =====================================================
          STAT CARDS
      ===================================================== */}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">

        <StatCard
          icon={Clock}
          title="Today's Study"
          value={formatStudyTime(todaySeconds)}
          description={`${todaySessions.length} session${
            todaySessions.length === 1
              ? ""
              : "s"
          } today`}
        />

        <StatCard
          icon={Flame}
          title="Current Streak"
          value={`${currentStreak} day${
            currentStreak === 1
              ? ""
              : "s"
          }`}
          description="Consecutive study days"
        />

        <StatCard
          icon={BookOpen}
          title="Syllabus"
          value={`${syllabusStats.percentage}%`}
          description={`${syllabusStats.completed} / ${syllabusStats.total} topics`}
        />

        <StatCard
          icon={CalendarDays}
          title="Total Study"
          value={formatStudyTime(totalSeconds)}
          description={`${sessions.length} saved session${
            sessions.length === 1
              ? ""
              : "s"
          }`}
        />

      </div>


      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6" aria-label="MPSC Rajyaseva journey">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">Your Rajyaseva journey</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500 sm:text-sm">Mark each milestone as you complete it. Checkpoints are saved on this device.</p>
          </div>
          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{completedStages.length} of {journeyStages.length} milestones</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {journeyStages.map((stage, index) => {
            const complete = completedStages.includes(stage);
            return (
              <button
                key={stage}
                type="button"
                aria-pressed={complete}
                onClick={() => setCompletedStages((previous) => complete ? previous.filter((item) => item !== stage) : [...previous, stage])}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-medium transition sm:text-sm ${complete ? "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200" : "border-gray-200 text-gray-600 hover:border-purple-200 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-purple-500/30"}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-[10px] dark:bg-white/10">{complete ? <CheckCircle2 size={15} /> : index + 1}</span>
                {stage}
              </button>
            );
          })}
        </div>
      </section>


      {/* =====================================================
          PROGRESS + STREAK
      ===================================================== */}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* SYLLABUS */}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6 lg:col-span-2">

          <div className="flex items-start justify-between gap-3">

            <div>

              <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                Syllabus Progress
              </h2>

              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500 sm:text-sm">
                Overall MPSC Rajyaseva preparation
              </p>

            </div>

            <span className="shrink-0 text-xl font-bold text-purple-600 dark:text-purple-400 sm:text-2xl">
              {syllabusStats.percentage}%
            </span>

          </div>


          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800 sm:mt-5 sm:h-3">

            <div
              className="h-full rounded-full bg-purple-600 transition-all duration-500"
              style={{
                width: `${syllabusStats.percentage}%`,
              }}
            />

          </div>


          <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-zinc-500">

            <span>
              {syllabusStats.completed} completed
            </span>

            <span>
              {syllabusStats.total -
                syllabusStats.completed}{" "}
              remaining
            </span>

          </div>


          <Link
            to="/syllabus"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-xs font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98] dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white sm:mt-6 sm:text-sm"
          >
            Open Syllabus
            <ArrowRight size={16} />
          </Link>

        </div>


        {/* STREAK */}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">

          <div className="flex items-center gap-2.5 sm:gap-3">

            <div className="shrink-0 rounded-xl bg-orange-500/10 p-2.5 sm:p-3">
              <Flame
                size={22}
                className="text-orange-400"
              />
            </div>

            <div>

              <h2 className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                Study Streak
              </h2>

              <p className="text-[11px] text-gray-500 dark:text-zinc-500 sm:text-xs">
                Keep it going!
              </p>

            </div>

          </div>


          <div className="mt-6 sm:mt-8">

            <p className="text-4xl font-bold text-gray-900 dark:text-white sm:text-5xl">
              {currentStreak}
            </p>

            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500">
              consecutive day
              {currentStreak === 1
                ? ""
                : "s"}
            </p>

          </div>


          <Link
            to="/heatmap"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-xs font-medium text-gray-800 transition hover:bg-gray-200 active:scale-[0.98] dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 sm:mt-8 sm:text-sm"
          >
            View Heatmap
            <ArrowRight size={16} />
          </Link>

        </div>

      </div>


      {/* =====================================================
          GOALS + INSIGHTS
      ===================================================== */}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-500">Daily focus</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">Study goals</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">Goals are stored locally as your personal preference; progress uses saved study sessions.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CustomSelect
                ariaLabel="Daily study goal"
                value={goals.daily}
                onChange={(value) => setGoals((current) => ({ ...current, daily: Number(value) }))}
                options={[30, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720].map((minutes) => ({
                  value: minutes * 60,
                  label: `${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`} daily`,
                }))}
                className="w-full sm:w-auto sm:min-w-[130px]"
              />
              <CustomSelect
                ariaLabel="Weekly study goal"
                value={goals.weekly}
                onChange={(value) => setGoals((current) => ({ ...current, weekly: Number(value) }))}
                options={[7, 10, 14, 18, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84].map((hours) => ({
                  value: hours * 60 * 60,
                  label: `${hours}h weekly`,
                }))}
                className="w-full sm:w-auto sm:min-w-[130px]"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <GoalProgress label="Today's Goal" value={todaySeconds} goal={goals.daily} progress={dailyGoalProgress} />
            <GoalProgress label="Weekly Goal" value={weeklySeconds} goal={goals.weekly} progress={weeklyGoalProgress} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/timer" className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-600/15">
              <Play size={15} /> Start Timer
            </Link>
            <Link to="/syllabus" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-200">
              <BookOpen size={15} /> View Syllabus
            </Link>
            <Link to="/history" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-200">
              <CalendarDays size={15} /> History
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-500">Study insight</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">Keep your momentum</h2>
          <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-zinc-400">{insight}</p>

          {latestSession ? (
            <Link to="/timer" className="mt-5 block rounded-xl border border-purple-500/15 bg-purple-500/[0.04] p-4 transition hover:border-purple-500/30 hover:bg-purple-500/[0.07]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-500">Continue studying</p>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-white">{latestSession.subject || "Your last subject"}</p>
              <p className="mt-1 truncate text-xs text-gray-500 dark:text-zinc-500">{latestSession.topic || "Continue from your last session"}</p>
            </Link>
          ) : null}
        </div>
      </div>


      {/* =====================================================
          TODAY'S SESSIONS
      ===================================================== */}

      <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/40 sm:mt-6">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 dark:border-zinc-800 sm:px-6 sm:py-5">

          <div>

            <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
              Today's Sessions
            </h2>

            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500 sm:text-sm">
              Your study activity today
            </p>

          </div>

          <Link
            to="/history"
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-purple-600 transition hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 sm:text-sm"
          >
            View All
            <ArrowRight size={15} />
          </Link>

        </div>


        {recentTodaySessions.length === 0 ? (

          <div className="px-4 py-10 text-center sm:px-6 sm:py-12">

            <Clock
              size={32}
              className="mx-auto text-gray-300 dark:text-zinc-700"
            />

            <p className="mt-4 text-sm font-medium text-gray-600 dark:text-zinc-400">
              No study sessions today
            </p>

            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
              Start a timer to record your first
              session.
            </p>

            <Link
              to="/timer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-xs font-medium text-white shadow-md shadow-purple-600/20 hover:bg-purple-500 active:scale-[0.98] sm:text-sm"
            >
              <Play size={15} />
              Start Timer
            </Link>

          </div>

        ) : (

          <div className="divide-y divide-gray-200 dark:divide-zinc-800">

            {recentTodaySessions.map(
              (session) => {

                const status =
                  getSessionStatus(session);

                const StatusIcon =
                  status.icon;

                return (
                  <div
                    key={
                      session.id ||
                      session.clientId
                    }
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
                  >

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">

                        <span className="rounded-md bg-purple-500/10 px-2 py-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 sm:text-xs">
                          {session.type ||
                            "Study"}
                        </span>

                        <span className="text-[11px] text-gray-400 dark:text-zinc-600 sm:text-xs">
                          {formatSessionTime(
                            getSessionDate(
                              session
                            )
                          )}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${status.className}`}
                        >
                          <StatusIcon
                            size={11}
                          />

                          {status.label}
                        </span>

                      </div>


                      <p className="mt-2 truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {session.subject ||
                          "No subject"}
                      </p>

                      <p className="mt-1 truncate text-xs text-gray-500 dark:text-zinc-500">
                        {session.topic ||
                          "No topic"}
                      </p>

                    </div>


                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-zinc-800 sm:block sm:border-0 sm:pt-0 sm:text-right">

                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatStudyTime(
                          Number(
                            session.duration ||
                            0
                          )
                        )}
                      </p>

                      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
                        Study time
                      </p>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        )}

      </div>


      {/* =====================================================
          SYNC STATUS
      ===================================================== */}

      <div className="mt-4 flex justify-end px-0.5 pb-1 sm:px-0">

        <div
          className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs sm:w-auto ${
            isOnline
              ? "border-green-500/20 bg-green-500/10 text-green-500 dark:text-green-400"
              : "border-yellow-500/20 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400"
          }`}
        >

          <span
            className={`h-2 w-2 rounded-full ${
              isOnline
                ? "bg-green-400"
                : "bg-yellow-400"
            }`}
          />

          {isSyncing
            ? "Syncing data..."
            : isOnline
              ? "Data synced"
              : "Offline mode"}

        </div>

      </div>

    </div>
  );
}


function GoalProgress({ label, value, goal, progress }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/45">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-600 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
        {formatStudyTime(value)} / {formatStudyTime(goal)}
      </p>
    </div>
  );
}


function StatCard({
  icon: Icon,
  title,
  value,
  description,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-5">

      <div className="flex items-center gap-2.5 sm:gap-3">

        <div className="shrink-0 rounded-xl bg-purple-500/10 p-2.5 sm:p-3">

          <Icon
            size={21}
            className="text-purple-600 dark:text-purple-400"
          />

        </div>

        <p className="text-xs text-gray-500 dark:text-zinc-500 sm:text-sm">
          {title}
        </p>

      </div>


      <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white sm:mt-5 sm:text-3xl">
        {value}
      </p>


      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
        {description}
      </p>

    </div>
  );
}

export default Dashboard;
