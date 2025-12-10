const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const blobClient = require("@vtfk/azure-blob-client");
const { auth } = require("../sharedcode/auth/auth");
const { errorResponse, response } = require("../sharedcode/response/response-handler");
const HTTPError = require("../sharedcode/vtfk-errors/httperror");

const getBlob = async (req) => {
  try {
    // Authentication / Authorization
    await auth(req);

    // Input validation
    if (!req.params.id) {
      return new HTTPError(400, "dispatchId must be specified").toHTTPResponse();
    }
    if (!req.params.name) {
      return new HTTPError(400, "name must be specified").toHTTPResponse();
    }

    // Retrieve the file
    if (process.env.NODE_ENV !== "test") {
      const file = await blobClient.get(`${req.params.id}/${req.params.name}`);
      if (!file || !file.data) {
        logger.error("No files found for DispatchId: {DispatchId} and Filename: {Filename}", req.params.id, req.params.name);
        return new HTTPError(404, "No files found, check if you passed the right filename and/or the right dispatchId").toHTTPResponse();
      }

      // Return the file
      logger.info("Retrieved blob for DispatchId: {DispatchId} and Filename: {Filename}", req.params.id, req.params.name);
      return response(file);
    }

    if (!req.params.file) {
      return new HTTPError(400, "No Files found").toHTTPResponse();
    }

    return response(req.params.file);
  } catch (err) {
    logger.errorException(err, "Failed to get blob");
    return errorResponse(err, "Failed to get blob", 400);
  }
};

app.http("getBlob", {
  authLevel: "anonymous",
  handler: getBlob,
  methods: ["GET"],
  route: "blobs/{id}/{name}"
});

module.exports = { getBlob };
