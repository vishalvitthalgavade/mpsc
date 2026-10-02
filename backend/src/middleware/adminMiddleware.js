const prisma = require("../config/prisma");

async function requireAdmin(req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is disabled.",
      });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    req.admin = user;

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify admin access.",
    });
  }
}

module.exports = {
  requireAdmin,
};