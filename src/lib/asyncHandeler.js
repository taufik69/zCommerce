exports.asynchandeler = (func) => {
  return async (req, res, next) => {
    try {
      await func(req, res, next);
    } catch (error) {
      console.log(" error from asynchandeler", error);
      next(error);
    }
  };
};
