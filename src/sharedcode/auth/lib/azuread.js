const { verify } = require("azure-ad-verify-token");
const { logger } = require("@vestfoldfylke/loglady");
const HTTPError = require("../../vtfk-errors/httperror");
const { AZUREAD_TOKEN_CONFIG, MS, GRAPH } = require("../../../config");
const getAccessToken = require("../../helpers/get-entraid-token");

const getEntraToken = async () => {
  try {
    return await getAccessToken(GRAPH.GRAPH_SCOPE);
  } catch (error) {
    logger.errorException(error, "Not able to contact graph for token");
    throw new HTTPError(401, "Not able to contact graph for token");
  }
};

/**
 *
 * @param {string} authHeader Authentication header
 */
module.exports = async (authHeader) => {
  // Input validation
  const bearerToken = authHeader;
  if (!bearerToken) throw new HTTPError(401, "authentication token missing");
  if (typeof bearerToken !== "string") throw new HTTPError(401, "authentication token is not a string");
  if (!bearerToken.startsWith("Bearer")) throw new HTTPError(401, "authentication token is not a Bearer token");

  const verifyConfig = {
    jwksUri: AZUREAD_TOKEN_CONFIG.jwksUri,
    issuer: AZUREAD_TOKEN_CONFIG.issuer,
    audience: AZUREAD_TOKEN_CONFIG.audience
  };

  // Validation
  let validatedToken;
  try {
    validatedToken = await verify(bearerToken.replace("Bearer ", ""), verifyConfig);
  } catch (err) {
    logger.errorException(err, "The token is invalid");
    throw new HTTPError(401, "The token is invalid");
  }

  if (!validatedToken) throw new HTTPError(401, "Could not validate authentication token");
  // if (!validatedToken.groups || validatedToken.groups.length === 0) throw new HTTPError(401, 'No groups could be found in authentication token')
  if (!validatedToken.roles || validatedToken.roles.length === 0) throw new HTTPError(401, "No roles could be found in authentication token");

  // Grab department with graph
  const accessToken = await getEntraToken();
  const url = `${GRAPH.GRAPH_URL}/users/${validatedToken.upn}?$select=department`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    logger.error("Failed to contact graph with Url {Url}. Status: {Status}: {StatusText}: {@ErrorData}", url, response.status, response.statusText, errorData);
    throw new HTTPError(response.status, "Not able to contact graph");
  }

  const data = await response.json();
  validatedToken.department = data?.department;

  if (!validatedToken.department) {
    logger.error("Could not find the company department in the authentication token for UPN {UPN}", validatedToken.upn);
    throw new HTTPError(401, "Could not find the users company department in the authentication token");
  }

  // If allowed groups/roles
  if (MS.AZUREAD_ALLOWEDGROUPS) {
    const allowedGroups = MS.AZUREAD_ALLOWEDGROUPS.split(",").filter((n) => n);
    let found = false;
    for (const userGroup of validatedToken.roles) {
      if (allowedGroups.includes(userGroup)) found = true;
    }
    if (!found) throw new HTTPError(401, "Your account is not a member of any allowed groups");
  }

  return validatedToken;
};
