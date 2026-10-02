const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../config/prisma");

/*
|--------------------------------------------------------------------------
| Admin Dashboard Statistics
|--------------------------------------------------------------------------
*/

async function getAdminStats(req, res) {
  try {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      newUsersToday,
      newUsersThisWeek,
      totalStudySessions,
      totalStudySeconds,
      currentlyStudying,
    ] = await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: {
          isActive: true,
        },
      }),

      prisma.user.count({
        where: {
          isActive: false,
        },
      }),

      prisma.user.count({
        where: {
          role: "ADMIN",
        },
      }),

      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfToday(),
          },
        },
      }),

      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfWeek(),
          },
        },
      }),

      prisma.studySession.count(),

      prisma.studySession.aggregate({
        _sum: {
          duration: true,
        },
      }),

      prisma.activeStudySession.count({
        where: {
          isRunning: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        adminUsers,
        newUsersToday,
        newUsersThisWeek,
        totalStudySessions,
        totalStudySeconds:
          totalStudySeconds._sum.duration || 0,
        currentlyStudying,
      },
    });
  } catch (error) {
    console.error(
      "Get admin stats error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load admin statistics.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Get All Users
|--------------------------------------------------------------------------
*/

async function getAllUsers(req, res) {
  try {
    const users =
      await prisma.user.findMany({
        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          lastSeenAt: true,

          _count: {
            select: {
              studySessions: true,
              completedTopics: true,
              authSessions: true,
              loginAttempts: true,
            },
          },
        },
      });

    return res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error(
      "Get all users error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load users.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Get Single User
|--------------------------------------------------------------------------
*/

async function getUserById(req, res) {
  try {
    const { userId } = req.params;

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          lastSeenAt: true,

          studySessions: {
            orderBy: {
              createdAt: "desc",
            },

            take: 20,

            select: {
              id: true,
              subject: true,
              topic: true,
              duration: true,
              type: true,
              startedAt: true,
              completedAt: true,
              createdAt: true,
            },
          },

          completedTopics: {
            orderBy: {
              updatedAt: "desc",
            },

            take: 20,

            select: {
              id: true,
              subject: true,
              unit: true,
              topic: true,
              completed: true,
              completedAt: true,
              updatedAt: true,
            },
          },

          authSessions: {
            orderBy: {
              createdAt: "desc",
            },

            select: {
              id: true,
              createdAt: true,
              expiresAt: true,
              revokedAt: true,
            },
          },

          activeStudy: {
            select: {
              id: true,
              subject: true,
              topic: true,
              type: true,
              startedAt: true,
              pausedAt: true,
              accumulatedSeconds: true,
              isRunning: true,
              lastHeartbeatAt: true,
              ownerLabel: true,
            },
          },

          loginAttempts: {
            orderBy: {
              attemptedAt: "desc",
            },

            take: 50,

            select: {
              id: true,
              email: true,
              successful: true,
              attemptedAt: true,
              ipAddress: true,
              userAgent: true,
            },
          },

          _count: {
            select: {
              studySessions: true,
              completedTopics: true,
              authSessions: true,
              loginAttempts: true,
            },
          },
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "Get user by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load user.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Enable / Disable User
|--------------------------------------------------------------------------
*/

async function updateUserStatus(req, res) {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "isActive must be true or false.",
      });
    }

    if (userId === req.admin.id) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot disable your own admin account.",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const updatedUser =
      await prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          isActive,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
        },
      });

    /*
     * If the account is being disabled,
     * revoke all active sessions.
     */

    if (!isActive) {
      await prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      });
    }

    return res.json({
      success: true,

      message: isActive
        ? "User account enabled."
        : "User account disabled and active sessions revoked.",

      user: updatedUser,
    });
  } catch (error) {
    console.error(
      "Update user status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update user status.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Revoke All User Sessions
|--------------------------------------------------------------------------
*/

async function revokeUserSessions(req, res) {
  try {
    const { userId } = req.params;

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          name: true,
          email: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const result =
      await prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      });

    return res.json({
      success: true,
      message:
        "All active sessions revoked.",
      revokedSessions:
        result.count,
    });
  } catch (error) {
    console.error(
      "Revoke user sessions error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to revoke user sessions.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Reset User Password
|--------------------------------------------------------------------------
|
| Generates a temporary password.
|
| The temporary password is:
|
| 1. Hashed in the database.
| 2. Returned to the administrator once.
| 3. Marked with mustChangePassword=true.
| 4. All existing sessions are revoked.
|
| The temporary password is NOT stored
| in plaintext in the database.
|--------------------------------------------------------------------------
*/

async function resetUserPassword(req, res) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Do not allow an administrator to reset another
    // administrator's password through the normal-user panel.
    if (user.role === "ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Administrator passwords cannot be reset from the user management panel.",
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "This user account is disabled. Enable the account before resetting the password.",
      });
    }

    /*
     * Generate a secure temporary password.
     *
     * The password is returned only once to the administrator.
     * Only the bcrypt hash is stored in PostgreSQL.
     */
    const temporaryPassword =
      crypto.randomBytes(12).toString("base64url") +
      "A1!";

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      12
    );

    /*
     * Verify that the generated temporary password
     * actually matches the hash before storing it.
     *
     * This prevents a broken reset from returning a
     * password that cannot be used for login.
     */
    const passwordVerified = await bcrypt.compare(
      temporaryPassword,
      passwordHash
    );

    if (!passwordVerified) {
      console.error(
        "Temporary password verification failed during admin reset."
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to generate a valid temporary password.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          passwordHash,
          mustChangePassword: true,
        },
      });

      /*
       * Revoke existing refresh sessions.
       *
       * The user can still have an existing access JWT
       * until its normal expiration. The next login will
       * create a completely new session.
       */
      await tx.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });

    /*
     * Read the user again to verify that the database
     * contains the expected state.
     */
    const updatedUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        mustChangePassword: true,
      },
    });

    if (
      !updatedUser ||
      updatedUser.mustChangePassword !== true
    ) {
      console.error(
        "Password reset database verification failed.",
        {
          userId,
          updatedUser,
        }
      );

      return res.status(500).json({
        success: false,
        message:
          "Password reset could not be verified.",
      });
    }

    return res.json({
      success: true,
      message:
        "Password reset successfully. The temporary password is shown only once.",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
      },
      temporaryPassword,
    });
  } catch (error) {
    console.error(
      "Admin reset user password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reset user password.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Permanently Delete User
|--------------------------------------------------------------------------
*/

async function deleteUser(req, res) {
  try {
    const { userId } = req.params;

    if (userId === req.admin.id) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot delete your own admin account.",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role === "ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Admin accounts cannot be deleted through this endpoint.",
      });
    }

    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    return res.json({
      success: true,
      message:
        "User and all associated data permanently deleted.",

      deletedUser: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      "Delete user error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete user.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Update User Role
|--------------------------------------------------------------------------
*/

async function updateUserRole(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.body || {};
    if (!["USER", "ADMIN"].includes(role)) {
      return res.status(400).json({ success: false, message: "role must be USER or ADMIN." });
    }
    if (userId === req.admin.id) {
      return res.status(400).json({ success: false, message: "You cannot change your own admin role." });
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    if (user.role === "ADMIN" && role === "USER") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
      if (adminCount <= 1) return res.status(400).json({ success: false, message: "At least one active administrator must remain." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return res.json({ success: true, message: `User role changed to ${role}.`, user: updatedUser });
  } catch (error) {
    console.error("Update user role error:", error);
    return res.status(500).json({ success: false, message: "Failed to update user role." });
  }
}

/*
|--------------------------------------------------------------------------
| Delete All Study History For User
|--------------------------------------------------------------------------
*/

async function deleteUserStudyHistory(req, res) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const result = await prisma.studySession.deleteMany({ where: { userId } });
    return res.json({ success: true, message: "User study history deleted.", deletedCount: result.count });
  } catch (error) {
    console.error("Delete user study history error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete user study history." });
  }
}

/*
|--------------------------------------------------------------------------
| Force Clear Active Timer
|--------------------------------------------------------------------------
*/

async function clearUserActiveTimer(req, res) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const result = await prisma.activeStudySession.deleteMany({ where: { userId } });
    return res.json({ success: true, message: result.count ? "Active timer cleared." : "No active timer found.", deletedCount: result.count });
  } catch (error) {
    console.error("Clear active timer error:", error);
    return res.status(500).json({ success: false, message: "Failed to clear active timer." });
  }
}

/*
|--------------------------------------------------------------------------
| Login Attempts
|--------------------------------------------------------------------------
*/

async function getLoginAttempts(req, res) {
  try {
    const attempts =
      await prisma.loginAttempt.findMany({
        orderBy: {
          attemptedAt: "desc",
        },

        take: 200,

        select: {
          id: true,
          userId: true,
          email: true,
          successful: true,
          attemptedAt: true,
          ipAddress: true,
          userAgent: true,
        },
      });

    return res.json({
      success: true,
      count: attempts.length,
      attempts,
    });
  } catch (error) {
    console.error(
      "Get login attempts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load login attempts.",
    });
  }
}


/*
|--------------------------------------------------------------------------
| Delete Login Attempt
|--------------------------------------------------------------------------
*/

async function deleteLoginAttempt(req, res) {
  try {
    const { attemptId } = req.params;

    const result = await prisma.loginAttempt.deleteMany({
      where: { id: attemptId },
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        message: "Login attempt not found.",
      });
    }

    return res.json({
      success: true,
      message: "Login attempt deleted.",
    });
  } catch (error) {
    console.error("Delete login attempt error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete login attempt.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Clear Login Attempts
|--------------------------------------------------------------------------
*/

async function clearLoginAttempts(req, res) {
  try {
    const result = await prisma.loginAttempt.deleteMany({});

    return res.json({
      success: true,
      message: result.count
        ? `Cleared ${result.count} login attempts.`
        : "No login attempts to clear.",
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("Clear login attempts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear login attempts.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Revoke Single Active Session
|--------------------------------------------------------------------------
*/

async function revokeActiveSession(req, res) {
  try {
    const { sessionId } = req.params;

    const result = await prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        message: "Active session not found.",
      });
    }

    return res.json({
      success: true,
      message: "Session revoked.",
    });
  } catch (error) {
    console.error("Revoke active session error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to revoke session.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Revoke All Active Sessions
|--------------------------------------------------------------------------
*/

async function revokeAllActiveSessions(req, res) {
  try {
    const result = await prisma.authSession.updateMany({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: result.count
        ? `Revoked ${result.count} active sessions.`
        : "No active sessions to revoke.",
      revokedCount: result.count,
    });
  } catch (error) {
    console.error("Revoke all active sessions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to revoke active sessions.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Active Sessions
|--------------------------------------------------------------------------
*/

async function getActiveSessions(req, res) {
  try {
    const sessions =
      await prisma.authSession.findMany({
        where: {
          revokedAt: null,

          expiresAt: {
            gt: new Date(),
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          createdAt: true,
          expiresAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              mustChangePassword: true,
            },
          },
        },
      });

    return res.json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    console.error(
      "Get active sessions error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load active sessions.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Helper Functions
|--------------------------------------------------------------------------
*/

function startOfToday() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date;
}

function startOfWeek() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  const day = date.getDay();

  const difference =
    day === 0 ? 6 : day - 1;

  date.setDate(
    date.getDate() - difference
  );

  return date;
}

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  getAdminStats,
  getAllUsers,
  getUserById,
  updateUserStatus,
  revokeUserSessions,
  resetUserPassword,
  deleteUser,
  updateUserRole,
  deleteUserStudyHistory,
  clearUserActiveTimer,
  getLoginAttempts,
  deleteLoginAttempt,
  clearLoginAttempts,
  getActiveSessions,
  revokeActiveSession,
  revokeAllActiveSessions,
};