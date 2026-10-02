import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { MPSC_SYLLABUS, MPSC_OFFICIAL_LINKS } from "../data/syllabus";
import { useTheme } from "../context/ThemeContext";
import { useStudy } from "../context/useStudy";

/* =========================================================
   STORAGE KEYS
========================================================= */

const CUSTOM_SYLLABUS_STORAGE_KEY =
  "gate-custom-syllabus";

const DELETED_TOPICS_STORAGE_KEY =
  "gate-deleted-syllabus-topics";

const DELETED_UNITS_STORAGE_KEY =
  "gate-deleted-syllabus-units";

const COMPLETED_MIGRATION_KEY =
  "gate-completed-topics-migrated";

/* =========================================================
   HELPERS
========================================================= */

function topicKey(subject, unit, topic) {
  return `${subject}|||${unit}|||${topic}`;
}

function loadJSON(key, fallback) {
  try {
    const saved = localStorage.getItem(key);

    return saved
      ? JSON.parse(saved)
      : fallback;
  } catch {
    return fallback;
  }
}

/* =========================================================
   SYLLABUS
========================================================= */

function Syllabus() {
  const { theme } = useTheme();

  /*
   * StudyContext is now the source of truth for
   * completed topics.
   *
   * Data flow:
   *
   * Syllabus
   *   ↓
   * useStudy()
   *   ↓
   * IndexedDB
   *   ↓
   * API
   *   ↓
   * Prisma
   *   ↓
   * Neon PostgreSQL
   */
  const {
    completedTopics: serverCompletedTopics,
    toggleTopic: saveTopic,
    markAllSubject: saveAllSubject,
    clearSubject: clearAllSubject,
    isSyncing,
    isOnline,
  } = useStudy();

  /* =======================================================
     CUSTOM SYLLABUS
  ======================================================= */

  const [
    customSyllabus,
    setCustomSyllabus,
  ] = useState(() => {
    return loadJSON(
      CUSTOM_SYLLABUS_STORAGE_KEY,
      {}
    );
  });

  /* =======================================================
     DELETED ORIGINAL TOPICS
  ======================================================= */

  const [
    deletedTopics,
    setDeletedTopics,
  ] = useState(() => {
    return loadJSON(
      DELETED_TOPICS_STORAGE_KEY,
      []
    );
  });

  /* =======================================================
     DELETED ORIGINAL UNITS
  ======================================================= */

  const [
    deletedUnits,
    setDeletedUnits,
  ] = useState(() => {
    return loadJSON(
      DELETED_UNITS_STORAGE_KEY,
      []
    );
  });

  /* =======================================================
     EXPANDED SUBJECTS
  ======================================================= */

  const [
    expandedSubjects,
    setExpandedSubjects,
  ] = useState({});

  /* =======================================================
     MODAL
  ======================================================= */

  const [
    modal,
    setModal,
  ] = useState({
    open: false,
    type: null,
    subject: "",
    unit: "",
    topic: "",
  });

  /* =======================================================
     BUILD COMPLETED TOPIC MAP
  ======================================================= */

  const completedTopicMap = useMemo(() => {
    const map = {};

    if (!Array.isArray(serverCompletedTopics)) {
      return map;
    }

    serverCompletedTopics.forEach((item) => {
      if (!item) return;

      const key = topicKey(
        item.subject,
        item.unit,
        item.topic
      );

      map[key] = Boolean(item.completed);
    });

    return map;
  }, [serverCompletedTopics]);

  /* =======================================================
     SAVE CUSTOM SYLLABUS
  ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      CUSTOM_SYLLABUS_STORAGE_KEY,
      JSON.stringify(customSyllabus)
    );
  }, [customSyllabus]);

  /* =======================================================
     SAVE DELETED TOPICS
  ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      DELETED_TOPICS_STORAGE_KEY,
      JSON.stringify(deletedTopics)
    );
  }, [deletedTopics]);

  /* =======================================================
     SAVE DELETED UNITS
  ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      DELETED_UNITS_STORAGE_KEY,
      JSON.stringify(deletedUnits)
    );
  }, [deletedUnits]);

  /* =======================================================
     MIGRATE OLD LOCAL COMPLETION DATA

     Old version stored:

     gate-completed-topics

     as:

     {
       "Subject|||Unit|||Topic": true
     }

     This migrates old completed topics into the
     new StudyContext / Neon system.
  ======================================================= */

  useEffect(() => {
    if (!Array.isArray(serverCompletedTopics)) {
      return;
    }

    const alreadyMigrated =
      localStorage.getItem(
        COMPLETED_MIGRATION_KEY
      );

    if (alreadyMigrated === "true") {
      return;
    }

    let oldData = {};

    try {
      const saved =
        localStorage.getItem(
          "gate-completed-topics"
        );

      if (saved) {
        oldData = JSON.parse(saved);
      }
    } catch {
      oldData = {};
    }

    if (
      !oldData ||
      typeof oldData !== "object"
    ) {
      localStorage.setItem(
        COMPLETED_MIGRATION_KEY,
        "true"
      );

      return;
    }

    const existing = new Set(
      serverCompletedTopics
        .filter(
          (item) =>
            item &&
            item.completed
        )
        .map((item) =>
          topicKey(
            item.subject,
            item.unit,
            item.topic
          )
        )
    );

    const migrationTasks = [];

    Object.entries(oldData).forEach(
      ([key, completed]) => {
        if (!completed) return;

        const parts =
          key.split("|||");

        if (parts.length !== 3) {
          return;
        }

        const [
          subject,
          unit,
          topic,
        ] = parts;

        if (existing.has(key)) {
          return;
        }

        migrationTasks.push(
          saveTopic(
            subject,
            unit,
            topic,
            true
          )
        );
      }
    );

    if (migrationTasks.length === 0) {
      localStorage.setItem(
        COMPLETED_MIGRATION_KEY,
        "true"
      );

      return;
    }

    Promise.allSettled(
      migrationTasks
    ).finally(() => {
      localStorage.setItem(
        COMPLETED_MIGRATION_KEY,
        "true"
      );
    });
  }, [
    serverCompletedTopics,
    saveTopic,
  ]);

  /* =======================================================
     BUILD FINAL SYLLABUS

     Combines:

     - Original GATE syllabus
     - Custom units
     - Custom topics
     - Deleted items
  ======================================================= */

  const syllabus = useMemo(() => {
    const result = {};

    /* -----------------------------------------------
       ORIGINAL SYLLABUS
    ----------------------------------------------- */

    Object.entries(
      MPSC_SYLLABUS
    ).forEach(
      ([subject, units]) => {
        result[subject] = {};

        Object.entries(
          units
        ).forEach(
          ([unit, topics]) => {
            const unitDeleteKey =
              `${subject}|||${unit}`;

            if (
              deletedUnits.includes(
                unitDeleteKey
              )
            ) {
              return;
            }

            const filteredTopics =
              topics.filter(
                (topic) => {
                  const key =
                    topicKey(
                      subject,
                      unit,
                      topic
                    );

                  return !deletedTopics.includes(
                    key
                  );
                }
              );

            result[subject][unit] =
              [...filteredTopics];
          }
        );
      }
    );

    /* -----------------------------------------------
       CUSTOM SYLLABUS
    ----------------------------------------------- */

    Object.entries(
      customSyllabus
    ).forEach(
      ([subject, units]) => {
        if (!result[subject]) {
          result[subject] = {};
        }

        Object.entries(
          units
        ).forEach(
          ([unit, topics]) => {
            if (
              !result[subject][unit]
            ) {
              result[subject][unit] =
                [];
            }

            topics.forEach(
              (topic) => {
                if (
                  !result[subject][unit].includes(
                    topic
                  )
                ) {
                  result[
                    subject
                  ][unit].push(
                    topic
                  );
                }
              }
            );
          }
        );
      }
    );

    /* -----------------------------------------------
       REMOVE EMPTY SUBJECTS
    ----------------------------------------------- */

    Object.keys(result).forEach(
      (subject) => {
        if (
          Object.keys(
            result[subject]
          ).length === 0
        ) {
          delete result[subject];
        }
      }
    );

    return result;
  }, [
    customSyllabus,
    deletedTopics,
    deletedUnits,
  ]);

  /* =======================================================
     TOGGLE TOPIC
  ======================================================= */

  async function toggleTopic(
    subject,
    unit,
    topic
  ) {
    const key = topicKey(
      subject,
      unit,
      topic
    );

    const current =
      Boolean(
        completedTopicMap[key]
      );

    await saveTopic(
      subject,
      unit,
      topic,
      !current
    );
  }

  /* =======================================================
     TOGGLE SUBJECT
  ======================================================= */

  function toggleSubject(subject) {
    setExpandedSubjects(
      (previous) => ({
        ...previous,
        [subject]:
          !previous[subject],
      })
    );
  }

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;

    const subjects = {};

    Object.entries(
      syllabus
    ).forEach(
      ([subject, units]) => {
        let subjectTotal = 0;
        let subjectCompleted = 0;

        Object.entries(
          units
        ).forEach(
          ([unit, topics]) => {
            subjectTotal +=
              topics.length;

            total +=
              topics.length;

            topics.forEach(
              (topic) => {
                const key =
                  topicKey(
                    subject,
                    unit,
                    topic
                  );

                if (
                  completedTopicMap[
                    key
                  ]
                ) {
                  completed++;
                  subjectCompleted++;
                }
              }
            );
          }
        );

        subjects[subject] = {
          total:
            subjectTotal,

          completed:
            subjectCompleted,

          percentage:
            subjectTotal === 0
              ? 0
              : Math.round(
                  (subjectCompleted /
                    subjectTotal) *
                    100
                ),
        };
      }
    );

    return {
      total,

      completed,

      remaining:
        total - completed,

      percentage:
        total === 0
          ? 0
          : Math.round(
              (completed / total) *
                100
            ),

      subjects,
    };
  }, [
    completedTopicMap,
    syllabus,
  ]);

  /* =======================================================
     MARK SUBJECT COMPLETE
  ======================================================= */

  async function markAllSubject(
    subject
  ) {
    /*
     * Use StudyContext so every topic is
     * saved to IndexedDB and queued for
     * Neon synchronization.
     */
    await saveAllSubject(
      subject,
      Object.entries(
        syllabus[subject] || {}
      ).flatMap(
        ([unit, topics]) =>
          topics.map(
            (topic) => ({
              subject,
              unit,
              topic,
              completed: true,
            })
          )
      )
    );
  }

  /* =======================================================
     CLEAR SUBJECT
  ======================================================= */

  async function clearSubject(
    subject
  ) {
    await clearAllSubject(
      subject,
      Object.entries(
        syllabus[subject] || {}
      ).flatMap(
        ([unit, topics]) =>
          topics.map(
            (topic) => ({
              subject,
              unit,
              topic,
              completed: false,
            })
          )
      )
    );
  }

  /* =======================================================
     OPEN ADD UNIT
  ======================================================= */

  function openAddUnit(subject) {
    setModal({
      open: true,
      type: "add-unit",
      subject,
      unit: "",
      topic: "",
    });
  }

  /* =======================================================
     OPEN ADD TOPIC
  ======================================================= */

  function openAddTopic(
    subject,
    unit
  ) {
    setModal({
      open: true,
      type: "add-topic",
      subject,
      unit,
      topic: "",
    });
  }

  /* =======================================================
     OPEN DELETE UNIT
  ======================================================= */

  function openDeleteUnit(
    subject,
    unit
  ) {
    setModal({
      open: true,
      type: "delete-unit",
      subject,
      unit,
      topic: "",
    });
  }

  /* =======================================================
     OPEN DELETE TOPIC
  ======================================================= */

  function openDeleteTopic(
    subject,
    unit,
    topic
  ) {
    setModal({
      open: true,
      type: "delete-topic",
      subject,
      unit,
      topic,
    });
  }

  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {
    setModal({
      open: false,
      type: null,
      subject: "",
      unit: "",
      topic: "",
    });
  }

  /* =======================================================
     ADD UNIT
  ======================================================= */

  function addUnit() {
    const subject =
      modal.subject;

    const unit =
      modal.unit.trim();

    if (!unit) {
      return;
    }

    setCustomSyllabus(
      (previous) => {
        const subjectData =
          previous[subject] || {};

        if (
          subjectData[unit]
        ) {
          return previous;
        }

        return {
          ...previous,

          [subject]: {
            ...subjectData,

            [unit]: [],
          },
        };
      }
    );

    /*
     * If a previously deleted original
     * unit has same name, restore it.
     */

    const deleteKey =
      `${subject}|||${unit}`;

    setDeletedUnits(
      (previous) =>
        previous.filter(
          (item) =>
            item !== deleteKey
        )
    );

    closeModal();

    setExpandedSubjects(
      (previous) => ({
        ...previous,
        [subject]: true,
      })
    );
  }

  /* =======================================================
     ADD TOPIC
  ======================================================= */

  function addTopic() {
    const subject =
      modal.subject;

    const unit =
      modal.unit;

    const topic =
      modal.topic.trim();

    if (!topic) {
      return;
    }

    const existingTopics =
      syllabus[
        subject
      ]?.[unit] || [];

    if (
      existingTopics.includes(
        topic
      )
    ) {
      return;
    }

    setCustomSyllabus(
      (previous) => {
        const subjectData =
          previous[subject] || {};

        const unitTopics =
          subjectData[unit] || [];

        return {
          ...previous,

          [subject]: {
            ...subjectData,

            [unit]: [
              ...unitTopics,
              topic,
            ],
          },
        };
      }
    );

    closeModal();

    setExpandedSubjects(
      (previous) => ({
        ...previous,
        [subject]: true,
      })
    );
  }

  /* =======================================================
     DELETE UNIT
  ======================================================= */

  async function deleteUnit() {
    const subject =
      modal.subject;

    const unit =
      modal.unit;

    const unitDeleteKey =
      `${subject}|||${unit}`;

    /*
     * Remove custom unit.
     */

    setCustomSyllabus(
      (previous) => {
        if (
          !previous[
            subject
          ]?.[unit]
        ) {
          return previous;
        }

        const next = {
          ...previous,
        };

        next[subject] = {
          ...next[subject],
        };

        delete next[
          subject
        ][unit];

        if (
          Object.keys(
            next[subject]
          ).length === 0
        ) {
          delete next[subject];
        }

        return next;
      }
    );

    /*
     * Hide original unit.
     */

    if (
      MPSC_SYLLABUS[
        subject
      ]?.[unit]
    ) {
      setDeletedUnits(
        (previous) =>
          previous.includes(
            unitDeleteKey
          )
            ? previous
            : [
                ...previous,
                unitDeleteKey,
              ]
      );
    }

    /*
     * Save all topics in this unit
     * as incomplete in Neon.
     */

    const topics =
      syllabus[
        subject
      ]?.[unit] || [];

    await Promise.all(
      topics.map(
        (topic) =>
          saveTopic(
            subject,
            unit,
            topic,
            false
          )
      )
    );

    closeModal();
  }

  /* =======================================================
     DELETE TOPIC
  ======================================================= */

  async function deleteTopic() {
    const subject =
      modal.subject;

    const unit =
      modal.unit;

    const topic =
      modal.topic;

    const key =
      topicKey(
        subject,
        unit,
        topic
      );

    /*
     * If custom topic,
     * remove it from custom data.
     */

    setCustomSyllabus(
      (previous) => {
        if (
          !previous[
            subject
          ]?.[unit]
        ) {
          return previous;
        }

        const isCustomTopic =
          previous[
            subject
          ][unit].includes(
            topic
          );

        if (!isCustomTopic) {
          return previous;
        }

        const next = {
          ...previous,
        };

        next[subject] = {
          ...next[subject],
        };

        next[subject][unit] =
          next[subject][unit].filter(
            (item) =>
              item !== topic
          );

        if (
          next[subject][unit]
            .length === 0
        ) {
          delete next[
            subject
          ][unit];
        }

        if (
          Object.keys(
            next[subject]
          ).length === 0
        ) {
          delete next[subject];
        }

        return next;
      }
    );

    /*
     * If original topic,
     * hide it.
     */

    if (
      MPSC_SYLLABUS[
        subject
      ]?.[unit]?.includes(topic)
    ) {
      setDeletedTopics(
        (previous) =>
          previous.includes(key)
            ? previous
            : [
                ...previous,
                key,
              ]
      );
    }

    /*
     * Mark deleted topic incomplete
     * in Neon.
     */

    await saveTopic(
      subject,
      unit,
      topic,
      false
    );

    closeModal();
  }

  /* =======================================================
     MODAL SUBMIT
  ======================================================= */

  function handleModalSubmit(
    event
  ) {
    event.preventDefault();

    if (
      modal.type ===
      "add-unit"
    ) {
      addUnit();
      return;
    }

    if (
      modal.type ===
      "add-topic"
    ) {
      addTopic();
      return;
    }

    if (
      modal.type ===
      "delete-unit"
    ) {
      deleteUnit();
      return;
    }

    if (
      modal.type ===
      "delete-topic"
    ) {
      deleteTopic();
    }
  }

  /* =======================================================
     MODAL TITLE
  ======================================================= */

  function getModalTitle() {
    switch (modal.type) {
      case "add-unit":
        return "Add Subtopic / Unit";

      case "add-topic":
        return "Add Topic";

      case "delete-unit":
        return "Delete Subtopic / Unit";

      case "delete-topic":
        return "Delete Topic";

      default:
        return "";
    }
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <>
      <div className="min-h-full w-full bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-[#0b1120] dark:text-white">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8">

          <div className="flex items-start gap-3">

            <div className="rounded-xl bg-purple-500/10 p-3">

              <BookOpen
                size={25}
                className="text-purple-500 dark:text-purple-400"
              />

            </div>

            <div>

              <h1 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
                MPSC Rajyaseva Syllabus
              </h1>

              <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500 sm:text-base">
                A stage-by-stage checklist for the MPSC State Services (Rajyaseva) journey.
              </p>

            </div>

          </div>

        </div>

        <div className="mb-6 rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/20 dark:bg-purple-500/10 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">2027 Rajyaseva pattern</p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-purple-800/80 dark:text-zinc-300 sm:text-sm">
                This checklist covers Prelims GS and CSAT, then the seven compulsory Mains papers: Marathi, English, Essay and General Studies I–IV. Optional subjects are removed from State Services Mains starting with the 2027 cycle. Use this as a planning checklist and confirm the detailed topics and rules against your exam notification.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 text-xs font-medium">
              <a className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-purple-700 hover:bg-purple-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-purple-300" href={MPSC_OFFICIAL_LINKS.syllabus} target="_blank" rel="noreferrer">Official syllabus</a>
              <a className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-purple-700 hover:bg-purple-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-purple-300" href={MPSC_OFFICIAL_LINKS.scheme} target="_blank" rel="noreferrer">Exam scheme</a>
              <a className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-purple-700 hover:bg-purple-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-purple-300" href={MPSC_OFFICIAL_LINKS.announcements} target="_blank" rel="noreferrer">2027 announcements</a>
            </div>
          </div>
        </div>

        {/* =================================================
            SYNC STATUS
        ================================================= */}

        <div className="mb-4 flex items-center justify-between">

          <p className="text-xs text-gray-400 dark:text-zinc-600">

            {!isOnline
              ? "Offline — changes will sync when you reconnect."
              : isSyncing
              ? "Syncing your progress..."
              : "Progress synced"}

          </p>

        </div>

        {/* =================================================
            OVERALL PROGRESS
        ================================================= */}

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-sm text-gray-500 dark:text-zinc-500">
                Overall Progress
              </p>

              <p className="mt-1 text-4xl font-bold text-gray-900 dark:text-white">
                {stats.percentage}%
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex">

              <ProgressStat
                label="Completed"
                value={
                  stats.completed
                }
              />

              <ProgressStat
                label="Remaining"
                value={
                  stats.remaining
                }
              />

              <ProgressStat
                label="Total"
                value={stats.total}
              />

            </div>

          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800">

            <div
              className="h-full rounded-full bg-purple-600 transition-all duration-500"
              style={{
                width: `${stats.percentage}%`,
              }}
            />

          </div>

        </div>

        {/* =================================================
            SUBJECTS
        ================================================= */}

        <div className="space-y-3">

          {Object.keys(
            syllabus
          ).map(
            (subject) => {

              const subjectStats =
                stats.subjects[
                  subject
                ] || {
                  total: 0,
                  completed: 0,
                  percentage: 0,
                };

              const expanded =
                !!expandedSubjects[
                  subject
                ];

              return (
                <div
                  key={subject}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/30"
                >

                  {/* SUBJECT HEADER */}

                  <div className="flex items-center">

                    <button
                      onClick={() =>
                        toggleSubject(
                          subject
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left transition hover:bg-gray-50 dark:hover:bg-zinc-900/70 sm:p-5"
                    >

                      <div className="shrink-0 text-gray-400 dark:text-zinc-500">

                        {expanded ? (
                          <ChevronDown
                            size={20}
                          />
                        ) : (
                          <ChevronRight
                            size={20}
                          />
                        )}

                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                          <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                            {subject}
                          </h2>

                          <span className="text-xs text-gray-500 dark:text-zinc-500">
                            {
                              subjectStats.completed
                            }{" "}
                            /{" "}
                            {
                              subjectStats.total
                            }
                          </span>

                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800">

                          <div
                            className="h-full rounded-full bg-purple-600 transition-all duration-300"
                            style={{
                              width: `${subjectStats.percentage}%`,
                            }}
                          />

                        </div>

                      </div>

                      <span className="hidden w-12 text-right text-sm font-semibold text-purple-600 dark:text-purple-400 sm:block">
                        {
                          subjectStats.percentage
                        }%
                      </span>

                    </button>

                  </div>

                  {/* EXPANDED SUBJECT */}

                  {expanded && (

                    <div className="border-t border-gray-200 dark:border-zinc-800">

                      {/* SUBJECT CONTROLS */}

                      <div className="flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 sm:p-4">

                        <button
                          onClick={() =>
                            markAllSubject(
                              subject
                            )
                          }
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          Mark All Complete
                        </button>

                        <button
                          onClick={() =>
                            clearSubject(
                              subject
                            )
                          }
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          Clear
                        </button>

                        <button
                          onClick={() =>
                            openAddUnit(
                              subject
                            )
                          }
                          className="ml-auto flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-purple-500"
                        >
                          <Plus
                            size={14}
                          />
                          Add Subtopic
                        </button>

                      </div>

                      {/* UNITS */}

                      <div className="divide-y divide-gray-200 dark:divide-zinc-800">

                        {Object.entries(
                          syllabus[
                            subject
                          ]
                        ).map(
                          ([
                            unit,
                            topics,
                          ]) => {

                            const unitCompleted =
                              topics.filter(
                                (
                                  topic
                                ) =>
                                  completedTopicMap[
                                    topicKey(
                                      subject,
                                      unit,
                                      topic
                                    )
                                  ]
                              ).length;

                            return (
                              <div
                                key={unit}
                                className="p-4 sm:p-5"
                              >

                                {/* UNIT HEADER */}

                                <div className="mb-3 flex items-center gap-2">

                                  <div className="min-w-0 flex-1">

                                    <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                                      {unit}
                                    </h3>

                                    <span className="text-xs text-gray-400 dark:text-zinc-600">
                                      {
                                        unitCompleted
                                      }
                                      /
                                      {
                                        topics.length
                                      }{" "}
                                      completed
                                    </span>

                                  </div>

                                  <button
                                    onClick={() =>
                                      openAddTopic(
                                        subject,
                                        unit
                                      )
                                    }
                                    title="Add topic"
                                    className="rounded-lg p-2 text-purple-500 transition hover:bg-purple-500/10 dark:text-purple-400"
                                  >
                                    <Plus
                                      size={17}
                                    />
                                  </button>

                                  <button
                                    onClick={() =>
                                      openDeleteUnit(
                                        subject,
                                        unit
                                      )
                                    }
                                    title="Delete subtopic/unit"
                                    className="rounded-lg p-2 text-gray-400 transition hover:bg-red-500/10 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400"
                                  >
                                    <Trash2
                                      size={16}
                                    />
                                  </button>

                                </div>

                                {/* TOPICS */}

                                {topics.length ===
                                0 ? (

                                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-950/30">

                                    <p className="text-xs text-gray-400 dark:text-zinc-600">
                                      No topics yet.
                                    </p>

                                    <button
                                      onClick={() =>
                                        openAddTopic(
                                          subject,
                                          unit
                                        )
                                      }
                                      className="mt-2 text-xs font-medium text-purple-500 hover:text-purple-400 dark:text-purple-400"
                                    >
                                      + Add first topic
                                    </button>

                                  </div>

                                ) : (

                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                                    {topics.map(
                                      (
                                        topic
                                      ) => {

                                        const key =
                                          topicKey(
                                            subject,
                                            unit,
                                            topic
                                          );

                                        const checked =
                                          Boolean(
                                            completedTopicMap[
                                              key
                                            ]
                                          );

                                        return (
                                          <div
                                            key={
                                              topic
                                            }
                                            className={`group flex items-start gap-2 rounded-xl border p-3 transition ${
                                              checked
                                                ? "border-purple-500/30 bg-purple-500/5"
                                                : "border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:bg-zinc-900"
                                            }`}
                                          >

                                            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">

                                              <input
                                                type="checkbox"
                                                checked={
                                                  checked
                                                }
                                                onChange={() =>
                                                  toggleTopic(
                                                    subject,
                                                    unit,
                                                    topic
                                                  )
                                                }
                                                className="sr-only"
                                              />

                                              <div className="mt-0.5 shrink-0">

                                                {checked ? (
                                                  <CheckCircle2
                                                    size={
                                                      18
                                                    }
                                                    className="text-purple-500 dark:text-purple-400"
                                                  />
                                                ) : (
                                                  <Circle
                                                    size={
                                                      18
                                                    }
                                                    className="text-gray-300 dark:text-zinc-700"
                                                  />
                                                )}

                                              </div>

                                              <span
                                                className={`min-w-0 text-sm leading-5 ${
                                                  checked
                                                    ? "text-purple-600 line-through decoration-purple-500/50 dark:text-purple-300"
                                                    : "text-gray-700 dark:text-zinc-400"
                                                }`}
                                              >
                                                {
                                                  topic
                                                }
                                              </span>

                                            </label>

                                            <button
                                              onClick={() =>
                                                openDeleteTopic(
                                                  subject,
                                                  unit,
                                                  topic
                                                )
                                              }
                                              title="Delete topic"
                                              className="shrink-0 rounded-lg p-1.5 text-gray-300 opacity-100 transition hover:bg-red-500/10 hover:text-red-500 dark:text-zinc-700 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                                            >
                                              <Trash2
                                                size={
                                                  15
                                                }
                                              />
                                            </button>

                                          </div>
                                        );
                                      }
                                    )}

                                  </div>

                                )}

                              </div>
                            );
                          }
                        )}

                      </div>

                    </div>
                  )}

                </div>
              );
            }
          )}

        </div>

        {/* =================================================
            BOTTOM INFO
        ================================================= */}

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/20">

          <p className="text-xs leading-5 text-gray-500 dark:text-zinc-600">

            Your syllabus progress is saved automatically
            and synchronized with your account. Added and
            deleted topics are saved on this device.

          </p>

        </div>

      </div>

      {/* =====================================================
          ADD / DELETE MODAL
      ===================================================== */}

      {modal.open && (

        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={
            closeModal
          }
        >

          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="flex items-start justify-between gap-4">

              <div>

                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {getModalTitle()}
                </h2>

                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
                  {modal.subject}
                  {modal.unit &&
                    ` → ${modal.unit}`}
                </p>

              </div>

              <button
                onClick={
                  closeModal
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                <X
                  size={18}
                />
              </button>

            </div>

            {/* DELETE CONFIRMATION */}

            {(modal.type ===
              "delete-unit" ||
              modal.type ===
                "delete-topic") && (

              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4">

                <div className="flex gap-3">

                  <Trash2
                    size={20}
                    className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
                  />

                  <div>

                    <p className="text-sm font-medium text-gray-900 dark:text-white">

                      {modal.type ===
                      "delete-unit"
                        ? `Delete "${modal.unit}"?`
                        : `Delete "${modal.topic}"?`}

                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-zinc-500">

                      This will remove it from your
                      syllabus and update your progress.

                    </p>

                  </div>

                </div>

              </div>
            )}

            {/* ADD FORM */}

            {(modal.type ===
              "add-unit" ||
              modal.type ===
                "add-topic") && (

              <form
                onSubmit={
                  handleModalSubmit
                }
                className="mt-5"
              >

                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">

                  {modal.type ===
                  "add-unit"
                    ? "Subtopic / Unit name"
                    : "Topic name"}

                </label>

                <input
                  autoFocus
                  type="text"
                  value={
                    modal.type ===
                    "add-unit"
                      ? modal.unit
                      : modal.topic
                  }
                  onChange={(
                    event
                  ) => {

                    if (
                      modal.type ===
                      "add-unit"
                    ) {
                      setModal(
                        (
                          previous
                        ) => ({
                          ...previous,
                          unit:
                            event.target
                              .value,
                        })
                      );
                    } else {
                      setModal(
                        (
                          previous
                        ) => ({
                          ...previous,
                          topic:
                            event.target
                              .value,
                        })
                      );
                    }

                  }}
                  placeholder={
                    modal.type ===
                    "add-unit"
                      ? "e.g. Additional Algorithms"
                      : "e.g. Binary Search"
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-600"
                />

                <div className="mt-5 flex justify-end gap-2">

                  <button
                    type="button"
                    onClick={
                      closeModal
                    }
                    className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500"
                  >
                    <Plus
                      size={16}
                    />
                    Add
                  </button>

                </div>

              </form>
            )}

            {/* DELETE BUTTONS */}

            {(modal.type ===
              "delete-unit" ||
              modal.type ===
                "delete-topic") && (

              <div className="mt-5 flex justify-end gap-2">

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {

                    if (
                      modal.type ===
                      "delete-unit"
                    ) {
                      deleteUnit();
                    } else {
                      deleteTopic();
                    }

                  }}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500"
                >
                  <Trash2
                    size={16}
                  />
                  Delete
                </button>

              </div>
            )}

          </div>

        </div>
      )}

    </>
  );
}

/* =========================================================
   PROGRESS STAT
========================================================= */

function ProgressStat({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">

      <p className="text-xs text-gray-400 dark:text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
        {value}
      </p>

    </div>
  );
}

export default Syllabus;
