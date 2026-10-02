const express = require("express");

const {
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
} = require("../controllers/sessionController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


/*
====================================================
ALL SESSION ROUTES REQUIRE LOGIN
====================================================
*/

router.use(authMiddleware);


/*
====================================================
STUDY SESSION ROUTES
====================================================
*/

/*
POST /api/sessions

Create a completed study session.
*/
router.post(
  "/",
  createSession
);


/*
GET /api/sessions

Get current user's study sessions.
*/
router.get(
  "/",
  getSessions
);


/*
====================================================
ACTIVE STUDY TIMER
====================================================
*/

/*
GET /api/sessions/active

Check whether the current user already has
an active or paused timer.

This is important when the same account is opened
on another browser/device.
*/
router.get(
  "/active",
  getActiveStudy
);


/*
POST /api/sessions/active/start

Start a new timer.

If this user already has a running timer on
another device/browser, the backend returns:

HTTP 409
TIMER_ALREADY_RUNNING
*/
router.post(
  "/active/start",
  startActiveStudy
);


/*
POST /api/sessions/active/heartbeat

Update the currently running timer.

The frontend calls this periodically while
the timer is running.
*/
router.post(
  "/active/heartbeat",
  heartbeatActiveStudy
);


/*
POST /api/sessions/active/pause

Pause the active timer.
*/
router.post(
  "/active/pause",
  pauseActiveStudy
);


/*
POST /api/sessions/active/resume

Resume the existing paused timer.
*/
router.post(
  "/active/resume",
  resumeActiveStudy
);


/*
POST /api/sessions/active/stop

Remove the active timer.

The completed StudySession is saved separately
through POST /api/sessions.
*/
router.post(
  "/active/stop",
  stopActiveStudy
);

router.post(
  "/active/takeover",
  takeoverActiveStudy
);


/*
====================================================
LEADERBOARD
====================================================
*/

/*
GET /api/sessions/leaderboard?date=today

GET /api/sessions/leaderboard?date=yesterday

Returns all users ranked by study time.
*/
router.get(
  "/leaderboard",
  getLeaderboard
);


/*
====================================================
DELETE SESSION
====================================================
*/

/*
DELETE /api/sessions

Delete all sessions for current user.
*/
router.delete(
  "/",
  deleteAllSessions
);


/*
DELETE /api/sessions/:id

Delete one session.
*/
router.delete(
  "/:id",
  deleteSession
);


module.exports = router;