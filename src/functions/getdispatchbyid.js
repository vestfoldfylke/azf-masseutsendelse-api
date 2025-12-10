const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const { ARCHIVE } = require("../config");
const { auth } = require("../sharedcode/auth/auth");
const getDb = require("../sharedcode/connections/masseutsendelseDB.js");
const Dispatches = require("../sharedcode/models/dispatches.js");
const { errorResponse, response } = require("../sharedcode/response/response-handler");
const HTTPError = require("../sharedcode/vtfk-errors/httperror");

const getDispatchById = async (req) => {
  try {
    // Authentication / Authorization
    await auth(req);

    // Get ID from request
    const id = req.params.id;
    if (!id) {
      return new HTTPError(400, "No dispatch id was provided").toHTTPResponse();
    }

    // Await the database
    await getDb();

    // Find Dispatch by ID
    const dispatch = await Dispatches.findById(id);
    if (!dispatch) {
      logger.error("Dispatch with Id {Id} could not be found", id);
      return new HTTPError(404, `Dispatch with id ${id} could not be found`).toHTTPResponse();
    }

    if (!dispatch.archiveUrl.includes("https://")) {
      const archiveShowDispatchUrl = ARCHIVE.ARCHIVE_SHOW_DISPATCH_URL.endsWith("/") ? ARCHIVE.ARCHIVE_SHOW_DISPATCH_URL.slice(0, -1) : `${ARCHIVE.ARCHIVE_SHOW_DISPATCH_URL}`;
      const archiveUrl = dispatch.archiveUrl.startsWith("/") ? dispatch.archiveUrl.slice(1) : dispatch.archiveUrl;
      dispatch.archiveUrl = `${archiveShowDispatchUrl}/${archiveUrl}`;
    }

    logger.info("Found dispatch with Id {Id}", id);
    return response(dispatch);
  } catch (err) {
    logger.errorException(err, "Failed to get dispatches by id");
    return errorResponse(err, "Failed to get dispatches by id", 400);
  }
};

app.http("getDispatchById", {
  authLevel: "anonymous",
  handler: getDispatchById,
  methods: ["GET"],
  route: "dispatches/{id}"
});

module.exports = { getDispatchById };
