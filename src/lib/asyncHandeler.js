exports.asynchandeler = (func) => {
  return async (req, res, next) => {
    try {
      await func(req, res, next);
    } catch (error) {
      console.log("Error in async handler:", error);
      next(error); // call error middleware
    }
  };
};
