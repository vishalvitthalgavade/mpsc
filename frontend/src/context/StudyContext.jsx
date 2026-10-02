import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { openDB } from "idb";
import { useAuth } from "./AuthContext";

export const StudyContext = createContext(null);

const DB_NAME = "gate-cse-tracker";
const DB_VERSION = 2;
const SESSION_MERGE_GAP_MS = 5 * 60 * 1000;

const STORES = {
  sessions: "sessions",
  pendingSessions: "pendingSessions",
  completedTopics: "completedTopics",
  pendingTopics: "pendingTopics",
  settings: "settings",
  pendingSettings: "pendingSettings",
};

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const store = db.createObjectStore(STORES.sessions, {
          keyPath: "id",
        });

        store.createIndex("userId", "userId");
        store.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains(STORES.pendingSessions)) {
        const store = db.createObjectStore(STORES.pendingSessions, {
          keyPath: "clientId",
        });

        store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains(STORES.completedTopics)) {
        const store = db.createObjectStore(STORES.completedTopics, {
          keyPath: "key",
        });

        store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains(STORES.pendingTopics)) {
        const store = db.createObjectStore(STORES.pendingTopics, {
          keyPath: "key",
        });

        store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains(STORES.settings)) {
        const store = db.createObjectStore(STORES.settings, {
          keyPath: "key",
        });

        store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains(STORES.pendingSettings)) {
        const store = db.createObjectStore(STORES.pendingSettings, {
          keyPath: "key",
        });

        store.createIndex("userId", "userId");
      }
    },
  });
}

function createClientId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function topicKey(userId, subject, unit, topic) {
  return `${userId}::${subject}::${unit}::${topic}`;
}

function settingsKey(userId) {
  return `pomodoro::${userId}`;
}

function normalizeSession(session, userId) {
  return {
    ...session,
    userId,
    duration: Number(session.duration) || 0,
  };
}

export function StudyProvider({ children }) {
  const {
    user,
    isAuthenticated,
    authFetch,
  } = useAuth();

  const userId = user?.id || null;

  const [sessions, setSessions] = useState([]);
  const [completedTopics, setCompletedTopics] = useState([]);
  const [pomodoroSettings, setPomodoroSettings] = useState({
    study: 25,
    shortBreak: 5,
    longBreak: 15,
    sessionsBeforeLongBreak: 4,
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined"
      ? navigator.onLine
      : true
  );

  /*
   * ----------------------------------------------------
   * LOAD LOCAL DATA
   * ----------------------------------------------------
   */

  const loadLocalData = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setCompletedTopics([]);
      setPomodoroSettings({
        study: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsBeforeLongBreak: 4,
      });

      return;
    }

    const db = await getDB();

    const [
      localSessions,
      localTopics,
      localSettings,
    ] = await Promise.all([
      db.getAllFromIndex(
        STORES.sessions,
        "userId",
        userId
      ),

      db.getAllFromIndex(
        STORES.completedTopics,
        "userId",
        userId
      ),

      db.get(
        STORES.settings,
        settingsKey(userId)
      ),
    ]);

    setSessions(
      localSessions.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
    );

    setCompletedTopics(localTopics);

    if (localSettings) {
      setPomodoroSettings({
        study: localSettings.study,
        shortBreak: localSettings.shortBreak,
        longBreak: localSettings.longBreak,
        sessionsBeforeLongBreak:
          localSettings.sessionsBeforeLongBreak,
      });
    }
  }, [userId]);

  /*
   * ----------------------------------------------------
   * ONLINE / OFFLINE
   * ----------------------------------------------------
   */

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );
    };
  }, []);

  /*
   * ----------------------------------------------------
   * SAVE SESSION LOCALLY
   * ----------------------------------------------------
   */

  const saveSessionLocally = useCallback(
    async (session) => {
      const db = await getDB();

      await db.put(
        STORES.sessions,
        session
      );

      await db.put(
        STORES.pendingSessions,
        session
      );
    },
    []
  );

  /*
   * ----------------------------------------------------
   * SYNC STUDY SESSIONS
   * ----------------------------------------------------
   */

  const syncPendingSessions = useCallback(async () => {
    if (!userId || !isAuthenticated || !navigator.onLine) {
      return;
    }

    const db = await getDB();

    const pending = await db.getAllFromIndex(
      STORES.pendingSessions,
      "userId",
      userId
    );

    if (!pending.length) {
      return;
    }

    setIsSyncing(true);

    try {
      for (const session of pending) {
        try {
          const response = await authFetch(
            "/sessions",
            {
              method: "POST",
              body: JSON.stringify({
                clientId: session.clientId,
                subject: session.subject,
                topic: session.topic,
                duration: session.duration,
                type: session.type,
                startedAt:
                  session.startedAt || null,
                completedAt:
                  session.completedAt || null,
              }),
            }
          );

          if (!response.ok) {
            continue;
          }

          const result = await response.json();

          const serverSession =
            result.session || result.data;

          if (serverSession) {
            await db.delete(
              STORES.sessions,
              session.id
            );

            await db.put(
              STORES.sessions,
              normalizeSession(
                serverSession,
                userId
              )
            );
          }

          await db.delete(
            STORES.pendingSessions,
            session.clientId
          );
        } catch (error) {
          console.error(
            "Session sync failed:",
            error
          );
        }
      }

      const updatedSessions =
        await db.getAllFromIndex(
          STORES.sessions,
          "userId",
          userId
        );

      setSessions(
        updatedSessions.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        )
      );
    } finally {
      setIsSyncing(false);
    }
  }, [
    userId,
    isAuthenticated,
    authFetch,
  ]);

  /*
   * ----------------------------------------------------
   * SAVE TOPIC LOCALLY
   * ----------------------------------------------------
   */

  const saveTopicLocally = useCallback(
    async (topic) => {
      if (!userId) return;

      const key = topicKey(
        userId,
        topic.subject,
        topic.unit,
        topic.topic
      );

      const record = {
        key,
        userId,
        subject: topic.subject,
        unit: topic.unit,
        topic: topic.topic,
        completed: Boolean(topic.completed),
        completedAt:
          topic.completed
            ? topic.completedAt ||
              new Date().toISOString()
            : null,
        updatedAt: new Date().toISOString(),
      };

      const db = await getDB();

      await db.put(
        STORES.completedTopics,
        record
      );

      await db.put(
        STORES.pendingTopics,
        record
      );

      return record;
    },
    [userId]
  );

  /*
   * ----------------------------------------------------
   * SYNC TOPICS
   * ----------------------------------------------------
   */

  const syncPendingTopics = useCallback(async () => {
    if (!userId || !isAuthenticated || !navigator.onLine) {
      return;
    }

    const db = await getDB();

    const pending = await db.getAllFromIndex(
      STORES.pendingTopics,
      "userId",
      userId
    );

    if (!pending.length) {
      return;
    }

    setIsSyncing(true);

    try {
      for (const topic of pending) {
        try {
          const response = await authFetch(
            "/study/topics",
            {
              method: "POST",
              body: JSON.stringify({
                subject: topic.subject,
                unit: topic.unit,
                topic: topic.topic,
                completed: topic.completed,
                completedAt:
                  topic.completedAt || null,
              }),
            }
          );

          if (!response.ok) {
            continue;
          }

          await db.delete(
            STORES.pendingTopics,
            topic.key
          );
        } catch (error) {
          console.error(
            "Topic sync failed:",
            error
          );
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [
    userId,
    isAuthenticated,
    authFetch,
  ]);

  /*
   * ----------------------------------------------------
   * SYNC POMODORO SETTINGS
   * ----------------------------------------------------
   */

  const syncPendingSettings = useCallback(async () => {
    if (!userId || !isAuthenticated || !navigator.onLine) {
      return;
    }

    const db = await getDB();

    const key = settingsKey(userId);

    const pending = await db.get(
      STORES.pendingSettings,
      key
    );

    if (!pending) {
      return;
    }

    setIsSyncing(true);

    try {
      const response = await authFetch(
        "/study/pomodoro",
        {
          method: "PUT",
          body: JSON.stringify({
            study: pending.study,
            shortBreak: pending.shortBreak,
            longBreak: pending.longBreak,
            sessionsBeforeLongBreak:
              pending.sessionsBeforeLongBreak,
          }),
        }
      );

      if (response.ok) {
        await db.delete(
          STORES.pendingSettings,
          key
        );
      }
    } catch (error) {
      console.error(
        "Pomodoro settings sync failed:",
        error
      );
    } finally {
      setIsSyncing(false);
    }
  }, [
    userId,
    isAuthenticated,
    authFetch,
  ]);

  /*
   * ----------------------------------------------------
   * FULL SYNC
   * ----------------------------------------------------
   */

  const syncAll = useCallback(async () => {
    if (!userId || !isAuthenticated || !navigator.onLine) {
      return;
    }

    await syncPendingSessions();
    await syncPendingTopics();
    await syncPendingSettings();
  }, [
    userId,
    isAuthenticated,
    syncPendingSessions,
    syncPendingTopics,
    syncPendingSettings,
  ]);

  /*
   * ----------------------------------------------------
   * REFRESH FROM SERVER
   * ----------------------------------------------------
   */

  const refreshFromServer = useCallback(async () => {
    if (!userId || !isAuthenticated || !navigator.onLine) {
      return;
    }

    try {
      /*
       * First upload offline changes.
       */
      await syncAll();

      const [
        sessionsResponse,
        topicsResponse,
        settingsResponse,
      ] = await Promise.all([
        authFetch("/sessions"),
        authFetch("/study/topics"),
        authFetch("/study/pomodoro"),
      ]);

      /*
       * ---------------- SESSIONS ----------------
       */

      if (sessionsResponse.ok) {
        const result =
          await sessionsResponse.json();

        const serverSessions =
          result.sessions || result.data || [];

        const db = await getDB();

        for (const session of serverSessions) {
          await db.put(
            STORES.sessions,
            normalizeSession(
              session,
              userId
            )
          );
        }

        /*
         * IMPORTANT:
         *
         * syncAll() above already tried to upload every
         * pending session, but a specific upload can still
         * fail (flaky connection, backend cold start, a
         * request that timed out, etc.) and stay queued in
         * STORES.pendingSessions.
         *
         * Previously this just replaced the visible list
         * with `serverSessions`, which silently dropped any
         * session still waiting to sync - the user would
         * finish a study session, see it appear, and then
         * have it disappear from History/Statistics again
         * as soon as a refresh ran, even though it wasn't
         * actually lost (it was still queued locally and
         * would eventually sync). This merges those still-
         * pending sessions back in so nothing disappears
         * from view until it's genuinely been replaced by
         * the server's copy.
         */
        const stillPending =
          await db.getAllFromIndex(
            STORES.pendingSessions,
            "userId",
            userId
          );

        const serverClientIds = new Set(
          serverSessions
            .map((session) => session.clientId)
            .filter(Boolean)
        );

        const unsyncedSessions = stillPending
          .filter(
            (session) =>
              !serverClientIds.has(session.clientId)
          )
          .map((session) =>
            normalizeSession(session, userId)
          );

        setSessions(
          [
            ...unsyncedSessions,
            ...serverSessions.map((session) =>
              normalizeSession(session, userId)
            ),
          ].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          )
        );
      }

      /*
       * ---------------- TOPICS ----------------
       */

      if (topicsResponse.ok) {
        const result =
          await topicsResponse.json();

        const serverTopics =
          result.topics || result.data || [];

        const db = await getDB();

        for (const topic of serverTopics) {
          const key = topicKey(
            userId,
            topic.subject,
            topic.unit,
            topic.topic
          );

          await db.put(
            STORES.completedTopics,
            {
              ...topic,
              key,
              userId,
            }
          );
        }

        setCompletedTopics(
          serverTopics.map((topic) => ({
            ...topic,
            userId,
            key: topicKey(
              userId,
              topic.subject,
              topic.unit,
              topic.topic
            ),
          }))
        );
      }

      /*
       * ---------------- POMODORO ----------------
       */

      if (settingsResponse.ok) {
        const result =
          await settingsResponse.json();

        const serverSettings =
          result.settings || result.data;

        if (serverSettings) {
          const settings = {
            study: serverSettings.study,
            shortBreak:
              serverSettings.shortBreak,
            longBreak:
              serverSettings.longBreak,
            sessionsBeforeLongBreak:
              serverSettings.sessionsBeforeLongBreak,
          };

          setPomodoroSettings(settings);

          const db = await getDB();

          await db.put(
            STORES.settings,
            {
              key: settingsKey(userId),
              userId,
              ...settings,
            }
          );
        }
      }
    } catch (error) {
      console.error(
        "Server refresh failed:",
        error
      );
    }
  }, [
    userId,
    isAuthenticated,
    authFetch,
    syncAll,
  ]);

  /*
   * ----------------------------------------------------
   * LOAD WHEN USER CHANGES
   * ----------------------------------------------------
   */

  useEffect(() => {
    if (!userId) {
      setSessions([]);
      setCompletedTopics([]);

      setPomodoroSettings({
        study: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsBeforeLongBreak: 4,
      });

      return;
    }

    loadLocalData();

    if (navigator.onLine) {
      refreshFromServer();
    }
  }, [
    userId,
    loadLocalData,
    refreshFromServer,
  ]);

  /*
   * ----------------------------------------------------
   * AUTOMATIC ONLINE SYNC
   * ----------------------------------------------------
   */

  useEffect(() => {
    if (!userId || !isAuthenticated) {
      return;
    }

    if (navigator.onLine) {
      syncAll();
    }

    const handleOnline = () => {
      syncAll();
      refreshFromServer();
    };

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
  }, [
    userId,
    isAuthenticated,
    syncAll,
    refreshFromServer,
  ]);

  /*
   * ----------------------------------------------------
   * ADD STUDY SESSION
   * ----------------------------------------------------
   */

  const addSession = useCallback(
    async (
      duration,
      type,
      subject = "No subject",
      topic = "No topic",
      startedAt = null
    ) => {
      if (!userId) {
        return null;
      }

      const now = new Date().toISOString();
      const sessionStartedAt = startedAt || now;
      const durationSeconds = Math.max(0, Math.round(Number(duration) || 0));

      if (durationSeconds <= 0) {
        return null;
      }

      const previousSession = [...sessions]
        .filter((item) => item?.userId === userId && item?.completedAt)
        .sort(
          (a, b) =>
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime()
        )[0];

      const previousCompletedAt = previousSession
        ? new Date(previousSession.completedAt).getTime()
        : NaN;
      const sessionStartedMs = new Date(sessionStartedAt).getTime();

      const shouldMerge =
        previousSession &&
        Number.isFinite(previousCompletedAt) &&
        Number.isFinite(sessionStartedMs) &&
        sessionStartedMs >= previousCompletedAt &&
        sessionStartedMs - previousCompletedAt < SESSION_MERGE_GAP_MS;

      let sessionToSave;

      if (shouldMerge) {
        sessionToSave = {
          ...previousSession,
          duration:
            Number(previousSession.duration || 0) +
            durationSeconds,
          completedAt: now,
        };

        setSessions((previous) =>
          previous.map((item) =>
            item.id === previousSession.id
              ? sessionToSave
              : item
          )
        );
      } else {
        const clientId = createClientId();
        sessionToSave = {
          id: `local-${clientId}`,
          clientId,
          userId,
          subject,
          topic,
          duration: durationSeconds,
          type,
          startedAt: sessionStartedAt,
          completedAt: now,
          createdAt: now,
        };

        setSessions((previous) => [sessionToSave, ...previous]);
      }

      // React state updates are synchronous for this event, but persist only
      // after the merged/new record has been determined.
      if (sessionToSave) {
        await saveSessionLocally(sessionToSave);
      }

      if (navigator.onLine) {
        syncPendingSessions();
      }

      return sessionToSave;
    },
    [
      userId,
      sessions,
      saveSessionLocally,
      syncPendingSessions,
    ]
  );

  /*
   * ----------------------------------------------------
   * DELETE ONE SESSION
   * ----------------------------------------------------
   */

  const deleteSession = useCallback(
    async (sessionId) => {
      if (!userId) return;

      const db = await getDB();

      const session =
        await db.get(
          STORES.sessions,
          sessionId
        );

      if (!session || session.userId !== userId) {
        return;
      }

      /*
       * Pending local session
       */
      if (
        session.clientId &&
        session.id.startsWith("local-")
      ) {
        await db.delete(
          STORES.pendingSessions,
          session.clientId
        );

        await db.delete(
          STORES.sessions,
          sessionId
        );

        setSessions((previous) =>
          previous.filter(
            (item) => item.id !== sessionId
          )
        );

        return;
      }

      /*
       * Already stored on server
       */
      if (navigator.onLine) {
        try {
          const response = await authFetch(
            `/sessions/${sessionId}`,
            {
              method: "DELETE",
            }
          );

          if (!response.ok) {
            throw new Error(
              "Server deletion failed"
            );
          }

          await db.delete(
            STORES.sessions,
            sessionId
          );

          setSessions((previous) =>
            previous.filter(
              (item) => item.id !== sessionId
            )
          );
        } catch (error) {
          console.error(
            "Delete session failed:",
            error
          );
        }
      }
    },
    [
      userId,
      authFetch,
    ]
  );

  /*
   * ----------------------------------------------------
   * CLEAR ALL SESSIONS
   * ----------------------------------------------------
   */

  const clearSessions = useCallback(async () => {
    if (!userId) return;

    const db = await getDB();

    if (navigator.onLine) {
      try {
        const response = await authFetch(
          "/sessions",
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to clear server sessions"
          );
        }
      } catch (error) {
        console.error(
          "Clear sessions failed:",
          error
        );

        return;
      }
    }

    const userSessions =
      await db.getAllFromIndex(
        STORES.sessions,
        "userId",
        userId
      );

    for (const session of userSessions) {
      await db.delete(
        STORES.sessions,
        session.id
      );
    }

    const pending =
      await db.getAllFromIndex(
        STORES.pendingSessions,
        "userId",
        userId
      );

    for (const session of pending) {
      await db.delete(
        STORES.pendingSessions,
        session.clientId
      );
    }

    setSessions([]);
  }, [
    userId,
    authFetch,
  ]);

  /*
   * ----------------------------------------------------
   * TOGGLE TOPIC
   * ----------------------------------------------------
   */

  const toggleTopic = useCallback(
    async (
      subject,
      unit,
      topic,
      completed
    ) => {
      if (!userId) return;

      const record =
        await saveTopicLocally({
          subject,
          unit,
          topic,
          completed,
          completedAt: completed
            ? new Date().toISOString()
            : null,
        });

      setCompletedTopics((previous) => {
        const filtered = previous.filter(
          (item) =>
            !(
              item.subject === subject &&
              item.unit === unit &&
              item.topic === topic
            )
        );

        return [...filtered, record];
      });

      if (navigator.onLine) {
        syncPendingTopics();
      }
    },
    [
      userId,
      saveTopicLocally,
      syncPendingTopics,
    ]
  );

  /*
   * ----------------------------------------------------
   * MARK ALL TOPICS IN SUBJECT
   * ----------------------------------------------------
   */

  const markAllSubject = useCallback(
    async (subject, topics) => {
      if (!userId) return;

      for (const item of topics) {
        await saveTopicLocally({
          subject,
          unit: item.unit,
          topic: item.topic,
          completed: true,
          completedAt:
            new Date().toISOString(),
        });
      }

      await loadLocalData();

      if (navigator.onLine) {
        await syncPendingTopics();
      }
    },
    [
      userId,
      saveTopicLocally,
      loadLocalData,
      syncPendingTopics,
    ]
  );

  /*
   * ----------------------------------------------------
   * CLEAR SUBJECT
   * ----------------------------------------------------
   */

  const clearSubject = useCallback(
    async (subject, topics) => {
      if (!userId) return;

      for (const item of topics) {
        await saveTopicLocally({
          subject,
          unit: item.unit,
          topic: item.topic,
          completed: false,
          completedAt: null,
        });
      }

      await loadLocalData();

      if (navigator.onLine) {
        await syncPendingTopics();
      }
    },
    [
      userId,
      saveTopicLocally,
      loadLocalData,
      syncPendingTopics,
    ]
  );

  /*
   * ----------------------------------------------------
   * UPDATE POMODORO SETTINGS
   * ----------------------------------------------------
   */

  const updatePomodoroSettings =
    useCallback(
      async (settings) => {
        if (!userId) return;

        const cleanSettings = {
          study: Number(
            settings.study ??
              pomodoroSettings.study
          ),
          shortBreak: Number(
            settings.shortBreak ??
              pomodoroSettings.shortBreak
          ),
          longBreak: Number(
            settings.longBreak ??
              pomodoroSettings.longBreak
          ),
          sessionsBeforeLongBreak: Number(
            settings.sessionsBeforeLongBreak ??
              pomodoroSettings.sessionsBeforeLongBreak
          ),
        };

        setPomodoroSettings(
          cleanSettings
        );

        const db = await getDB();

        const key = settingsKey(userId);

        await db.put(
          STORES.settings,
          {
            key,
            userId,
            ...cleanSettings,
          }
        );

        await db.put(
          STORES.pendingSettings,
          {
            key,
            userId,
            ...cleanSettings,
          }
        );

        if (navigator.onLine) {
          syncPendingSettings();
        }
      },
      [
        userId,
        pomodoroSettings,
        syncPendingSettings,
      ]
    );

  /*
   * ----------------------------------------------------
   * HELPERS
   * ----------------------------------------------------
   */

  const getTodayDuration = useCallback(() => {
    const today = new Date();

    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    return sessions
      .filter((session) => {
        const date = new Date(
          session.createdAt
        );

        return (
          date.getFullYear() === year &&
          date.getMonth() === month &&
          date.getDate() === day
        );
      })
      .reduce(
        (total, session) =>
          total + Number(session.duration || 0),
        0
      );
  }, [sessions]);

  const getTotalDuration =
    useCallback(() => {
      return sessions.reduce(
        (total, session) =>
          total + Number(session.duration || 0),
        0
      );
    }, [sessions]);

  /*
   * ----------------------------------------------------
   * CONTEXT VALUE
   * ----------------------------------------------------
   */

  const value = useMemo(
    () => ({
      sessions,
      completedTopics,
      pomodoroSettings,

      isSyncing,
      isOnline,

      addSession,
      deleteSession,
      clearSessions,

      toggleTopic,
      markAllSubject,
      clearSubject,

      updatePomodoroSettings,

      syncPendingSessions,
      syncPendingTopics,
      syncPendingSettings,
      syncAll,
      refreshFromServer,

      getTodayDuration,
      getTotalDuration,
    }),
    [
      sessions,
      completedTopics,
      pomodoroSettings,

      isSyncing,
      isOnline,

      addSession,
      deleteSession,
      clearSessions,

      toggleTopic,
      markAllSubject,
      clearSubject,

      updatePomodoroSettings,

      syncPendingSessions,
      syncPendingTopics,
      syncPendingSettings,
      syncAll,
      refreshFromServer,

      getTodayDuration,
      getTotalDuration,
    ]
  );

  return (
    <StudyContext.Provider value={value}>
      {children}
    </StudyContext.Provider>
  );
}

