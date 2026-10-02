const express = require("express");

const {
  signup,
  login,
  refresh,
  logout,
  me,
  updateProfile,
  changePassword,
  presence,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
====================================================
PUBLIC AUTH ROUTES
====================================================
*/

// POST /api/auth/signup
router.post("/signup", signup);

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/refresh
router.post("/refresh", refresh);

// POST /api/auth/logout
router.post("/logout", logout);


/*
====================================================
PROTECTED AUTH ROUTES
====================================================

These routes require a valid access token.
====================================================
*/

// GET /api/auth/me
router.get(
  "/me",
  authMiddleware,
  me
);

// POST /api/auth/presence
router.post(
  "/presence",
  authMiddleware,
  presence
);


// PUT /api/auth/profile
// Updates the user's NAME only.
// Email cannot be changed.
router.put(
  "/profile",
  authMiddleware,
  updateProfile
);


// PUT /api/auth/change-password
// Changes the user's password after
// verifying the current password.
router.put(
  "/change-password",
  authMiddleware,
  changePassword
);


module.exports = router;