const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");

const {
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
} = require("../controllers/adminController");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Admin Authentication
|--------------------------------------------------------------------------
|
| Every route below requires:
|
| 1. Valid JWT
| 2. Active user account
| 3. ADMIN role
|
|--------------------------------------------------------------------------
*/

router.use(authMiddleware);
router.use(requireAdmin);

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

router.get("/stats", getAdminStats);

/*
|--------------------------------------------------------------------------
| Users
|--------------------------------------------------------------------------
*/

// Get all users
router.get("/users", getAllUsers);

// Get one user's complete admin-visible details
router.get("/users/:userId", getUserById);

// Enable / disable user
router.patch("/users/:userId/status", updateUserStatus);

// Revoke all active sessions for a user
router.post(
  "/users/:userId/revoke-sessions",
  revokeUserSessions
);

// Reset user's password
router.post(
  "/users/:userId/reset-password",
  resetUserPassword
);

// Change user role
router.patch(
  "/users/:userId/role",
  updateUserRole
);

// Permanently delete user
router.delete(
  "/users/:userId",
  deleteUser
);

// Clear study history
router.delete(
  "/users/:userId/study-history",
  deleteUserStudyHistory
);

// Force clear a currently active timer
router.post(
  "/users/:userId/active-timer/clear",
  clearUserActiveTimer
);

/*
|--------------------------------------------------------------------------
| Security / Monitoring
|--------------------------------------------------------------------------
*/

// Login attempts
router.get("/login-attempts", getLoginAttempts);
router.delete("/login-attempts", clearLoginAttempts);
router.delete("/login-attempts/:attemptId", deleteLoginAttempt);

// Currently active authentication sessions
router.get("/sessions", getActiveSessions);
router.delete("/sessions", revokeAllActiveSessions);
router.delete("/sessions/:sessionId", revokeActiveSession);

module.exports = router;