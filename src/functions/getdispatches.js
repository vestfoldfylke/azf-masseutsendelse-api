const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const { ARCHIVE } = require("../config");
const { auth } = require("../sharedcode/auth/auth");
const getDb = require("../sharedcode/connections/masseutsendelseDB.js");
const Dispatches = require("../sharedcode/models/dispatches.js");
const { errorResponse, response } = require("../sharedcode/response/response-handler");

const getDispatches = async (req) => {
  try {
    // Authentication / Authorization
    await auth(req);

    // Await the DB connection
    await getDb();

    const fullQuery = req.query.get("full");

    // Find all dispatches
    const dispatches = [true, "true"].includes(fullQuery)
      ? await Dispatches.find({}).sort({ createdTimestamp: -1 })
      : await Dispatches.find({}).sort({ createdTimestamp: -1 }).select("-owners -excludedOwners -matrikkelUnitsWithoutOwners");

    // If no dispatches was found
    if (!dispatches) {
      return response([]);
    }

    if (ARCHIVE.ARCHIVE_SHOW_DISPATCH_URL) {
      const dispatchesWithArchiveUrl = dispatches.map((dispatch) => {
        if (dispatch.archiveUrl.includes("https://")) {
          return dispatch;
        }

        const archiveShowDispatchUrl = ARCHIVE.ARCHIVE_SHOW_DISPATCH_URL.endsWith("/") ? ARCHIVE.ARCHIVE_SHOW_DISPATCH_URL.slice(0, -1) : `${ARCHIVE.ARCHIVE_SHOW_DISPATCH_URL}`;
        const archiveUrl = dispatch.archiveUrl.startsWith("/") ? dispatch.archiveUrl.slice(1) : dispatch.archiveUrl;
        dispatch.archiveUrl = `${archiveShowDispatchUrl}/${archiveUrl}`;
        return dispatch;
      });

      logger.info("Returning {DispatchCount} dispatches", dispatchesWithArchiveUrl.length);
      return response(dispatchesWithArchiveUrl);
    }

    logger.info("Returning {DispatchCount} dispatches", dispatches.length);
    return response(dispatches);
  } catch (err) {
    logger.errorException(err, "Failed to get dispatches");
    return errorResponse(err, "Failed to get dispatches", 400);
  }
};

app.http("getDispatches", {
  authLevel: "anonymous",
  handler: getDispatches,
  methods: ["GET"],
  route: "dispatches"
});

module.exports = { getDispatches };
