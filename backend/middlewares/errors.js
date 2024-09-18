module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  // For development, full error message
  res.status(err.statusCode).json({
    success: false,
    error: err,
    errMessage: err.message,
    stack: err.stack
  });
};
