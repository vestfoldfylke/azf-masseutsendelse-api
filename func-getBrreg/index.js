const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const { auth } = require("../sharedcode/auth/auth");
const { errorResponse, response } = require("../sharedcode/response/response-handler");
const HTTPError = require("../sharedcode/vtfk-errors/httperror");

const getBRReg = async (req) => {
  // Authentication / Authorization
  await auth(req);

  // Get ID from request
  const id = req.params.id;
  if (!id) {
    return new HTTPError(400, "No dispatch id was provided").toHTTPResponse();
  }

  // Make the request
  const responseRequest = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${id}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!responseRequest.ok) {
    const errorData = await responseRequest.text();
    logger.error("Failed to get data for EnhetId {EnhetId} from BRReg. Status: {Status}: {StatusText}: {@ErrorData}", id, responseRequest.status, responseRequest.statusText, errorData);
    return new HTTPError(responseRequest.status, `BRReg responded with status code ${responseRequest.status} for id ${id}: ${responseRequest.statusText}`).toHTTPResponse();
  }

  try {
    const responseData = await responseRequest.json();
    logger.info("Fetched data for EnhetId {EnhetId} from BRReg", id);

    return response(responseData);
  } catch (err) {
    logger.errorException(err, "Failed to parse BRReg response for EnhetId {EnhetId}", id);
    return errorResponse(err, `Failed to parse BRReg response for EnhetId ${id}`, 500);
  }
};

app.http("getBRReg", {
  authLevel: "anonymous",
  handler: getBRReg,
  methods: ["GET"],
  route: "brreg/{id}"
});
