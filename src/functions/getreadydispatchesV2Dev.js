const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const { getReadyDispatchesV2 } = require("../sharedcode/funcs/getReadyDispatchesV2.js");
const { alertTeams } = require("../sharedcode/helpers/alertTeams.js");
const { errorResponse } = require("../sharedcode/response/response-handler");

const getReadyDispatches = async (req, context) => {
  try {
    return await getReadyDispatchesV2(req, context);
  } catch (err) {
    await alertTeams(err, "error", "func-getreadydispatchesV2Dev failed", [], "no id found", context.functionName);
    logger.errorException(err, "Failed to get ready dispatches V2 (Dev)");
    return errorResponse(err, "Failed to get ready dispatches V2", 400);
  }
};

app.http("getReadyDispatches", {
  authLevel: "anonymous",
  handler: getReadyDispatches,
  methods: ["GET"],
  route: "readyDispatches"
});
