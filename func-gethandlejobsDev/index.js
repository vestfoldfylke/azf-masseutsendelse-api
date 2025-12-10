const { app } = require("@azure/functions");
const { logger } = require("@vestfoldfylke/loglady");
const { handleJobs } = require("../sharedcode/funcs/handleJobs");
const { errorResponse } = require("../sharedcode/response/response-handler");

const getHandleJobs = async (req, context) => {
  try {
    await require("../sharedcode/auth/auth.js").auth(req);
  } catch (error) {
    logger.errorException(error, "Auth failed. Aborting handleJobs");
    return errorResponse(error, "Unauthorized", 401);
  }

  return await handleJobs(context, "dev");
};

app.http("getHandleJobs", {
  authLevel: "anonymous",
  handler: getHandleJobs,
  methods: ["GET"],
  route: "handleJobs"
});
