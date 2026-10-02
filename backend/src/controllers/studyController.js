const prisma = require("../config/prisma");


/*
====================================================
COMPLETED TOPICS
====================================================
*/


/*
GET /api/study/topics
*/

async function getCompletedTopics(req, res) {
  try {
    const userId = req.user.userId;

    const topics = await prisma.completedTopic.findMany({
      where: {
        userId,
      },

      orderBy: {
        updatedAt: "desc",
      },
    });

    return res.json({
      success: true,
      topics,
    });
  } catch (error) {
    console.error(
      "Get completed topics error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve completed topics.",
    });
  }
}


/*
POST /api/study/topics
*/

async function saveCompletedTopic(req, res) {
  try {
    const userId = req.user.userId;

    const {
      subject,
      unit,
      topic,
      completed,
    } = req.body;

    if (!subject || !unit || !topic) {
      return res.status(400).json({
        success: false,
        message:
          "Subject, unit and topic are required.",
      });
    }

    const isCompleted = Boolean(completed);

    const savedTopic =
      await prisma.completedTopic.upsert({
        where: {
          userId_subject_unit_topic: {
            userId,
            subject: String(subject),
            unit: String(unit),
            topic: String(topic),
          },
        },

        update: {
          completed: isCompleted,

          completedAt: isCompleted
            ? new Date()
            : null,
        },

        create: {
          userId,

          subject: String(subject),
          unit: String(unit),
          topic: String(topic),

          completed: isCompleted,

          completedAt: isCompleted
            ? new Date()
            : null,
        },
      });

    return res.json({
      success: true,
      topic: savedTopic,
    });
  } catch (error) {
    console.error(
      "Save completed topic error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to save completed topic.",
    });
  }
}


/*
POST /api/study/topics/bulk
*/

async function saveCompletedTopicsBulk(req, res) {
  try {
    const userId = req.user.userId;

    const { topics } = req.body;

    if (!Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        message: "topics must be an array.",
      });
    }

    const results = [];

    for (const item of topics) {
      if (
        !item.subject ||
        !item.unit ||
        !item.topic
      ) {
        continue;
      }

      const saved =
        await prisma.completedTopic.upsert({
          where: {
            userId_subject_unit_topic: {
              userId,

              subject: String(item.subject),

              unit: String(item.unit),

              topic: String(item.topic),
            },
          },

          update: {
            completed: Boolean(
              item.completed
            ),

            completedAt: item.completed
              ? new Date()
              : null,
          },

          create: {
            userId,

            subject: String(item.subject),

            unit: String(item.unit),

            topic: String(item.topic),

            completed: Boolean(
              item.completed
            ),

            completedAt: item.completed
              ? new Date()
              : null,
          },
        });

      results.push(saved);
    }

    return res.json({
      success: true,
      topics: results,
    });
  } catch (error) {
    console.error(
      "Bulk topic save error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to save completed topics.",
    });
  }
}


/*
====================================================
POMODORO SETTINGS
====================================================
*/


/*
GET /api/study/pomodoro
*/

async function getPomodoroSettings(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    let settings =
      await prisma.pomodoroSettings.findUnique({
        where: {
          userId,
        },
      });

    /*
      Create defaults if they don't exist.
    */

    if (!settings) {
      settings =
        await prisma.pomodoroSettings.create({
          data: {
            userId,

            study: 25,

            shortBreak: 5,

            longBreak: 15,

            sessionsBeforeLongBreak: 4,
          },
        });
    }

    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error(
      "Get Pomodoro settings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve Pomodoro settings.",
    });
  }
}


/*
PUT /api/study/pomodoro
*/

async function updatePomodoroSettings(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const {
      study,
      shortBreak,
      longBreak,
      sessionsBeforeLongBreak,
    } = req.body;

    /*
      Validate numeric values.
    */

    const values = {
      study,
      shortBreak,
      longBreak,
      sessionsBeforeLongBreak,
    };

    for (const [key, value] of Object.entries(
      values
    )) {
      if (
        value !== undefined &&
        (!Number.isInteger(value) ||
          value <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${key} must be a positive integer.`,
        });
      }
    }

    const settings =
      await prisma.pomodoroSettings.upsert({
        where: {
          userId,
        },

        update: {
          ...(study !== undefined && {
            study,
          }),

          ...(shortBreak !== undefined && {
            shortBreak,
          }),

          ...(longBreak !== undefined && {
            longBreak,
          }),

          ...(sessionsBeforeLongBreak !==
            undefined && {
            sessionsBeforeLongBreak,
          }),
        },

        create: {
          userId,

          study: study ?? 25,

          shortBreak:
            shortBreak ?? 5,

          longBreak:
            longBreak ?? 15,

          sessionsBeforeLongBreak:
            sessionsBeforeLongBreak ?? 4,
        },
      });

    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error(
      "Update Pomodoro settings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update Pomodoro settings.",
    });
  }
}


module.exports = {
  getCompletedTopics,
  saveCompletedTopic,
  saveCompletedTopicsBulk,
  getPomodoroSettings,
  updatePomodoroSettings,
};