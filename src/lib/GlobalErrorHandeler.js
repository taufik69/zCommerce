// this error show when you are working on production mode error size are more consize
const productionError = (error, res) => {
  console.log("from production error funtion ", error);
  if (error.isOperationalError) {
    return res.status(error.statusCode).json({
      statusCode: error.statusCode,
      message: error.message,
    });
  } else {
    return res.status(error.statusCode).json({
      status: "error",
      message: "Something went wrong , please try agin later !!",
    });
  }
};
// this error only show when you are working on developement mode
const developementError = (error, res) => {
  return res.status(error.statusCode).json({
    statusCode: error.statusCode,
    message: error.message,
    status: error.status,
    isOperationalError: error.isOperationalError,
    data: error.data,
    errorStack: error.stack,
  });
};

exports.globalErrorHandeler = (error, req, res, next) => {
  error.statusCode = error.statusCode || 500;
  if (process.env.NODE_ENV == "developement") {
    developementError(error, res);
  } else if (process.env.NODE_ENV == "production") {
    productionError(error, res);
  }
};
