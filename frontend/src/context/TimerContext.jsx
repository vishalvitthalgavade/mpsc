import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { useStudy } from "./useStudy";

const TimerContext = createContext(null);

const TIMER_STORAGE_KEY = "gate-timer-state";
const TIMER_OWNER_KEY = "gate-timer-owner-id";

function getTimerOwnerId() {
  try {
    const existing = sessionStorage.getItem(TIMER_OWNER_KEY);
    if (existing) return existing;
    const id = crypto?.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TIMER_OWNER_KEY, id);
    return id;
  } catch {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getTimerOwnerLabel() {
  try {
    const ua = navigator.userAgent || "Browser";
    const platform = navigator.userAgentData?.platform || navigator.platform || "Device";
    return `${platform} • ${ua.includes("Mobile") ? "Mobile" : "Browser"}`;
  } catch {
    return "Browser tab";
  }
}

function loadSavedTimer(userId, ownerId) {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const saved = JSON.parse(raw);

    if (saved?.userId && saved.userId !== userId) {
      return null;
    }

    if (saved?.ownerId && saved.ownerId !== ownerId) {
      return null;
    }

    return saved;
  } catch {
    return null;
  }
}

function persistTimer(state) {
  try {
    localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage failures.
  }
}

function playBrowserBeep() {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gain.gain.value = 0.15;

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();

    window.setTimeout(() => {
      oscillator.stop();
      context.close();
    }, 500);
  } catch {
    console.log("Sound unavailable");
  }
}

function playNotificationSound() {
  try {
    const audio = new Audio("/notification.mp3");
    audio.volume = 0.8;
    audio.play().catch(playBrowserBeep);
  } catch {
    playBrowserBeep();
  }
}

/*
====================================================
SYNCHRONOUS LOCAL HYDRATION
====================================================

These run at mount time (no network round-trip)
so the timer keeps counting seamlessly across a
page refresh instead of freezing at 0/paused while
we wait on the server. The server is reconciled
with in the background afterwards.
====================================================
*/

function computeSimpleHydration(saved) {
  const savedSeconds = Number(saved?.simpleSeconds || 0);

  if (saved?.simpleRunning && saved?.simpleStartedAt) {
    /*
     * `simpleSeconds` is the live display value that was last persisted.
     * It is NOT the base value for the current running segment. Adding the
     * full time since `simpleStartedAt` to it after a refresh double-counts
     * time that has already been included in `simpleSeconds`.
     *
     * Persist the actual segment base when available. For older saved state,
     * infer it safely: an active timer that has never been paused has the
     * same session and segment start; a resumed timer has different values.
     */
    const inferredBase =
      saved?.simpleBase != null
        ? Number(saved.simpleBase)
        : saved?.simpleSessionStartedAt &&
            saved?.simpleStartedAt &&
            Number(saved.simpleSessionStartedAt) !== Number(saved.simpleStartedAt)
          ? savedSeconds
          : 0;

    const extra = Math.max(
      0,
      Math.floor((Date.now() - Number(saved.simpleStartedAt)) / 1000)
    );

    const seconds = inferredBase + extra;

    return {
      seconds,
      running: true,
      base: inferredBase,
      startedAt: Number(saved.simpleStartedAt),
    };
  }

  return {
    seconds: savedSeconds,
    running: false,
    base: savedSeconds,
    startedAt: null,
  };
}

function computePomodoroHydration(saved, defaultStudySeconds) {
  const mode = saved?.pomodoroMode || "study";

  if (saved?.pomodoroRunning && saved?.pomodoroEndAt) {
    const remaining = Math.max(
      0,
      Math.ceil((saved.pomodoroEndAt - Date.now()) / 1000)
    );

    if (remaining > 0) {
      return {
        mode,
        seconds: remaining,
        running: true,
        endAt: Date.now() + remaining * 1000,
        completedImmediately: false,
      };
    }

    // The countdown fully elapsed while the tab was
    // closed/refreshed. Let the caller run completion
    // logic once, after mount.
    return {
      mode,
      seconds: 0,
      running: false,
      endAt: null,
      completedImmediately: true,
    };
  }

  const seconds =
    saved?.pomodoroSeconds != null
      ? Number(saved.pomodoroSeconds)
      : defaultStudySeconds;

  return {
    mode,
    seconds,
    running: false,
    endAt: null,
    completedImmediately: false,
  };
}

export function TimerProvider({ children }) {
  const { authFetch, isAuthenticated, user } = useAuth();
  const { pomodoroSettings, refreshFromServer } = useStudy();

  const userId = user?.id || null;
  const timerOwnerIdRef = useRef(getTimerOwnerId());
  const timerOwnerLabelRef = useRef(getTimerOwnerLabel());

  /*
   * Computed exactly once, on the first render, from
   * whatever is already in localStorage. Using a ref
   * (instead of re-deriving on every render) means a
   * later change to `userId` or `pomodoroSettings`
   * can't accidentally re-run this initial hydration.
   */
  const initRef = useRef(null);

  if (initRef.current === null) {
    const savedState = userId ? loadSavedTimer(userId, timerOwnerIdRef.current) : null;

    initRef.current = {
      saved: savedState,
      simple: computeSimpleHydration(savedState),
      pomodoro: computePomodoroHydration(
        savedState,
        pomodoroSettings.study * 60
      ),
    };
  }

  const init = initRef.current;

  const [timerMode, setTimerMode] = useState(
    init.saved?.timerMode || "simple"
  );
  const [selectedSubject, setSelectedSubject] = useState(
    init.saved?.selectedSubject || ""
  );
  const [selectedTopic, setSelectedTopic] = useState(
    init.saved?.selectedTopic || ""
  );

  const [simpleSeconds, setSimpleSeconds] = useState(
    init.simple.seconds
  );
  const [simpleRunning, setSimpleRunning] = useState(
    init.simple.running
  );

  const [pomodoroMode, setPomodoroMode] = useState(
    init.pomodoro.mode
  );
  const [pomodoroSeconds, setPomodoroSeconds] = useState(
    init.pomodoro.seconds
  );
  const [pomodoroRunning, setPomodoroRunning] = useState(
    init.pomodoro.running
  );
  const [completedPomodoros, setCompletedPomodoros] = useState(
    init.saved?.completedPomodoros || 0
  );

  /*
   * `restoring` is now purely informational (a small
   * "syncing" note) - it never blocks the Start/Pause
   * buttons, since the state above is already correct
   * the moment the app mounts.
   */
  const [restoring, setRestoring] = useState(
    Boolean(userId)
  );
  const [timerConflict, setTimerConflict] = useState(null);

  const simpleBaseRef = useRef(init.simple.base);
  const simpleStartedAtRef = useRef(init.simple.startedAt);
  const simpleSessionStartedAtRef = useRef(
    init.saved?.simpleSessionStartedAt || init.simple.startedAt
  );

  const pomodoroEndAtRef = useRef(init.pomodoro.endAt);
  const pomodoroSessionStartedAtRef = useRef(
    init.saved?.pomodoroSessionStartedAt || null
  );
  const pomodoroModeRef = useRef(pomodoroMode);
  const pomodoroRunningRef = useRef(pomodoroRunning);
  const simpleRunningRef = useRef(simpleRunning);
  const completedPomodorosRef = useRef(completedPomodoros);
  const selectedSubjectRef = useRef(selectedSubject);
  const selectedTopicRef = useRef(selectedTopic);
  const timerModeRef = useRef(timerMode);
  const restoredRef = useRef(false);
  const simpleStartInFlightRef = useRef(false);
  const timerChannelRef = useRef(null);

  pomodoroModeRef.current = pomodoroMode;
  pomodoroRunningRef.current = pomodoroRunning;
  simpleRunningRef.current = simpleRunning;
  completedPomodorosRef.current = completedPomodoros;
  selectedSubjectRef.current = selectedSubject;
  selectedTopicRef.current = selectedTopic;
  timerModeRef.current = timerMode;

  const activeStudyRequest = useCallback(
    async (endpoint, body = {}, method = "POST") => {
      try {
        const requestOptions = {
          method,
        };

        if (method !== "GET") {
          requestOptions.body = JSON.stringify(body);
        }

        const response = await authFetch(
          endpoint,
          requestOptions
        );

        let data = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        return {
          ok: response.ok,
          status: response.status,
          response,
          data,
        };
      } catch (error) {
        console.warn(
          `Active study request error: ${endpoint}`,
          error
        );

        return {
          ok: false,
          status: null,
          response: null,
          data: null,
          error,
        };
      }
    },
    [authFetch]
  );

  const getSimpleElapsedSeconds = useCallback(() => {
    if (!simpleRunningRef.current || !simpleStartedAtRef.current) {
      return simpleBaseRef.current;
    }

    const elapsed = Math.floor(
      (Date.now() - simpleStartedAtRef.current) / 1000
    );

    return simpleBaseRef.current + Math.max(0, elapsed);
  }, []);

  const getPomodoroElapsedSeconds = useCallback(() => {
    if (pomodoroModeRef.current !== "study") {
      return 0;
    }

    const totalStudySeconds = pomodoroSettings.study * 60;
    const remaining =
      pomodoroRunningRef.current && pomodoroEndAtRef.current
        ? Math.max(
            0,
            Math.ceil(
              (pomodoroEndAtRef.current - Date.now()) / 1000
            )
          )
        : pomodoroSeconds;

    return Math.max(0, totalStudySeconds - remaining);
  }, [pomodoroSettings.study, pomodoroSeconds]);

  const startActiveSimpleStudy = useCallback(async () => {
    const result = await activeStudyRequest(
      "/sessions/active/start",
      {
        subject: selectedSubjectRef.current || "No subject",
        topic: selectedTopicRef.current || "No topic",
        type: "Regular Timer",
        accumulatedSeconds: simpleBaseRef.current,
        ownerId: timerOwnerIdRef.current,
        ownerLabel: timerOwnerLabelRef.current,
      }
    );

    if (!result.ok && result.status === 409 && result.data?.code === "TIMER_ALREADY_RUNNING") {
      setTimerConflict({ mode: "simple", activeStudy: result.data.activeStudy || null });
    }

    return result;
  }, [activeStudyRequest]);

  const startActivePomodoroStudy = useCallback(async () => {
    const result = await activeStudyRequest(
      "/sessions/active/start",
      {
        subject: selectedSubjectRef.current || "No subject",
        topic: selectedTopicRef.current || "No topic",
        type: "Pomodoro",
        accumulatedSeconds: getPomodoroElapsedSeconds(),
        ownerId: timerOwnerIdRef.current,
        ownerLabel: timerOwnerLabelRef.current,
      }
    );

    if (!result.ok && result.status === 409 && result.data?.code === "TIMER_ALREADY_RUNNING") {
      setTimerConflict({ mode: "pomodoro", activeStudy: result.data.activeStudy || null });
    }

    return result;
  }, [activeStudyRequest, getPomodoroElapsedSeconds]);

  const heartbeatActiveStudy = useCallback(async () => {
    // Do not heartbeat before the initial Start request has registered the timer.
    // Otherwise a slow first request can race the heartbeat and make a newly
    // started timer look missing/unauthorized, causing it to stop immediately.
    if (simpleStartInFlightRef.current) {
      return;
    }

    if (simpleRunningRef.current) {
      const result = await activeStudyRequest(
        "/sessions/active/heartbeat",
        {
          subject: selectedSubjectRef.current || "No subject",
          topic: selectedTopicRef.current || "No topic",
          type: "Regular Timer",
          accumulatedSeconds: getSimpleElapsedSeconds(),
          ownerId: timerOwnerIdRef.current,
          ownerLabel: timerOwnerLabelRef.current,
        }
      );

      /*
       * The server has no record of this timer (it may
       * have failed to register earlier, or been cleared
       * server-side). Recreate it so future refreshes and
       * the leaderboard stay accurate.
       */
      if (!result.ok && result.status === 409 && result.data?.code === "TIMER_OWNERSHIP_LOST") {
        setSimpleRunning(false);
        simpleStartedAtRef.current = null;
        simpleBaseRef.current = getSimpleElapsedSeconds();
        await refreshFromServer();
        try { timerChannelRef.current?.postMessage({ type: "TIMER_OWNERSHIP_LOST" }); } catch {}
        return;
      }
      if (!result.ok && result.status === 404) {
        setSimpleRunning(false);
        simpleStartedAtRef.current = null;
        simpleBaseRef.current = getSimpleElapsedSeconds();
        return;
      }

      return;
    }

    if (
      pomodoroRunningRef.current &&
      pomodoroModeRef.current === "study"
    ) {
      const result = await activeStudyRequest(
        "/sessions/active/heartbeat",
        {
          subject: selectedSubjectRef.current || "No subject",
          topic: selectedTopicRef.current || "No topic",
          type: "Pomodoro",
          accumulatedSeconds: getPomodoroElapsedSeconds(),
          ownerId: timerOwnerIdRef.current,
          ownerLabel: timerOwnerLabelRef.current,
        }
      );

      if (!result.ok && result.status === 409 && result.data?.code === "TIMER_OWNERSHIP_LOST") {
        setPomodoroRunning(false);
        pomodoroEndAtRef.current = null;
        await refreshFromServer();
        try { timerChannelRef.current?.postMessage({ type: "TIMER_OWNERSHIP_LOST" }); } catch {}
        return;
      }
      if (!result.ok && result.status === 404) {
        setPomodoroRunning(false);
        pomodoroEndAtRef.current = null;
        return;
      }
    }
  }, [
    activeStudyRequest,
    getPomodoroElapsedSeconds,
    getSimpleElapsedSeconds,
    startActivePomodoroStudy,
    startActiveSimpleStudy,
  ]);

  const pauseActiveStudy = useCallback(
    async (seconds) => {
      await activeStudyRequest("/sessions/active/pause", {
        accumulatedSeconds: seconds,
        ownerId: timerOwnerIdRef.current,
      });
    },
    [activeStudyRequest]
  );

  const stopActiveStudy = useCallback(async ({ save = false, duration = 0, type = "Regular Timer", startedAt = null } = {}) => {
    return activeStudyRequest("/sessions/active/stop", {
      ownerId: timerOwnerIdRef.current,
      saveSession: save,
      duration,
      type,
      subject: selectedSubjectRef.current || "No subject",
      topic: selectedTopicRef.current || "No topic",
      startedAt,
      clientId: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
  }, [activeStudyRequest]);

  const startSimpleTimer = useCallback(async () => {
    if (simpleRunningRef.current) {
      return;
    }

    if (pomodoroRunningRef.current) {
      return;
    }

    /*
     * Start the local clock immediately. The API registration happens in
     * parallel so network latency is not visible as a delay after pressing
     * Start. If registration fails, roll the local start back.
     */
    const base = simpleSeconds;
    const startedAt = Date.now();

    // Mark registration as in-flight so the one-time server reconciliation
    // cannot race this first Start click and interpret its own pending
    // registration as a failed timer.
    simpleStartInFlightRef.current = true;

    simpleBaseRef.current = base;
    simpleStartedAtRef.current = startedAt;
    if (!simpleSessionStartedAtRef.current) {
      simpleSessionStartedAtRef.current = startedAt;
    }
    setTimerMode("simple");
    setSimpleRunning(true);

    try {
      let result = await startActiveSimpleStudy();

      /*
       * The very first request right after opening the app (waking a
       * sleepy connection, a token that just needed a silent refresh,
       * a brief network hiccup) is the one most likely to fail once.
       * A genuine conflict (409, someone/something else already owns
       * the timer) won't succeed on a second try, so only retry other,
       * transient failures - and only once - before rolling the
       * optimistic UI back. This avoids the timer flicking on and
       * immediately back off on that first attempt.
       */
      if (!result.ok && result.status !== 409) {
        await new Promise((resolve) => window.setTimeout(resolve, 800));
        if (simpleRunningRef.current) {
          result = await startActiveSimpleStudy();
        }
      }

      if (!result.ok) {
        const currentElapsed = Math.max(
          0,
          base + Math.floor((Date.now() - startedAt) / 1000)
        );
        simpleBaseRef.current = currentElapsed;
        simpleStartedAtRef.current = null;
        setSimpleSeconds(currentElapsed);
        setSimpleRunning(false);
        return false;
      }

      return true;
    } finally {
      simpleStartInFlightRef.current = false;
    }
  }, [simpleSeconds, startActiveSimpleStudy]);

  const pauseSimpleTimer = useCallback(() => {
    if (!simpleRunningRef.current) {
      return;
    }

    const elapsed = getSimpleElapsedSeconds();
    simpleBaseRef.current = elapsed;
    simpleStartedAtRef.current = null;

    setSimpleSeconds(elapsed);
    setSimpleRunning(false);
    pauseActiveStudy(elapsed);
  }, [getSimpleElapsedSeconds, pauseActiveStudy]);

  const stopSimpleTimer = useCallback(async () => {
    const finalSeconds = simpleRunningRef.current
      ? getSimpleElapsedSeconds()
      : simpleBaseRef.current;

    setSimpleRunning(false);
    simpleStartedAtRef.current = null;
    const stopResult = await stopActiveStudy({
      save: true,
      duration: finalSeconds,
      type: "Regular Timer",
      startedAt: simpleSessionStartedAtRef.current
        ? new Date(simpleSessionStartedAtRef.current).toISOString()
        : null,
    });
    if (stopResult?.ok) await refreshFromServer();

    simpleSessionStartedAtRef.current = null;
    setSimpleSeconds(0);
    simpleBaseRef.current = 0;
  }, [getSimpleElapsedSeconds, refreshFromServer, stopActiveStudy]);

  const resetSimpleTimer = useCallback(() => {
    setSimpleRunning(false);
    simpleStartedAtRef.current = null;
    simpleSessionStartedAtRef.current = null;
    simpleBaseRef.current = 0;
    setSimpleSeconds(0);
    stopActiveStudy({ save: false });
  }, [stopActiveStudy]);

  const startPomodoro = useCallback(async () => {
    if (pomodoroRunningRef.current || simpleRunningRef.current) {
      return;
    }

    if (pomodoroModeRef.current === "study") {
      const result = await startActivePomodoroStudy();
      if (!result.ok) return false;
    }

    pomodoroEndAtRef.current =
      Date.now() + pomodoroSeconds * 1000;

    if (pomodoroModeRef.current === "study" && !pomodoroSessionStartedAtRef.current) {
      pomodoroSessionStartedAtRef.current = Date.now();
    }

    setTimerMode("pomodoro");
    setPomodoroRunning(true);
    return true;
  }, [pomodoroSeconds, startActivePomodoroStudy]);

  const pausePomodoro = useCallback(() => {
    if (!pomodoroRunningRef.current) {
      return;
    }

    const remaining = Math.max(
      0,
      Math.ceil(
        ((pomodoroEndAtRef.current || Date.now()) - Date.now()) /
          1000
      )
    );

    pomodoroEndAtRef.current = null;
    setPomodoroSeconds(remaining);
    setPomodoroRunning(false);

    if (pomodoroModeRef.current === "study") {
      pauseActiveStudy(
        Math.max(0, pomodoroSettings.study * 60 - remaining)
      );
    }
  }, [pauseActiveStudy, pomodoroSettings.study]);

  const resetPomodoro = useCallback(() => {
    setPomodoroRunning(false);
    pomodoroEndAtRef.current = null;
    pomodoroSessionStartedAtRef.current = null;
    setPomodoroMode("study");
    setPomodoroSeconds(pomodoroSettings.study * 60);
    stopActiveStudy({ save: false });
  }, [pomodoroSettings.study, stopActiveStudy]);

  const completePomodoro = useCallback(async () => {
    setPomodoroRunning(false);
    pomodoroEndAtRef.current = null;
    const stopResult = await stopActiveStudy({
      save: pomodoroModeRef.current === "study",
      duration: pomodoroSettings.study * 60,
      type: "Pomodoro",
      startedAt: pomodoroSessionStartedAtRef.current
        ? new Date(pomodoroSessionStartedAtRef.current).toISOString()
        : null,
    });
    playNotificationSound();

    if (pomodoroModeRef.current === "study") {
      const newCount = completedPomodorosRef.current + 1;
      completedPomodorosRef.current = newCount;
      setCompletedPomodoros(newCount);
      if (stopResult?.ok) {
        await refreshFromServer();
      }
      pomodoroSessionStartedAtRef.current = null;

      if (
        newCount % pomodoroSettings.sessionsBeforeLongBreak === 0
      ) {
        setPomodoroMode("longBreak");
        setPomodoroSeconds(pomodoroSettings.longBreak * 60);
      } else {
        setPomodoroMode("shortBreak");
        setPomodoroSeconds(pomodoroSettings.shortBreak * 60);
      }
    } else {
      setPomodoroMode("study");
      setPomodoroSeconds(pomodoroSettings.study * 60);
    }
  }, [
    pomodoroSettings.longBreak,
    pomodoroSettings.sessionsBeforeLongBreak,
    pomodoroSettings.shortBreak,
    pomodoroSettings.study,
    refreshFromServer,
    stopActiveStudy,
  ]);

  const completePomodoroRef = useRef(completePomodoro);
  completePomodoroRef.current = completePomodoro;

  const skipPomodoro = useCallback(() => {
    setPomodoroRunning(false);
    pomodoroEndAtRef.current = null;

    if (pomodoroModeRef.current === "study") {
      stopActiveStudy();
      pomodoroSessionStartedAtRef.current = null;
      setPomodoroMode("shortBreak");
      setPomodoroSeconds(pomodoroSettings.shortBreak * 60);
    } else {
      setPomodoroMode("study");
      setPomodoroSeconds(pomodoroSettings.study * 60);
    }
  }, [pomodoroSettings.shortBreak, pomodoroSettings.study, stopActiveStudy]);

  const handleSubjectChange = useCallback((subject) => {
    setSelectedSubject(subject);
    setSelectedTopic("");
  }, []);

  const changeTimerMode = useCallback(
    (mode) => {
      if (mode === timerModeRef.current) {
        return;
      }

      if (simpleRunningRef.current) {
        pauseSimpleTimer();
      }

      if (pomodoroRunningRef.current) {
        pausePomodoro();
      }

      setTimerMode(mode);
    },
    [pausePomodoro, pauseSimpleTimer]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;
    let channel = null;
    try {
      channel = "BroadcastChannel" in window ? new BroadcastChannel("gate-timer-ownership") : null;
      timerChannelRef.current = channel;
      channel?.addEventListener("message", async (event) => {
        if (event.data?.type !== "TIMER_TAKEN_OVER") return;
        setSimpleRunning(false);
        setPomodoroRunning(false);
        simpleStartedAtRef.current = null;
        pomodoroEndAtRef.current = null;
        await refreshFromServer();
      });
    } catch {}
    return () => {
      try { channel?.close(); } catch {}
      timerChannelRef.current = null;
    };
  }, [refreshFromServer, userId]);

  const takeOverTimer = useCallback(async (studiedSeconds) => {
    if (!timerConflict) return { ok: false };
    const mode = timerConflict.mode;
    const seconds = Math.max(0, Math.round(Number(studiedSeconds) || 0));
    const result = await activeStudyRequest("/sessions/active/takeover", {
      ownerId: timerOwnerIdRef.current,
      ownerLabel: timerOwnerLabelRef.current,
      clientId: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      studiedSeconds: seconds,
      subject: selectedSubjectRef.current || "No subject",
      topic: selectedTopicRef.current || "No topic",
      type: mode === "pomodoro" ? "Pomodoro" : "Regular Timer",
    });
    if (!result.ok) return result;

    setTimerConflict(null);
    try { timerChannelRef.current?.postMessage({ type: "TIMER_TAKEN_OVER" }); } catch {}
    await refreshFromServer();

    if (mode === "simple") {
      simpleBaseRef.current = 0;
      simpleStartedAtRef.current = Date.now();
      simpleSessionStartedAtRef.current = simpleStartedAtRef.current;
      setTimerMode("simple");
      setSimpleSeconds(0);
      setSimpleRunning(true);
    } else {
      pomodoroEndAtRef.current = Date.now() + pomodoroSeconds * 1000;
      pomodoroSessionStartedAtRef.current = Date.now();
      setTimerMode("pomodoro");
      setPomodoroRunning(true);
    }
    return result;
  }, [activeStudyRequest, pomodoroSeconds, refreshFromServer, timerConflict]);

  const dismissTimerConflict = useCallback(() => setTimerConflict(null), []);

  /*
  ====================================================
  TICKING
  ====================================================
  */

  useEffect(() => {
    if (!simpleRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setSimpleSeconds(getSimpleElapsedSeconds());
    }, 250);

    return () => window.clearInterval(interval);
  }, [getSimpleElapsedSeconds, simpleRunning]);

  useEffect(() => {
    if (!pomodoroRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(
          ((pomodoroEndAtRef.current || Date.now()) - Date.now()) /
            1000
        )
      );

      setPomodoroSeconds(remaining);

      if (remaining <= 0) {
        window.clearInterval(interval);
        completePomodoroRef.current();
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [pomodoroRunning]);

  useEffect(() => {
    if (!simpleRunning && !pomodoroRunning) {
      return;
    }

    heartbeatActiveStudy();

    const heartbeatInterval = window.setInterval(() => {
      heartbeatActiveStudy();
    }, 8000);

    return () => window.clearInterval(heartbeatInterval);
  }, [heartbeatActiveStudy, pomodoroRunning, simpleRunning]);

  /*
  ====================================================
  PERSIST TO LOCAL STORAGE
  ====================================================

  Runs on every relevant state change (several times a
  second while a timer is running), so a hard refresh
  always has a fresh snapshot to hydrate from above.
  ====================================================
  */

  useEffect(() => {
    if (!userId) {
      return;
    }

    persistTimer({
      userId,
      ownerId: timerOwnerIdRef.current,
      timerMode,
      selectedSubject,
      selectedTopic,
      simpleSeconds,
      simpleRunning,
      pomodoroMode,
      pomodoroSeconds,
      pomodoroRunning,
      completedPomodoros,
      simpleBase: simpleBaseRef.current,
      simpleStartedAt: simpleStartedAtRef.current,
      simpleSessionStartedAt: simpleSessionStartedAtRef.current,
      pomodoroEndAt: pomodoroEndAtRef.current,
      pomodoroSessionStartedAt: pomodoroSessionStartedAtRef.current,
    });
  }, [
    completedPomodoros,
    pomodoroMode,
    pomodoroRunning,
    pomodoroSeconds,
    selectedSubject,
    selectedTopic,
    simpleRunning,
    simpleSeconds,
    timerMode,
    userId,
  ]);

  /*
  ====================================================
  RUN A PENDING POMODORO COMPLETION
  ====================================================

  If the pomodoro countdown fully elapsed while the
  tab was closed/refreshed, run the normal completion
  flow (sound, save session, advance to break) once,
  right after mount.
  ====================================================
  */

  useEffect(() => {
    if (init.pomodoro.completedImmediately) {
      completePomodoroRef.current();
    }
    // Intentionally only runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
  ====================================================
  KEEP THE DEFAULT POMODORO DURATION IN SYNC
  ====================================================

  Pomodoro settings can finish loading from local
  storage/IndexedDB slightly after this provider
  mounts. If the user doesn't have an in-progress or
  paused pomodoro saved (init.saved.pomodoroSeconds),
  keep the idle countdown matched to whatever the
  settings turn out to be, instead of freezing on
  whatever the default was at first render.
  ====================================================
  */

  useEffect(() => {
    if (pomodoroRunningRef.current) {
      return;
    }

    if (pomodoroModeRef.current !== "study") {
      return;
    }

    if (init.saved?.pomodoroSeconds != null) {
      return;
    }

    setPomodoroSeconds(pomodoroSettings.study * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomodoroSettings.study]);

  /*
  ====================================================
  RECONCILE WITH THE SERVER (BACKGROUND)
  ====================================================

  The state above is already correct the instant the
  app mounts, computed from local storage. This effect
  only reconciles with the server afterwards - it never
  blocks or resets the UI, and any failure here just
  means we keep counting locally and retry via the
  heartbeat loop.
  ====================================================
  */

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setRestoring(false);
      return;
    }

    if (restoredRef.current) {
      return;
    }

    restoredRef.current = true;

    async function reconcileWithServer() {
      try {
        const result = await activeStudyRequest(
          "/sessions/active",
          {},
          "GET"
        );

        if (!result.ok) {
          // Server unreachable right now (cold start,
          // briefly offline, etc). Trust what we already
          // restored locally and try to register it with
          // the server in the background.
          if (simpleRunningRef.current && !simpleStartInFlightRef.current) {
            const retry = await startActiveSimpleStudy();
            if (!retry.ok) setSimpleRunning(false);
          } else if (
            pomodoroRunningRef.current &&
            pomodoroModeRef.current === "study"
          ) {
            const retry = await startActivePomodoroStudy();
            if (!retry.ok) setPomodoroRunning(false);
          }

          return;
        }

        // A manual Start click may have registered locally while this
        // initial GET was in flight. Let that registration finish rather
        // than overwriting/stopping the freshly started timer.
        if (simpleStartInFlightRef.current) {
          return;
        }

        const activeStudy = result.data?.activeStudy;

        if (activeStudy && activeStudy.ownerId && activeStudy.ownerId !== timerOwnerIdRef.current) {
          const elapsed = Number(activeStudy.elapsedSeconds ?? activeStudy.accumulatedSeconds ?? 0) || 0;
          setTimerConflict({
            mode: activeStudy.type === "Pomodoro" ? "pomodoro" : "simple",
            activeStudy: { ...activeStudy, elapsedSeconds: elapsed },
          });
          setSimpleRunning(false);
          setPomodoroRunning(false);
          simpleStartedAtRef.current = null;
          pomodoroEndAtRef.current = null;
          setRestoring(false);
          return;
        }

        if (activeStudy) {
          const elapsed =
            Number(
              activeStudy.elapsedSeconds ??
                activeStudy.accumulatedSeconds ??
                0
            ) || 0;

          setSelectedSubject(
            activeStudy.subject === "No subject"
              ? ""
              : activeStudy.subject || ""
          );
          setSelectedTopic(
            activeStudy.topic === "No topic"
              ? ""
              : activeStudy.topic || ""
          );

          if (activeStudy.type === "Pomodoro") {
            setTimerMode("pomodoro");
            setPomodoroMode("study");

            const remaining = Math.max(
              0,
              pomodoroSettings.study * 60 - elapsed
            );

            setPomodoroSeconds(remaining);

            if (activeStudy.isRunning && remaining > 0) {
              pomodoroEndAtRef.current =
                Date.now() + remaining * 1000;
              setPomodoroRunning(true);
            } else {
              pomodoroEndAtRef.current = null;
              setPomodoroRunning(false);

              if (remaining <= 0) {
                completePomodoroRef.current();
              }
            }
          } else {
            setTimerMode("simple");
            simpleBaseRef.current = elapsed;
            setSimpleSeconds(elapsed);

            if (activeStudy.isRunning) {
              simpleStartedAtRef.current = Date.now();
              setSimpleRunning(true);
            } else {
              simpleStartedAtRef.current = null;
              setSimpleRunning(false);
            }
          }

          return;
        }

        // The server has no active session. If we
        // restored a running timer purely from local
        // storage, recreate it server-side now so it
        // isn't lost on the next refresh.
        if (simpleRunningRef.current && !simpleStartInFlightRef.current) {
          const retry = await startActiveSimpleStudy();
          if (!retry.ok) setSimpleRunning(false);
        } else if (
          pomodoroRunningRef.current &&
          pomodoroModeRef.current === "study"
        ) {
          const retry = await startActivePomodoroStudy();
          if (!retry.ok) setPomodoroRunning(false);
        }
      } finally {
        setRestoring(false);
      }
    }

    reconcileWithServer();
  }, [
    activeStudyRequest,
    isAuthenticated,
    pomodoroSettings.study,
    startActivePomodoroStudy,
    startActiveSimpleStudy,
    userId,
  ]);

  useEffect(() => {
    if (userId) {
      return;
    }

    restoredRef.current = false;
    setSimpleRunning(false);
    setPomodoroRunning(false);
    simpleStartedAtRef.current = null;
    simpleSessionStartedAtRef.current = null;
    pomodoroEndAtRef.current = null;
    pomodoroSessionStartedAtRef.current = null;
    simpleBaseRef.current = 0;
    setSimpleSeconds(0);
    setPomodoroMode("study");
    setPomodoroSeconds(pomodoroSettings.study * 60);
    setCompletedPomodoros(0);
  }, [pomodoroSettings.study, userId]);

  const displaySeconds =
    timerMode === "simple" ? simpleSeconds : pomodoroSeconds;

  const isRunning = simpleRunning || pomodoroRunning;

  const value = useMemo(
    () => ({
      timerMode,
      changeTimerMode,
      selectedSubject,
      selectedTopic,
      handleSubjectChange,
      setSelectedTopic,
      simpleSeconds,
      simpleRunning,
      startSimpleTimer,
      pauseSimpleTimer,
      stopSimpleTimer,
      resetSimpleTimer,
      pomodoroMode,
      pomodoroSeconds,
      pomodoroRunning,
      completedPomodoros,
      startPomodoro,
      pausePomodoro,
      resetPomodoro,
      skipPomodoro,
      restoring,
      isRunning,
      timerConflict,
      takeOverTimer,
      dismissTimerConflict,
      displaySeconds,
    }),
    [
      changeTimerMode,
      completedPomodoros,
      displaySeconds,
      handleSubjectChange,
      isRunning,
      pausePomodoro,
      pauseSimpleTimer,
      pomodoroMode,
      pomodoroRunning,
      pomodoroSeconds,
      resetPomodoro,
      resetSimpleTimer,
      restoring,
      takeOverTimer,
      timerConflict,
      selectedSubject,
      selectedTopic,
      simpleRunning,
      simpleSeconds,
      skipPomodoro,
      startPomodoro,
      startSimpleTimer,
      stopSimpleTimer,
      timerMode,
    ]
  );

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);

  if (!context) {
    throw new Error("useTimer must be used inside TimerProvider");
  }

  return context;
}
