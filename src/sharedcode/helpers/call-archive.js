const { logger } = require("@vestfoldfylke/loglady");
const { ARCHIVE } = require("../../config");
const getAccessToken = require("./get-entraid-token");
const HTTPError = require("../vtfk-errors/httperror.js");

module.exports.callArchive = async (endpoint, payload) => {
  const accessToken = await getAccessToken(ARCHIVE.ARCHIVE_SCOPE);
  const response = await fetch(`${ARCHIVE.ARCHIVE_ENDPOINT}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    logger.error("Failed calling archive service with Endpoint {Endpoint}. Status: {Status}: {StatusText}: {@ErrorData}", endpoint, response.status, response.statusText, errorData);
    throw new HTTPError(response.status, `Error calling archive service: ${response.statusText}`);
  }

  return await response.json();
};
