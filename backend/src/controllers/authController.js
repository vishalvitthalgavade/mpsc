const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const prisma = require("../config/prisma");

const REFRESH_COOKIE_NAME =
  "gate_refresh_token";

const ACCESS_TOKEN_EXPIRES_IN = "7d";
const REFRESH_TOKEN_DAYS = 90;

/*
====================================================
HELPERS
====================================================
*/

function createAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    }
  );
}

function createRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashRefreshToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getRefreshExpiry() {
  const expiry = new Date();

  expiry.setDate(
    expiry.getDate() +
      REFRESH_TOKEN_DAYS
  );

  return expiry;
}

/* Record authentication activity without ever changing login outcome. */
async function recordLoginAttempt({ userId = null, email, successful, req }) {
  try {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ipAddress =
      (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : null) ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    await prisma.loginAttempt.create({
      data: {
        userId,
        email: String(email || "").trim().toLowerCase(),
        successful: Boolean(successful),
        attemptedAt: new Date(),
        ipAddress,
        userAgent: req.get("user-agent") || null,
      },
    });
  } catch (error) {
    console.error("Record login attempt error:", error);
  }
}

/*
====================================================
REFRESH COOKIE
====================================================
*/

function getCookieOptions() {
  const isProduction =
    process.env.NODE_ENV === "production";

  /*
   * In production the frontend (e.g. gateex.vercel.app)
   * and the backend live on different domains. Browsers
   * never attach a SameSite=Lax cookie to a cross-site
   * fetch()/XHR request (only to top-level navigations),
   * so the refresh cookie would silently never reach
   * /auth/refresh and users would get logged out once
   * their access token expired. SameSite=None (which
   * requires Secure) is what actually allows the cookie
   * to be sent on cross-site API calls.
   *
   * Locally, frontend and backend are same-site, so we
   * keep "lax" there since "none" requires HTTPS.
   */
  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge:
      REFRESH_TOKEN_DAYS *
      24 *
      60 *
      60 *
      1000,
    path: "/",
  };
}

function setRefreshCookie(
  res,
  refreshToken
) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getCookieOptions(),
    path: "/api/auth",
    maxAge: 0,
  });

  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    getCookieOptions()
  );
}

/*
====================================================
CLEAR REFRESH COOKIE
====================================================
*/

function clearRefreshCookie(res) {
  const options = getCookieOptions();

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
  });

  /*
   * Also clear the older path-scoped cookie so
   * leftover /api/auth cookies cannot keep
   * fighting with the new session cookie.
   */
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: "/api/auth",
  });
}

/*
====================================================
SIGNUP
====================================================
*/

async function signup(req, res) {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    const user =
      await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,

          /*
           * Normal signup users do not
           * need to change their password.
           */
          mustChangePassword: false,

          pomodoroSettings: {
            create: {
              study: 25,
              shortBreak: 5,
              longBreak: 15,
              sessionsBeforeLongBreak: 4,
            },
          },
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

    const refreshToken =
      createRefreshToken();

    const tokenHash =
      hashRefreshToken(
        refreshToken
      );

    await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt:
          getRefreshExpiry(),
      },
    });

    setRefreshCookie(
      res,
      refreshToken
    );

    const accessToken =
      createAccessToken(user);

    return res.status(201).json({
      success: true,
      accessToken,
      user,
    });
  } catch (error) {
    console.error(
      "Signup error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong during signup.",
    });
  }
}

/*
====================================================
LOGIN
====================================================
*/

async function login(req, res) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (!user) {
      await recordLoginAttempt({ email: normalizedEmail, successful: false, req });

      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    /*
     * Disabled accounts cannot log in.
     */

    if (!user.isActive) {
      await recordLoginAttempt({ userId: user.id, email: normalizedEmail, successful: false, req });

      return res.status(403).json({
        success: false,
        message:
          "This account is disabled.",
      });
    }

    /*
     * Check password.
     */

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordMatches) {
      await recordLoginAttempt({ userId: user.id, email: normalizedEmail, successful: false, req });

      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    /*
     * ================================================
     * UPDATE LOGIN ACTIVITY
     * ================================================
     *
     * This is what powers the Admin Dashboard's
     * "Last Login" and "Last Seen" columns.
     *
     * Only update these values after the password
     * has been successfully verified.
     */

    const now = new Date();

    const updatedLoginUser =
      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          lastLoginAt: now,
          lastSeenAt: now,
        },
      });

    /*
     * Create a new refresh session
     * for this login/device.
     */

    const refreshToken =
      createRefreshToken();

    const tokenHash =
      hashRefreshToken(
        refreshToken
      );

    await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt:
          getRefreshExpiry(),
      },
    });

    setRefreshCookie(
      res,
      refreshToken
    );

    /*
     * Include mustChangePassword
     * so the frontend knows whether
     * this was an admin-generated
     * temporary password.
     */

    const safeUser = {
      id: updatedLoginUser.id,
      name: updatedLoginUser.name,
      email: updatedLoginUser.email,
      role: updatedLoginUser.role,
      isActive:
        updatedLoginUser.isActive,
      mustChangePassword:
        updatedLoginUser.mustChangePassword,
      createdAt:
        updatedLoginUser.createdAt,
      lastLoginAt:
        updatedLoginUser.lastLoginAt,
      lastSeenAt:
        updatedLoginUser.lastSeenAt,
    };

    const accessToken =
      createAccessToken(
        safeUser
      );

    await recordLoginAttempt({
      userId: updatedLoginUser.id,
      email: normalizedEmail,
      successful: true,
      req,
    });

    return res.json({
      success: true,
      accessToken,
      user: safeUser,

      /*
       * Explicit flag for the login
       * response as well.
       */

      mustChangePassword:
        updatedLoginUser.mustChangePassword,
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong during login.",
    });
  }
}

/*
====================================================
REFRESH
====================================================
*/

async function refresh(req, res) {
  try {
    const refreshToken =
      req.cookies?.[
        REFRESH_COOKIE_NAME
      ];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message:
          "Refresh token missing.",
      });
    }

    const tokenHash =
      hashRefreshToken(
        refreshToken
      );

    const authSession =
      await prisma.authSession.findUnique(
        {
          where: {
            tokenHash,
          },

          include: {
            user: true,
          },
        }
      );

    if (!authSession) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Invalid refresh session.",
      });
    }

    if (authSession.revokedAt) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Refresh session has been revoked.",
      });
    }

    if (
      new Date() >
      authSession.expiresAt
    ) {
      await prisma.authSession.update({
        where: {
          id: authSession.id,
        },

        data: {
          revokedAt: new Date(),
        },
      });

      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Refresh session expired.",
      });
    }

    const user =
      authSession.user;

    /*
     * Disabled accounts cannot
     * refresh their sessions.
     */

    if (!user.isActive) {
      await prisma.authSession.update({
        where: {
          id: authSession.id,
        },

        data: {
          revokedAt: new Date(),
        },
      });

      clearRefreshCookie(res);

      return res.status(403).json({
        success: false,
        message:
          "This account is disabled.",
      });
    }

    /*
     * Update last seen whenever the
     * refresh session is successfully used.
     *
     * This keeps the admin activity data
     * more useful without changing the
     * original lastLoginAt value.
     */

    const refreshedAt = new Date();

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        lastSeenAt: refreshedAt,
      },
    });

    /*
     * Keep the same refresh token. Rotating it on
     * every refresh races when two tabs refresh at
     * once and logs the user out.
     */

    await prisma.authSession.update({
      where: {
        id: authSession.id,
      },

      data: {
        expiresAt: getRefreshExpiry(),
        revokedAt: null,
      },
    });

    setRefreshCookie(res, refreshToken);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword:
        user.mustChangePassword,
      createdAt: user.createdAt,

      /*
       * Include activity information
       * so the frontend always has the
       * latest values.
       */
      lastLoginAt:
        user.lastLoginAt,
      lastSeenAt: refreshedAt,
    };

    const accessToken =
      createAccessToken(
        safeUser
      );

    return res.json({
      success: true,
      accessToken,
      user: safeUser,

      mustChangePassword:
        user.mustChangePassword,
    });
  } catch (error) {
    console.error(
      "Refresh error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not refresh authentication session.",
    });
  }
}

/*
====================================================
LOGOUT
====================================================
*/

async function logout(req, res) {
  try {
    const refreshToken =
      req.cookies?.[
        REFRESH_COOKIE_NAME
      ];

    if (refreshToken) {
      const tokenHash =
        hashRefreshToken(
          refreshToken
        );

      await prisma.authSession.updateMany(
        {
          where: {
            tokenHash,
          },

          data: {
            revokedAt:
              new Date(),
          },
        }
      );
    }

    clearRefreshCookie(res);

    return res.json({
      success: true,
      message:
        "Logged out successfully.",
    });
  } catch (error) {
    console.error(
      "Logout error:",
      error
    );

    clearRefreshCookie(res);

    return res.json({
      success: true,
      message:
        "Logged out locally.",
    });
  }
}

/*
====================================================
CURRENT USER
====================================================
*/

async function me(req, res) {
  try {
    const user =
      await prisma.user.findUnique({
        where: {
          id: req.user.userId,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is disabled.",
      });
    }

    /*
     * Keep lastSeenAt current whenever
     * an authenticated user calls /me.
     */

    const updatedUser =
      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          lastSeenAt: new Date(),
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

    return res.json({
      success: true,
      user: updatedUser,

      mustChangePassword:
        updatedUser.mustChangePassword,
    });
  } catch (error) {
    console.error(
      "Me error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not retrieve user.",
    });
  }
}

/*
====================================================
UPDATE PROFILE
====================================================
*/

async function updateProfile(
  req,
  res
) {
  try {
    const { name } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name is required.",
      });
    }

    const trimmedName =
      name.trim();

    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be at least 2 characters.",
      });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Name cannot exceed 100 characters.",
      });
    }

    const user =
      await prisma.user.update({
        where: {
          id: req.user.userId,
        },

        data: {
          name: trimmedName,
          lastSeenAt: new Date(),
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

    return res.json({
      success: true,
      message:
        "Profile updated successfully.",
      user,
    });
  } catch (error) {
    console.error(
      "Update profile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not update profile.",
    });
  }
}

/*
====================================================
CHANGE PASSWORD
====================================================
*/

async function changePassword(
  req,
  res
) {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (
      typeof currentPassword !==
        "string" ||
      typeof newPassword !==
        "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Current password and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters.",
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        message:
          "New password cannot exceed 128 characters.",
      });
    }

    if (
      currentPassword ===
      newPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from the current password.",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: req.user.userId,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          passwordHash: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is disabled.",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        currentPassword,
        user.passwordHash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "Current password is incorrect.",
      });
    }

    const newPasswordHash =
      await bcrypt.hash(
        newPassword,
        12
      );

    /*
     * Setting a new password clears
     * the temporary-password requirement.
     */

    const updatedUser =
      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          passwordHash:
            newPasswordHash,

          mustChangePassword: false,

          lastSeenAt: new Date(),
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

    return res.json({
      success: true,

      message:
        user.mustChangePassword
          ? "Temporary password replaced successfully. Your new password is now permanent."
          : "Password changed successfully.",

      user: updatedUser,
    });
  } catch (error) {
    console.error(
      "Change password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not change password.",
    });
  }
}

/*
====================================================
EXPORTS
====================================================
*/


/*
====================================================
PRESENCE HEARTBEAT
====================================================

Lightweight authenticated endpoint used by the web app
while it is visible. This lets the leaderboard distinguish
users who are currently in the app from users who have
left/closed it.
====================================================
*/

async function presence(req, res) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const updatedAt = new Date();

    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: updatedAt },
    });

    return res.json({
      success: true,
      lastSeenAt: updatedAt,
    });
  } catch (error) {
    console.error("Presence heartbeat error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update presence.",
    });
  }
}

module.exports = {
  signup,
  login,
  refresh,
  logout,
  me,
  updateProfile,
  changePassword,
  presence,
};