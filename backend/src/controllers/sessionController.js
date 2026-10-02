const crypto = require("crypto");
const prisma = require("../config/prisma");

/*
====================================================
HELPERS
====================================================
*/

function getUserId(req) {
  return req.user?.userId;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

const SESSION_MERGE_GAP_MS = 5 * 60 * 1000;

function normalizeSeconds(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return Math.round(seconds);
}


/*
====================================================
CREATE STUDY SESSION
====================================================
*/

async function createSession(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const {
      clientId,
      subject,
      topic,
      duration,
      type,
      startedAt,
      completedAt,
    } = req.body;

    /*
    --------------------------------------------------
    VALIDATION
    --------------------------------------------------
    */

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required.",
      });
    }

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required.",
      });
    }

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: "Topic is required.",
      });
    }

    const numericDuration = Number(duration);

    if (
      !Number.isFinite(numericDuration) ||
      numericDuration <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Duration must be a positive number.",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Session type is required.",
      });
    }

    /*
    --------------------------------------------------
    IDEMPOTENCY / DUPLICATE CHECK
    --------------------------------------------------
    */

    const existing =
      await prisma.studySession.findUnique({
        where: {
          clientId,
        },
      });

    if (existing) {
      if (existing.userId !== userId) {
        return res.status(403).json({
          success: false,
          message:
            "This session belongs to another user.",
        });
      }

      // The same clientId may be retried after a local/offline merge.
      // Keep the request idempotent while allowing the merged duration
      // to update an already-synchronized record.
      const updated = await prisma.studySession.update({
        where: { id: existing.id },
        data: {
          subject: String(subject),
          topic: String(topic),
          duration: Math.round(numericDuration),
          type: String(type),
          startedAt: parseDate(startedAt) || existing.startedAt,
          completedAt: parseDate(completedAt) || existing.completedAt,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Session already synchronized.",
        session: updated,
      });
    }

    /*
    --------------------------------------------------
    MERGE WITH THE PREVIOUS SESSION
    --------------------------------------------------

    If a new timer is completed less than 5 minutes after
    the previous completed session, keep one history entry
    and add the new duration to that entry. Exactly 5 minutes
    (or more) creates a new history entry.
    --------------------------------------------------
    */

    const previousSession = await prisma.studySession.findFirst({
      where: {
        userId,
        completedAt: { not: null },
      },
      orderBy: {
        completedAt: "desc",
      },
    });

    const newStartedAt = parseDate(startedAt);
    const newCompletedAt = parseDate(completedAt) || new Date();
    const previousCompletedAt = previousSession?.completedAt;

    const shouldMerge =
      Boolean(previousSession && previousCompletedAt) &&
      newStartedAt &&
      newStartedAt.getTime() >= previousCompletedAt.getTime() &&
      newStartedAt.getTime() - previousCompletedAt.getTime() <
        SESSION_MERGE_GAP_MS;

    if (shouldMerge) {
      const session = await prisma.studySession.update({
        where: { id: previousSession.id },
        data: {
          duration:
            Number(previousSession.duration || 0) +
            Math.round(numericDuration),
          completedAt: newCompletedAt,
        },
      });

      return res.status(200).json({
        success: true,
        merged: true,
        message: "Session merged into the previous history entry.",
        session,
      });
    }

    /*
    --------------------------------------------------
    CREATE DATABASE RECORD
    --------------------------------------------------
    */

    const session =
      await prisma.studySession.create({
        data: {
          clientId,

          userId,

          subject: String(subject),
          topic: String(topic),

          duration: Math.round(
            numericDuration
          ),

          type: String(type),

          startedAt: newStartedAt,

          completedAt: newCompletedAt,
        },
      });

    console.log(
      `Study session created: ${session.id} | user: ${userId}`
    );

    return res.status(201).json({
      success: true,
      message: "Study session saved successfully.",
      session,
    });
  } catch (error) {
    console.error(
      "CREATE SESSION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save study session.",
      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message,
    });
  }
}


/*
====================================================
GET USER SESSIONS
====================================================
*/

async function getSessions(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const sessions =
      await prisma.studySession.findMany({
        where: {
          userId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error(
      "GET SESSIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve study sessions.",
    });
  }
}


/*
====================================================
START ACTIVE STUDY
====================================================

Creates a new active timer.

IMPORTANT:
Only ONE active timer is allowed per user.

If the same user is already running a timer on
another browser/device, this endpoint returns 409.

A paused timer also prevents creation of a new
separate timer. The user must resume or stop it.

This DOES NOT create a StudySession.

StudySession is created only when the timer is
actually saved/completed.
====================================================
*/

async function startActiveStudy(req, res) {
  try {
    const userId = getUserId(req);
    const { subject, topic, type, accumulatedSeconds, ownerId, ownerLabel, startedAt } = req.body;
    const seconds = normalizeSeconds(accumulatedSeconds);

    if (!userId) return res.status(401).json({ success: false, message: "User authentication required." });
    if (!ownerId) return res.status(400).json({ success: false, message: "Timer ownerId is required." });
    if (seconds === null) return res.status(400).json({ success: false, message: "accumulatedSeconds must be a valid non-negative number." });
    if (!type) return res.status(400).json({ success: false, message: "Study type is required." });

    const existing = await prisma.activeStudySession.findUnique({ where: { userId } });

    if (existing) {
      const now = new Date();
      const elapsedSeconds = existing.isRunning
        ? Number(existing.accumulatedSeconds || 0) + Math.max(0, Math.floor((now.getTime() - new Date(existing.lastHeartbeatAt).getTime()) / 1000))
        : Number(existing.accumulatedSeconds || 0);

      if (existing.isRunning && existing.ownerId !== ownerId) {
        return res.status(409).json({
          success: false,
          code: "TIMER_ALREADY_RUNNING",
          message: "Your timer is already active in another tab or browser.",
          activeStudy: { ...existing, elapsedSeconds },
        });
      }

      const activeStudy = await prisma.activeStudySession.update({
        where: { userId },
        data: {
          subject: String(subject || existing.subject || "No subject"),
          topic: String(topic || existing.topic || "No topic"),
          type: String(type || existing.type),
          accumulatedSeconds: seconds,
          isRunning: true,
          pausedAt: null,
          lastHeartbeatAt: now,
          ownerLabel: ownerLabel ? String(ownerLabel) : existing.ownerLabel,
        },
      });

      return res.json({ success: true, resumed: true, message: "Active study resumed.", activeStudy });
    }

    const now = new Date();
    const requestedStart = parseDate(startedAt);
    // Preserve the real local start when a timer was running offline and is
    // being registered after connectivity returns. Never accept a future
    // timestamp from the browser.
    const effectiveStartedAt =
      requestedStart && requestedStart.getTime() <= now.getTime()
        ? requestedStart
        : now;

    const activeStudy = await prisma.activeStudySession.create({
      data: {
        userId,
        subject: String(subject || "No subject"),
        topic: String(topic || "No topic"),
        type: String(type),
        startedAt: effectiveStartedAt,
        accumulatedSeconds: seconds,
        isRunning: true,
        lastHeartbeatAt: now,
        ownerId: String(ownerId),
        ownerLabel: ownerLabel ? String(ownerLabel) : null,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: now },
    });

    return res.json({ success: true, message: "Active study started.", activeStudy });
  } catch (error) {
    console.error("START ACTIVE STUDY ERROR:", error);
    if (error?.code === "P2002") {
      return res.status(409).json({ success: false, code: "TIMER_ALREADY_RUNNING", message: "Your timer is already active in another tab or browser." });
    }
    return res.status(500).json({ success: false, message: "Failed to start active study." });
  }
}

/*
====================================================
GET ACTIVE STUDY
====================================================

Returns the current user's active timer.

This is used when the Timer page opens on another
browser/device.

Example:

Device A:
    Timer running

Device B:
    GET /api/sessions/active

Device B receives the existing active timer.
====================================================
*/

async function getActiveStudy(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const activeStudy =
      await prisma.activeStudySession.findUnique({
        where: {
          userId,
        },
      });

    if (!activeStudy) {
      return res.json({
        success: true,
        activeStudy: null,
      });
    }

    let elapsedSeconds =
      Number(activeStudy.accumulatedSeconds || 0);

    if (
      activeStudy.isRunning &&
      activeStudy.lastHeartbeatAt
    ) {
      elapsedSeconds += Math.max(
        0,
        Math.floor(
          (Date.now() -
            new Date(
              activeStudy.lastHeartbeatAt
            ).getTime()) /
            1000
        )
      );
    }

    return res.json({
      success: true,
      activeStudy: {
        ...activeStudy,
        elapsedSeconds,
      },
    });
  } catch (error) {
    console.error(
      "GET ACTIVE STUDY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to retrieve active study.",

      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message,
    });
  }
}


/*
====================================================
ACTIVE STUDY HEARTBEAT
====================================================

Called periodically while the timer is running.

The frontend sends the latest elapsed seconds.

This keeps the leaderboard updated and also lets
the backend know that the browser/device is still
actively running the timer.
====================================================
*/

async function heartbeatActiveStudy(req, res) {
  try {
    const userId = getUserId(req);
    const { subject, topic, type, accumulatedSeconds, ownerId, ownerLabel, startedAt } = req.body;
    const seconds = normalizeSeconds(accumulatedSeconds);

    if (!userId) return res.status(401).json({ success: false, message: "User authentication required." });
    if (!ownerId) return res.status(400).json({ success: false, message: "Timer ownerId is required." });
    if (seconds === null) return res.status(400).json({ success: false, message: "accumulatedSeconds must be a valid non-negative number." });

    const existing = await prisma.activeStudySession.findUnique({ where: { userId } });
    if (!existing) return res.status(404).json({ success: false, message: "No active study session found." });

    if (existing.ownerId !== ownerId) {
      return res.status(409).json({
        success: false,
        code: "TIMER_OWNERSHIP_LOST",
        message: "This timer is controlled by another tab or browser.",
      });
    }

    const activeStudy = await prisma.activeStudySession.update({
      where: { userId },
      data: {
        subject: String(subject || existing.subject || "No subject"),
        topic: String(topic || existing.topic || "No topic"),
        type: String(type || existing.type),
        accumulatedSeconds: seconds,
        isRunning: true,
        pausedAt: null,
        lastHeartbeatAt: new Date(),
        ownerLabel: ownerLabel ? String(ownerLabel) : existing.ownerLabel,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });

    return res.json({ success: true, activeStudy });
  } catch (error) {
    console.error("ACTIVE STUDY HEARTBEAT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update active study." });
  }
}

/*
====================================================
PAUSE ACTIVE STUDY
====================================================

The active record remains in the database.

isRunning becomes false.

Paused time is NOT counted by the leaderboard.

The timer can later be resumed.
====================================================
*/

async function pauseActiveStudy(req, res) {
  try {
    const userId = getUserId(req);
    const { accumulatedSeconds, ownerId } = req.body;
    const seconds = normalizeSeconds(accumulatedSeconds);
    if (!userId) return res.status(401).json({ success: false, message: "User authentication required." });
    if (!ownerId) return res.status(400).json({ success: false, message: "Timer ownerId is required." });
    if (seconds === null) return res.status(400).json({ success: false, message: "accumulatedSeconds must be a valid non-negative number." });

    const existing = await prisma.activeStudySession.findUnique({ where: { userId } });
    if (!existing) return res.status(404).json({ success: false, message: "No active study session found." });
    if (existing.ownerId !== ownerId) return res.status(409).json({ success: false, code: "TIMER_OWNERSHIP_LOST", message: "This timer is controlled by another tab or browser." });

    const activeStudy = await prisma.activeStudySession.update({
      where: { userId },
      data: { accumulatedSeconds: seconds, isRunning: false, pausedAt: new Date(), lastHeartbeatAt: new Date() },
    });
    return res.json({ success: true, message: "Study paused.", activeStudy });
  } catch (error) {
    console.error("PAUSE ACTIVE STUDY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to pause active study." });
  }
}

/*
====================================================
RESUME ACTIVE STUDY
====================================================

Resumes the user's existing paused timer.

It does NOT create another timer.
====================================================
*/

async function resumeActiveStudy(req, res) {
  try {
    const userId = getUserId(req);
    const { ownerId } = req.body;
    if (!userId) return res.status(401).json({ success: false, message: "User authentication required." });
    if (!ownerId) return res.status(400).json({ success: false, message: "Timer ownerId is required." });

    const existing = await prisma.activeStudySession.findUnique({ where: { userId } });
    if (!existing) return res.status(404).json({ success: false, message: "No saved active study session found." });
    if (existing.ownerId !== ownerId) return res.status(409).json({ success: false, code: "TIMER_ALREADY_RUNNING", message: "Your timer is controlled by another tab or browser.", activeStudy: existing });

    const activeStudy = await prisma.activeStudySession.update({
      where: { userId },
      data: { isRunning: true, pausedAt: null, lastHeartbeatAt: new Date() },
    });
    return res.json({ success: true, message: "Study resumed.", activeStudy });
  } catch (error) {
    console.error("RESUME ACTIVE STUDY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to resume active study." });
  }
}

/*
====================================================
STOP ACTIVE STUDY
====================================================

Removes the active timer completely.

The frontend should save the final StudySession
separately through:

POST /api/sessions

This endpoint is used when the user stops/resets
the timer or after the timer is saved.
====================================================
*/

async function stopActiveStudy(req, res) {
  try {
    const userId = getUserId(req);
    const { ownerId, saveSession = false, clientId, duration, subject, topic, type, startedAt } = req.body || {};
    if (!userId) return res.status(401).json({ success: false, message: "User authentication required." });
    if (!ownerId) return res.status(400).json({ success: false, message: "Timer ownerId is required." });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.activeStudySession.findUnique({ where: { userId } });
      if (!existing) return { deletedCount: 0, session: null };
      if (existing.ownerId !== ownerId) {
        throw Object.assign(new Error("TIMER_OWNERSHIP_LOST"), { code: "TIMER_OWNERSHIP_LOST" });
      }

      let session = null;
      const numericDuration = normalizeSeconds(duration);
      const serverElapsed = existing.isRunning
        ? Number(existing.accumulatedSeconds || 0) + Math.max(0, Math.floor((Date.now() - new Date(existing.lastHeartbeatAt).getTime()) / 1000))
        : Number(existing.accumulatedSeconds || 0);
      const safeDuration = numericDuration === null ? null : Math.min(numericDuration, serverElapsed);
      if (saveSession && safeDuration !== null && safeDuration > 0) {
        const completedAt = new Date();
        const previous = await tx.studySession.findFirst({
          where: { userId, completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
        });
        // The active timer record is the authoritative source for its start
        // time. This prevents a stale/local browser timestamp from collapsing
        // the history range to the stop time.
        const requestedStart = existing.startedAt || parseDate(startedAt) || completedAt;
        const shouldMerge = Boolean(previous?.completedAt && requestedStart && requestedStart.getTime() >= previous.completedAt.getTime() && requestedStart.getTime() - previous.completedAt.getTime() < SESSION_MERGE_GAP_MS);
        if (shouldMerge) {
          session = await tx.studySession.update({
            where: { id: previous.id },
            data: { duration: Number(previous.duration || 0) + safeDuration, completedAt },
          });
        } else {
          session = await tx.studySession.create({
            data: {
              clientId: String(clientId || crypto.randomUUID()),
              userId,
              subject: String(subject || existing.subject || "No subject"),
              topic: String(topic || existing.topic || "No topic"),
              duration: safeDuration,
              type: String(type || existing.type || "Regular Timer"),
              startedAt: requestedStart,
              completedAt,
            },
          });
        }
      }

      await tx.activeStudySession.delete({ where: { userId } });
      return { deletedCount: 1, session };
    }, { isolationLevel: "Serializable" });

    return res.json({ success: true, message: result.session ? "Active study saved and stopped." : "Active study stopped.", ...result });
  } catch (error) {
    if (error?.code === "TIMER_OWNERSHIP_LOST") return res.status(409).json({ success: false, code: "TIMER_OWNERSHIP_LOST", message: "This timer is controlled by another tab or browser." });
    console.error("STOP ACTIVE STUDY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to stop active study." });
  }
}

async function takeoverActiveStudy(req, res) {
  try {
    const userId = getUserId(req);
    const { ownerId, clientId, studiedSeconds, subject, topic, type, ownerLabel } = req.body || {};
    const studied = normalizeSeconds(studiedSeconds);
    if (!userId) return res.status(401).json({ success: false, message: "User authentication required." });
    if (!ownerId || !clientId) return res.status(400).json({ success: false, message: "ownerId and clientId are required." });
    if (studied === null) return res.status(400).json({ success: false, message: "studiedSeconds must be a valid non-negative number." });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.activeStudySession.findUnique({ where: { userId } });
      if (!existing) throw Object.assign(new Error("NO_ACTIVE_TIMER"), { code: "NO_ACTIVE_TIMER" });
      if (existing.ownerId === ownerId) throw Object.assign(new Error("ALREADY_OWNER"), { code: "ALREADY_OWNER" });

      const now = new Date();
      const elapsedSeconds = existing.isRunning
        ? Number(existing.accumulatedSeconds || 0) + Math.max(0, Math.floor((now.getTime() - new Date(existing.lastHeartbeatAt).getTime()) / 1000))
        : Number(existing.accumulatedSeconds || 0);

      if (studied > elapsedSeconds) {
        throw Object.assign(new Error("STUDIED_TIME_EXCEEDS_TIMER"), { code: "STUDIED_TIME_EXCEEDS_TIMER", elapsedSeconds });
      }

      let completedSession = null;
      if (studied > 0) {
        const previous = await tx.studySession.findFirst({
          where: { userId, completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
        });
        const shouldMerge = Boolean(previous?.completedAt && existing.startedAt && existing.startedAt.getTime() >= previous.completedAt.getTime() && existing.startedAt.getTime() - previous.completedAt.getTime() < SESSION_MERGE_GAP_MS);
        if (shouldMerge) {
          completedSession = await tx.studySession.update({
            where: { id: previous.id },
            data: { duration: Number(previous.duration || 0) + studied, completedAt: now },
          });
        } else {
          completedSession = await tx.studySession.create({
            data: {
              clientId,
              userId,
              subject: String(existing.subject || "No subject"),
              topic: String(existing.topic || "No topic"),
              duration: studied,
              type: String(existing.type || "Regular Timer"),
              startedAt: existing.startedAt,
              completedAt: now,
            },
          });
        }
      }

      await tx.activeStudySession.delete({ where: { userId } });
      const newNow = new Date();
      const activeStudy = await tx.activeStudySession.create({
        data: {
          userId,
          subject: String(subject || "No subject"),
          topic: String(topic || "No topic"),
          type: String(type || "Regular Timer"),
          startedAt: newNow,
          accumulatedSeconds: 0,
          isRunning: true,
          lastHeartbeatAt: newNow,
          ownerId: String(ownerId),
          ownerLabel: ownerLabel ? String(ownerLabel) : null,
        },
      });
      return { activeStudy, completedSession, previousElapsedSeconds: elapsedSeconds };
    }, { isolationLevel: "Serializable" });

    return res.json({ success: true, message: "Timer taken over successfully.", ...result });
  } catch (error) {
    if (error?.code === "NO_ACTIVE_TIMER") return res.status(404).json({ success: false, code: "NO_ACTIVE_TIMER", message: "The other timer is no longer active." });
    if (error?.code === "ALREADY_OWNER") return res.status(409).json({ success: false, code: "ALREADY_OWNER", message: "This tab already owns the timer." });
    if (error?.code === "STUDIED_TIME_EXCEEDS_TIMER") return res.status(400).json({ success: false, code: error.code, elapsedSeconds: error.elapsedSeconds, message: "Studied time cannot exceed the timer's recorded time." });
    console.error("TAKEOVER ACTIVE STUDY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to take over the active timer." });
  }
}

/*
====================================================
GET STUDY LEADERBOARD
====================================================

GET /api/sessions/leaderboard?date=today
GET /api/sessions/leaderboard?date=yesterday

Returns every registered user ranked by total
study time for the selected day.

Study time is returned in seconds.

TODAY:
    completed StudySession time
    +
    currently running ActiveStudySession time

YESTERDAY:
    completed StudySession time only

Active timers are counted only when their heartbeat
is recent.
====================================================
*/

async function getLeaderboard(req, res) {
  try {
    const currentUserId =
      getUserId(req);

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message:
          "User authentication required.",
      });
    }

    /*
    --------------------------------------------------
    SELECT DAY
    --------------------------------------------------
    */

    const selectedDate =
      req.query.date === "yesterday"
        ? "yesterday"
        : "today";

    /*
    --------------------------------------------------
    DATE RANGE
    --------------------------------------------------
    */

    const now = new Date();

    const startOfToday =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    let startDate;

    if (
      selectedDate === "yesterday"
    ) {
      startDate =
        new Date(startOfToday);

      startDate.setDate(
        startDate.getDate() - 1
      );
    } else {
      startDate =
        new Date(startOfToday);
    }

    const endDate =
      new Date(startDate);

    endDate.setDate(
      endDate.getDate() + 1
    );

    /*
    --------------------------------------------------
    GET ALL USERS
    --------------------------------------------------
    */

    const users =
      await prisma.user.findMany({
        where: {
          role: "USER",
        },
        select: {
          id: true,
          name: true,
          lastSeenAt: true,
        },

        orderBy: {
          name: "asc",
        },
      });

    /*
    --------------------------------------------------
    GET COMPLETED STUDY SESSIONS
    --------------------------------------------------
    */

    const sessions =
      await prisma.studySession.findMany({
        where: {
          OR: [
            {
              completedAt: {
                gte: startDate,
                lt: endDate,
              },
            },

            /*
            ------------------------------------------
            Fallback for older records that don't
            have completedAt.
            ------------------------------------------
            */

            {
              completedAt: null,

              createdAt: {
                gte: startDate,
                lt: endDate,
              },
            },
          ],
        },

        select: {
          userId: true,
          duration: true,
        },
      });

    /*
    --------------------------------------------------
    TOTAL COMPLETED STUDY TIME PER USER
    --------------------------------------------------
    */

    const studyTimeByUser =
      new Map();

    const studyingUserIds = new Set();

    for (
      const session of sessions
    ) {
      const previousTime =
        studyTimeByUser.get(
          session.userId
        ) || 0;

      studyTimeByUser.set(
        session.userId,
        previousTime +
          Number(
            session.duration || 0
          )
      );
    }

    /*
    --------------------------------------------------
    ACTIVE STUDY
    --------------------------------------------------

    Only TODAY can contain active study.

    A heartbeat is considered fresh for 45 seconds.

    This prevents an abandoned browser tab from
    remaining on the leaderboard forever.
    --------------------------------------------------
    */

    if (
      selectedDate === "today"
    ) {
      const heartbeatCutoff =
        new Date(
          now.getTime() -
            45 * 1000
        );

      const activeStudies =
        await prisma.activeStudySession.findMany({
          where: {
            isRunning: true,

            lastHeartbeatAt: {
              gte: heartbeatCutoff,
            },

            startedAt: {
              lt: endDate,
            },
          },

          select: {
            userId: true,
            accumulatedSeconds: true,
            startedAt: true,
          },
        });

      /*
      ----------------------------------------------
      ADD CURRENTLY RUNNING TIME
      ----------------------------------------------
      */

      for (
        const active of activeStudies
      ) {
        let activeSeconds =
          Number(
            active.accumulatedSeconds || 0
          );

        /*
        --------------------------------------------
        Timer started today.

        Its accumulated seconds are fully counted.
        --------------------------------------------
        */

        if (
          active.startedAt >=
          startDate
        ) {
          // Nothing else required.
        } else {
          /*
          ------------------------------------------
          Timer crossed midnight.

          Conservatively count only the amount
          that could have accumulated since today's
          beginning.
          ------------------------------------------
          */

          const secondsSinceStartOfToday =
            Math.max(
              0,

              Math.floor(
                (
                  now.getTime() -
                  startDate.getTime()
                ) / 1000
              )
            );

          activeSeconds =
            Math.min(
              activeSeconds,
              secondsSinceStartOfToday
            );
        }

        const previousTime =
          studyTimeByUser.get(
            active.userId
          ) || 0;

        studyTimeByUser.set(
          active.userId,

          previousTime +
            activeSeconds
        );

        // "Studying" means the user has a fresh, actively running timer.
        studyingUserIds.add(active.userId);
      }
    }

    /*
    --------------------------------------------------
    BUILD LEADERBOARD
    --------------------------------------------------
    */

    const leaderboard =
      users.map((user) => ({
        userId:
          user.id,

        name:
          user.name,

        studyTime:
          studyTimeByUser.get(
            user.id
          ) || 0,

        isStudying:
          studyingUserIds.has(user.id),

        isOnline:
          studyingUserIds.has(user.id) ||
          Boolean(
            user.lastSeenAt &&
            now.getTime() - new Date(user.lastSeenAt).getTime() <= 35 * 1000
          ),

        isCurrentUser:
          user.id === currentUserId,
      }));

    /*
    --------------------------------------------------
    SORT
    --------------------------------------------------

    Highest study time first.

    Equal study time:
    alphabetical order.
    --------------------------------------------------
    */

    leaderboard.sort(
      (a, b) => {
        if (
          b.studyTime !==
          a.studyTime
        ) {
          return (
            b.studyTime -
            a.studyTime
          );
        }

        return a.name.localeCompare(
          b.name
        );
      }
    );

    /*
    --------------------------------------------------
    ADD RANK
    --------------------------------------------------
    */

    const rankedLeaderboard =
      leaderboard.map(
        (user, index) => ({
          rank:
            index + 1,

          ...user,
        })
      );

    /*
    --------------------------------------------------
    RESPONSE
    --------------------------------------------------
    */

    return res.json({
      success: true,

      date:
        selectedDate,

      startDate:
        startDate.toISOString(),

      endDate:
        endDate.toISOString(),

      leaderboard:
        rankedLeaderboard,
    });
  } catch (error) {
    console.error(
      "GET LEADERBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to retrieve study leaderboard.",

      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message,
    });
  }
}


/*
====================================================
DELETE ONE SESSION
====================================================
*/

async function deleteSession(req, res) {
  try {
    const userId =
      getUserId(req);

    const { id } =
      req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "User authentication required.",
      });
    }

    const session =
      await prisma.studySession.findUnique({
        where: {
          id,
        },
      });

    if (!session) {
      return res.status(404).json({
        success: false,
        message:
          "Session not found.",
      });
    }

    if (
      session.userId !==
      userId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot delete another user's session.",
      });
    }

    await prisma.studySession.delete({
      where: {
        id,
      },
    });

    return res.json({
      success: true,
      message:
        "Study session deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE SESSION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete study session.",
    });
  }
}


/*
====================================================
DELETE ALL USER SESSIONS
====================================================
*/

async function deleteAllSessions(req, res) {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "User authentication required.",
      });
    }

    const result =
      await prisma.studySession.deleteMany({
        where: {
          userId,
        },
      });

    return res.json({
      success: true,

      message:
        "All study sessions deleted successfully.",

      deletedCount:
        result.count,
    });
  } catch (error) {
    console.error(
      "DELETE ALL SESSIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete study sessions.",
    });
  }
}


/*
====================================================
EXPORTS
====================================================
*/

module.exports = {
  createSession,
  getSessions,

  startActiveStudy,
  getActiveStudy,
  heartbeatActiveStudy,
  pauseActiveStudy,
  resumeActiveStudy,
  stopActiveStudy,
  takeoverActiveStudy,

  getLeaderboard,

  deleteSession,
  deleteAllSessions,
};