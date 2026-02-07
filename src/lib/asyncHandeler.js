exports.asynchandeler = (func) => {
  return async (req, res, next) => {
    try {
      await func(req, res, next);
    } catch (error) {
      console.log("from async handeler", error);
      next(error);
    }
  };
};
