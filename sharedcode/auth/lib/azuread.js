const { verify } = require('azure-ad-verify-token')
const HTTPError = require('../../vtfk-errors/httperror')
const { AZUREAD_TOKEN_CONFIG, MS, GRAPH } = require('../../../config')
const { default: axios } = require('axios')
const getAccessToken = require('../../helpers/get-entraid-token')

/**
 *
 * @param {string} authHeader Authentication header
 */
module.exports = async (authHeader) => {
  // Input validation
  const bearerToken = authHeader
  if (!bearerToken) throw new HTTPError(401, 'authentication token missing')
  if (typeof bearerToken !== 'string') throw new HTTPError(401, 'authentication token is not a string')
  if (!bearerToken.startsWith('Bearer')) throw new HTTPError(401, 'authentication token is not a Bearer token')

  const verifyConfig = {
    jwksUri: AZUREAD_TOKEN_CONFIG.jwksUri,
    issuer: AZUREAD_TOKEN_CONFIG.issuer,
    audience: AZUREAD_TOKEN_CONFIG.audience
  }

  // Validation
  let validatedToken
  try {
    validatedToken = await verify(bearerToken.replace('Bearer ', ''), verifyConfig)
  } catch (err) {
    throw new HTTPError(401, 'The token is invalid')
  }

  if (!validatedToken) throw new HTTPError(401, 'Could not validate authentication token')
  if (!validatedToken.groups || validatedToken.groups.length === 0) throw new HTTPError(401, 'No groups could be found in authentication token')

  // Grab department with graph
  try {
    const accessToken = await getAccessToken(GRAPH.GRAPH_SCOPE)
    try {
      const res = await axios.get(`${GRAPH.GRAPH_URL}/users/${validatedToken.upn}?$select=department`, { headers: { Authorization: `Bearer ${accessToken}` } })
      validatedToken.department = res.data?.department
    } catch (error) {
      throw new HTTPError(401, 'Not able to contact graph')
    }
  } catch (error) {
    throw new HTTPError(401, 'Not able to contact graph')
  }

  if (!validatedToken.department) throw new HTTPError(401, 'Could not find the users company department in the authentication token')

  // If allowed groups
  if (MS.AZUREAD_ALLOWEDGROUPS) {
    const allowedGroups = MS.AZUREAD_ALLOWEDGROUPS.split(',').filter(n => n)
    let found = false
    for (const userGroup of validatedToken.groups) {
      if (allowedGroups.includes(userGroup)) found = true
    }
    if (!found) throw new HTTPError(401, 'Your account is not a member of any allowed groups')
  }

  return validatedToken
}
