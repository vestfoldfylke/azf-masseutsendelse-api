/*
  Import dependencies
*/
const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const { MATRIKKEL } = require("../config");
const { auth } = require("../sharedcode/auth/auth");
const getAccessToken = require("../sharedcode/helpers/get-entraid-token");
const { response } = require("../sharedcode/response/response-handler");
const HTTPError = require("../sharedcode/vtfk-errors/httperror");

const getMatrikkel = async (req) => {
  // Authentication / Authorization
  await auth(req);

  // Input validation
  if (!MATRIKKEL.MATRIKKEL_BASEURL) {
    return new HTTPError(400, "The MatrikkelProxyAPI connection is not configured").toHTTPResponse();
  }
  if (!MATRIKKEL.MATRIKKEL_KEY) {
    return new HTTPError(400, "The MatrikkelProxyAPI connection is missing the APIKey").toHTTPResponse();
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(MATRIKKEL.MATRIKKEL_SCOPE);
  } catch (error) {
    logger.errorException(error, "Something went wrong fetching the access token");
    return new HTTPError(400, "Something went wrong fetching the accessToken").toHTTPResponse();
  }

  // Get ID from request
  const endpoint = decodeURIComponent(req.params.endpoint);
  const requestBody = await req.text();
  const responseRequest = await fetch(`${MATRIKKEL.MATRIKKEL_BASEURL}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-functions-key": MATRIKKEL.MATRIKKEL_KEY
    },
    body: requestBody
  });

  if (!responseRequest.ok) {
    const errorData = await responseRequest.text();
    logger.error("Failed to POST to MatrikkelProxyAPI Endpoint {Endpoint}, Status: {Status}: {StatusText}: {@ErrorData}", endpoint, responseRequest.status, responseRequest.statusText, errorData);
    return new HTTPError(responseRequest.status, `MatrikkelProxyAPI responded with status ${responseRequest.status}: ${responseRequest.statusText}`).toHTTPResponse();
  }

  const matrikkelData = await responseRequest.json();
  logger.info("Successfully fetched data from MatrikkelProxyAPI Endpoint {Endpoint}", endpoint);
  return response(matrikkelData);
};

app.http("getMatrikkel", {
  authLevel: "anonymous",
  handler: getMatrikkel,
  methods: ["POST"],
  route: "matrikkel/{endpoint}"
});

module.exports = { getMatrikkel };
