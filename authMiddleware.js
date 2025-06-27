const restrictTo = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        error: `Access denied: ${role} role required`,
        code: 'AUTHORIZATION_ERROR',
      });
    }
    next();
  };
};

module.exports = { restrictTo };