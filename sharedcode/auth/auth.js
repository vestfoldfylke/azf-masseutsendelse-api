const azureAd = require("./lib/azuread");
/*
  Auth function
*/
/**
 * Auth's the request
 * @param {object} req Azure function request
 * @returns
 */
async function auth(req) {
  const authValue = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authValue) {
    if (process.env.NODE_ENV?.toLowerCase() !== "test") {
      throw new Error("No authorization header was provided");
    }

    // Return a default timetrigger user in test mode since no auth header is provided
    return {
      name: "timetrigger",
      id: "timetrigger",
      department: "timetrigger",
      email: "timetrigger@telemarkfylke.no"
    };
  }

  const token = await azureAd(authValue);
  if (!token) {
    return {};
  }

  const requestor = {};
  if (token.name) {
    requestor.name = token.name;
  }
  if (token.oid) {
    requestor.id = token.oid;
  }
  // Department is fetched with graph, not from access or id token from auth process.
  if (token.department) {
    requestor.department = token.department;
  }
  if (token.upn) {
    requestor.email = token.upn;
  }

  return requestor;
}

module.exports.auth = auth;
