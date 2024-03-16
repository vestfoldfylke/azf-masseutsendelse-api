/*
  Import dependencies
*/
const azuread = require('./lib/azuread')
/*
  Auth function
*/
/**
 * Auth's the request
 * @param {object} req Azure function request
 * @returns
 */
async function auth (req) {
  const requestor = {}
  if (req.headers.authorization) {
    const token = await azuread(req.headers.authorization)
    if (token && token.name) requestor.name = token.name
    if (token && token.oid) requestor.id = token.oid
    // Department is fetched with graph, not from access or id token from auth process.
    if (token && token.department) requestor.department = token.department
    if (token && token.upn) requestor.email = token.upn
  } else {
    requestor.name = 'timetrigger'
    requestor.id = 'timetrigger'
    requestor.department = 'timetrigger'
    requestor.email = 'timetrigger@telemarkfylke.no'
  }
  return requestor
}

module.exports.auth = auth
