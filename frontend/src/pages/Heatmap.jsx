import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Flame,
} from "lucide-react";

import { useStudy } from "../context/useStudy";
import { useTheme } from "../context/ThemeContext";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAY_NAMES = [
  "S",
  "M",
  "T",
  "W",
  "T",
  "F",
  "S",
];


/* =========================================================
   HELPERS
========================================================= */

function pad(value) {
  return String(value).padStart(2, "0");
}

function getDateKey(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function createDateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(
    0,
    Number(seconds) || 0
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${totalSeconds}s`;
}

function formatTime(dateValue) {
  if (!dateValue) {
    return "--";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSessionDate(session) {
  return (
    session.completedAt ||
    session.date ||
    session.createdAt ||
    session.startedAt
  );
}


/* =========================================================
   LEETCODE STYLE INTENSITY

   Different colors for Light / Dark mode
========================================================= */

function getIntensityClass(seconds, theme) {
  // Presentation-only mapping: 6 hours is the maximum visual intensity.
  // Study-time calculation/storage remains unchanged.
  const hours = Math.max(0, Number(seconds) || 0) / 3600;

  if (hours <= 0) {
    return theme === "dark"
      ? "bg-[#161b22] border-[#30363d]"
      : "bg-gray-100 border-gray-200";
  }

  if (theme === "dark") {
    if (hours < 1) return "bg-[#0e4429] border-[#0e4429]";
    if (hours < 2) return "bg-[#006d32] border-[#006d32]";
    if (hours < 3) return "bg-[#12843f] border-[#12843f]";
    if (hours < 4) return "bg-[#26a641] border-[#26a641]";
    if (hours < 5) return "bg-[#2fb94a] border-[#2fb94a]";
    return "bg-[#39d353] border-[#39d353]";
  }

  if (hours < 1) return "bg-green-100 border-green-200";
  if (hours < 2) return "bg-green-200 border-green-300";
  if (hours < 3) return "bg-green-300 border-green-300";
  if (hours < 4) return "bg-green-400 border-green-400";
  if (hours < 5) return "bg-green-500 border-green-500";
  return "bg-green-700 border-green-700";
}


/* =========================================================
   CHECK TODAY
========================================================= */

function isToday(year, month, day) {
  const today = new Date();

  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  );
}


/* =========================================================
   CREATE MONTH GRID

   rows = 7 days
   columns = weeks

   row 0 = Sunday
   row 1 = Monday
   row 2 = Tuesday
   row 3 = Wednesday
   row 4 = Thursday
   row 5 = Friday
   row 6 = Saturday
========================================================= */

function createMonthGrid(
  year,
  month,
  dailyData
) {
  const firstDay = new Date(
    year,
    month,
    1
  ).getDay();

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const weekCount = Math.ceil(
    (firstDay + daysInMonth) / 7
  );

  const rows = Array.from(
    { length: 7 },
    () => Array(weekCount).fill(null)
  );

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    const date = new Date(
      year,
      month,
      day
    );

    const weekday = date.getDay();

    const weekIndex = Math.floor(
      (firstDay + day - 1) / 7
    );

    const key = createDateKey(
      year,
      month,
      day
    );

    rows[weekday][weekIndex] = {
      day,
      key,
      data:
        dailyData[key] || {
          seconds: 0,
          sessions: [],
        },
    };
  }

  return rows;
}


/* =========================================================
   HEATMAP
========================================================= */

export default function Heatmap() {
  const {
    sessions,
    isLoading,
  } = useStudy();

  const { theme } = useTheme();

  const currentDate = new Date();

  const [year, setYear] = useState(
    currentDate.getFullYear()
  );

  const [selectedDate, setSelectedDate] =
    useState(
      getDateKey(currentDate)
    );


  /* =======================================================
     DAILY DATA
  ======================================================= */

  const dailyData = useMemo(() => {
    const result = {};

    sessions.forEach((session) => {
      const dateValue =
        getSessionDate(session);

      if (!dateValue) {
        return;
      }

      const key =
        getDateKey(dateValue);

      if (!key) {
        return;
      }

      if (!result[key]) {
        result[key] = {
          seconds: 0,
          sessions: [],
        };
      }

      result[key].seconds +=
        Number(session.duration) || 0;

      result[key].sessions.push(session);
    });

    return result;
  }, [sessions]);


  /* =======================================================
     YEAR STATISTICS
  ======================================================= */

  const yearStats = useMemo(() => {
    let totalSeconds = 0;
    let studyDays = 0;

    Object.entries(dailyData).forEach(
      ([key, data]) => {
        if (
          key.startsWith(`${year}-`) &&
          data.seconds > 0
        ) {
          totalSeconds += data.seconds;
          studyDays++;
        }
      }
    );

    return {
      totalSeconds,
      studyDays,
    };
  }, [dailyData, year]);


  /* =======================================================
     MONTH STATISTICS
  ======================================================= */

  const monthStats = useMemo(() => {
    return MONTH_NAMES.map(
      (_, monthIndex) => {
        let totalSeconds = 0;
        let studyDays = 0;

        const daysInMonth =
          new Date(
            year,
            monthIndex + 1,
            0
          ).getDate();

        for (
          let day = 1;
          day <= daysInMonth;
          day++
        ) {
          const key = createDateKey(
            year,
            monthIndex,
            day
          );

          const seconds =
            dailyData[key]?.seconds || 0;

          totalSeconds += seconds;

          if (seconds > 0) {
            studyDays++;
          }
        }

        return {
          totalSeconds,
          studyDays,
        };
      }
    );
  }, [dailyData, year]);


  /* =======================================================
     SELECTED DAY
  ======================================================= */

  const selectedDayData =
    selectedDate
      ? dailyData[selectedDate]
      : null;

  const selectedDaySessions =
    selectedDayData?.sessions || [];

  const selectedDaySeconds =
    selectedDayData?.seconds || 0;


  /* =======================================================
     YEAR NAVIGATION
  ======================================================= */

  const previousYear = () => {
    setYear(
      (previous) => previous - 1
    );

    setSelectedDate(null);
  };

  const nextYear = () => {
    setYear(
      (previous) => previous + 1
    );

    setSelectedDate(null);
  };

  const goToCurrentYear = () => {
    const now = new Date();

    setYear(now.getFullYear());

    setSelectedDate(
      getDateKey(now)
    );
  };


  /* =======================================================
     LOADING
  ======================================================= */

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <div className="gate-skeleton h-7 w-48 rounded-lg" />
          <div className="gate-skeleton h-4 w-72 rounded-lg" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">
          <div className="gate-skeleton mb-5 h-5 w-40 rounded-lg" />
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: 91 }).map((_, i) => (
              <div key={i} className="gate-skeleton aspect-square rounded-[4px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="min-h-full space-y-6 bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-[#0b1120] dark:text-white">


      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-3">

          <div className="rounded-xl bg-green-500/10 p-2.5">

            <Flame
              size={24}
              className="text-green-500 dark:text-green-400"
            />

          </div>

          <div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Study Heatmap
            </h1>

            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">
              Track your study consistency
            </p>

          </div>

        </div>


        {/* CURRENT YEAR */}

        <button
          onClick={goToCurrentYear}
          className="self-start rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-green-500/40 hover:text-gray-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:text-white sm:self-auto"
        >
          Current Year
        </button>

      </div>


      {/* ===================================================
          YEAR NAVIGATION
      =================================================== */}

      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">

        <button
          onClick={previousYear}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-white"
          title="Previous year"
        >
          <ChevronLeftIcon />
        </button>


        <div className="text-center">

          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {year}
          </h2>

          <p className="text-xs text-gray-500 dark:text-zinc-600">
            {yearStats.studyDays} study days ·{" "}
            {formatDuration(
              yearStats.totalSeconds
            )}
          </p>

        </div>


        <button
          onClick={nextYear}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-white"
          title="Next year"
        >
          <ChevronRightIcon />
        </button>

      </div>


      {/* ===================================================
          HEATMAP
      =================================================== */}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors dark:border-zinc-800 dark:bg-[#0d1117] sm:p-6">


        {/* HEATMAP HEADER */}

        <div className="mb-5 flex items-center gap-2">

          <CalendarDays
            size={18}
            className="text-green-500 dark:text-green-400"
          />

          <h2 className="font-semibold text-gray-900 dark:text-white">
            {year} Study Activity
          </h2>

        </div>


        {/* =================================================
            RESPONSIVE HORIZONTAL SCROLL
        ================================================= */}

        <div className="overflow-x-auto pb-3">

          <div className="min-w-[1120px]">


            {/* =================================================
                MONTHS
            ================================================= */}

            <div className="flex">

              {MONTH_NAMES.map(
                (monthName, monthIndex) => {

                  const monthGrid =
                    createMonthGrid(
                      year,
                      monthIndex,
                      dailyData
                    );

                  const weekCount =
                    monthGrid[0].length;

                  return (
                    <div
                      key={monthName}
                      className="mr-5 shrink-0 last:mr-0"
                    >


                      {/* MONTH HEADER */}

                      <div className="mb-3 text-center">

                        <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                          {monthName}
                        </h3>

                        <p className="mt-0.5 text-[9px] text-gray-400 dark:text-zinc-600">
                          {
                            monthStats[
                              monthIndex
                            ].studyDays
                          }{" "}
                          days
                        </p>

                      </div>


                      {/* 7 ROWS */}

                      <div className="flex">


                        {/* DAY LABELS */}

                        <div className="mr-2 flex flex-col gap-[3px]">

                          {DAY_NAMES.map(
                            (day, index) => (
                              <div
                                key={`${day}-${index}`}
                                className="flex h-[12px] w-[10px] items-center justify-center text-[8px] text-gray-400 dark:text-zinc-600"
                              >
                                {day}
                              </div>
                            )
                          )}

                        </div>


                        {/* 7 ROWS × WEEKS */}

                        <div
                          className="grid"
                          style={{
                            gridTemplateRows:
                              "repeat(7, 12px)",
                            gridTemplateColumns: `repeat(${weekCount}, 12px)`,
                            gap: "3px",
                          }}
                        >

                          {monthGrid.map(
                            (row, rowIndex) =>
                              row.map(
                                (
                                  cell,
                                  weekIndex
                                ) => {

                                  if (!cell) {
                                    return (
                                      <div
                                        key={`${monthIndex}-${rowIndex}-${weekIndex}`}
                                        className="h-[12px] w-[12px]"
                                      />
                                    );
                                  }


                                  const seconds =
                                    cell.data
                                      .seconds;

                                  const active =
                                    selectedDate ===
                                    cell.key;

                                  const today =
                                    isToday(
                                      year,
                                      monthIndex,
                                      cell.day
                                    );


                                  return (
                                    <button
                                      key={
                                        cell.key
                                      }
                                      onClick={() =>
                                        setSelectedDate(
                                          cell.key
                                        )
                                      }
                                      title={`${new Date(
                                        `${cell.key}T00:00:00`
                                      ).toLocaleDateString(
                                        "en-IN",
                                        {
                                          weekday:
                                            "short",
                                          day: "numeric",
                                          month:
                                            "short",
                                          year:
                                            "numeric",
                                        }
                                      )} — ${formatDuration(
                                        seconds
                                      )} · ${
                                        cell.data
                                          .sessions
                                          .length
                                      } ${
                                        cell.data
                                          .sessions
                                          .length ===
                                        1
                                          ? "session"
                                          : "sessions"
                                      }`}
                                      className={`relative h-[12px] w-[12px] rounded-[2px] border transition-all duration-100 hover:z-10 hover:scale-150 ${getIntensityClass(
                                        seconds,
                                        theme
                                      )} ${
                                        active
                                          ? theme ===
                                            "dark"
                                            ? "ring-2 ring-white ring-offset-1 ring-offset-[#0d1117]"
                                            : "ring-2 ring-gray-900 ring-offset-1 ring-offset-white"
                                          : ""
                                      } ${
                                        today
                                          ? "outline outline-1 outline-green-400 outline-offset-1 dark:outline-green-300"
                                          : ""
                                      }`}
                                    />
                                  );
                                }
                              )
                          )}

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        </div>


        {/* =================================================
            LEGEND
        ================================================= */}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-zinc-900">

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-600">
            <span>0h</span>

            <div className="h-3 w-3 rounded-[2px] border border-gray-200 bg-gray-100 dark:hidden" />
            <div className="hidden h-3 w-3 rounded-[2px] border border-[#30363d] bg-[#161b22] dark:block" />

            <div className="h-3 w-3 rounded-[2px] border border-green-200 bg-green-100 dark:hidden" />
            <div className="h-3 w-3 rounded-[2px] border border-green-300 bg-green-200 dark:hidden" />
            <div className="h-3 w-3 rounded-[2px] border border-green-300 bg-green-300 dark:hidden" />
            <div className="h-3 w-3 rounded-[2px] border border-green-400 bg-green-400 dark:hidden" />
            <div className="h-3 w-3 rounded-[2px] border border-green-500 bg-green-500 dark:hidden" />
            <div className="h-3 w-3 rounded-[2px] border border-green-700 bg-green-700 dark:hidden" />

            <div className="hidden h-3 w-3 rounded-[2px] border border-[#0e4429] bg-[#0e4429] dark:block" />
            <div className="hidden h-3 w-3 rounded-[2px] border border-[#006d32] bg-[#006d32] dark:block" />
            <div className="hidden h-3 w-3 rounded-[2px] border border-[#12843f] bg-[#12843f] dark:block" />
            <div className="hidden h-3 w-3 rounded-[2px] border border-[#26a641] bg-[#26a641] dark:block" />
            <div className="hidden h-3 w-3 rounded-[2px] border border-[#2fb94a] bg-[#2fb94a] dark:block" />
            <div className="hidden h-3 w-3 rounded-[2px] border border-[#39d353] bg-[#39d353] dark:block" />

            <span>6h+</span>
          </div>


          <div className="text-xs text-gray-400 dark:text-zinc-600">

            {yearStats.studyDays} study days ·{" "}

            {formatDuration(
              yearStats.totalSeconds
            )}

          </div>

        </div>

      </div>


      {/* ===================================================
          SELECTED DAY
      =================================================== */}

      {selectedDate && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950">


          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="font-semibold text-gray-900 dark:text-white">

                {new Date(
                  `${selectedDate}T00:00:00`
                ).toLocaleDateString(
                  "en-IN",
                  {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }
                )}

              </h2>


              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">

                {selectedDaySessions.length}{" "}

                {selectedDaySessions.length ===
                1
                  ? "session"
                  : "sessions"}

                {" · "}

                {formatDuration(
                  selectedDaySeconds
                )}

              </p>

            </div>


            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-500">

              <Clock3 size={16} />

              {formatDuration(
                selectedDaySeconds
              )}

            </div>

          </div>


          {selectedDaySessions.length ===
          0 ? (

            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/40">

              <p className="text-sm text-gray-400 dark:text-zinc-600">
                No study sessions on this day.
              </p>

            </div>

          ) : (

            <div className="space-y-2">

              {selectedDaySessions
                .slice()
                .sort((a, b) => {
                  return (
                    new Date(
                      getSessionDate(b)
                    ).getTime() -
                    new Date(
                      getSessionDate(a)
                    ).getTime()
                  );
                })
                .map((session) => (

                  <div
                    key={
                      session.id ||
                      session.clientId
                    }
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between"
                  >

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {session.subject ||
                            "No subject"}
                        </h3>

                        <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-600 dark:text-green-300">
                          {session.type ||
                            "Study"}
                        </span>

                      </div>


                      <p className="mt-1 truncate text-sm text-gray-500 dark:text-zinc-500">
                        {session.topic ||
                          "No topic"}
                      </p>


                      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
                        {formatTime(
                          getSessionDate(
                            session
                          )
                        )}
                      </p>

                    </div>


                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">

                      <Clock3
                        size={15}
                        className="text-green-500 dark:text-green-400"
                      />

                      {formatDuration(
                        session.duration
                      )}

                    </div>

                  </div>

                ))}

            </div>

          )}

        </div>
      )}


      {/* ===================================================
          EMPTY STATE
      =================================================== */}

      {sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">

          <Flame
            size={28}
            className="mx-auto mb-3 text-gray-300 dark:text-zinc-700"
          />

          <h2 className="font-semibold text-gray-900 dark:text-white">
            Start studying to build your heatmap
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-zinc-600">
            Complete sessions using the Timer
            page and your daily study activity
            will appear here automatically.
          </p>

        </div>
      )}

    </div>
  );
}


/* =========================================================
   NAVIGATION ICONS
========================================================= */

function ChevronLeftIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}


function ChevronRightIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}