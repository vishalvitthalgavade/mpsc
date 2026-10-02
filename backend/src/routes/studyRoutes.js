const express = require("express");

const {
  getCompletedTopics,
  saveCompletedTopic,
  saveCompletedTopicsBulk,
  getPomodoroSettings,
  updatePomodoroSettings,
} = require("../controllers/studyController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


/*
====================================================
ALL STUDY ROUTES REQUIRE AUTHENTICATION
====================================================
*/

router.use(authMiddleware);


/*
====================================================
COMPLETED TOPICS
====================================================
*/

router.get(
  "/topics",
  getCompletedTopics
);

router.post(
  "/topics",
  saveCompletedTopic
);

router.post(
  "/topics/bulk",
  saveCompletedTopicsBulk
);


/*
====================================================
POMODORO SETTINGS
====================================================
*/

router.get(
  "/pomodoro",
  getPomodoroSettings
);

router.put(
  "/pomodoro",
  updatePomodoroSettings
);


module.exports = router;