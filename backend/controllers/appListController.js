// get all apps => /api/v1/app_list
exports.getAppList = (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "The route will display all apps in future."
  });
};
