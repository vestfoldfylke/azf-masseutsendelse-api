const { ConfidentialClientApplication } = require('@azure/msal-node')
const NodeCache = require('node-cache')
const { logger } = require('@vtfk/logger')
const { ARCHIVE, MASSEUTSENDELSE, MATRIKKEL, MS, GRAPH } = require('../../config')

const cache = new NodeCache({ stdTTL: 3000 })

module.exports = async (scope, options = { forceNew: false }) => {
  const cacheKey = scope

  if (!options.forceNew && cache.get(cacheKey)) {
    logger('info', ['getGraphToken', 'found valid token in cache, will use that instead of fetching new'])
    return (cache.get(cacheKey))
  }

  logger('info', ['getGraphToken', 'no token in cache, fetching new from Microsoft'])
  let clientID
  let clientSecret
  if (scope === ARCHIVE.ARCHIVE_SCOPE) {
    logger('info', ['getGraphToken', `found matching scope, current scope: ${scope}`])
    clientID = MASSEUTSENDELSE.MASSEUTSENDELSE_APP_REG_CLIENT_ID
    clientSecret = MASSEUTSENDELSE.MASSEUTSENDELSE_APP_REG_CLIENT_SECRET
  } else if (scope === MATRIKKEL.MATRIKKEL_SCOPE) {
    logger('info', ['getGraphToken', `found matching scope, current scope: ${scope}`])
    clientID = MASSEUTSENDELSE.MASSEUTSENDELSE_APP_REG_CLIENT_ID
    clientSecret = MASSEUTSENDELSE.MASSEUTSENDELSE_APP_REG_CLIENT_SECRET
  } else if (scope === MASSEUTSENDELSE.MASSEUTSENDELSE_SCOPE) {
    logger('info', ['getGraphToken', `found matching scope, current scope ${scope}`])
    clientID = MATRIKKEL.MATRIKKEL_APP_REG_CLIENT_ID
    clientSecret = MATRIKKEL.MATRIKKEL_APP_REG_CLIENT_SECRET
  } else if (scope === GRAPH.GRAPH_SCOPE) {
    logger('info', ['getGraphToken', `found matching scope, current scope ${scope}`])
    clientID = MASSEUTSENDELSE.MASSEUTSENDELSE_APP_REG_CLIENT_ID
    clientSecret = MASSEUTSENDELSE.MASSEUTSENDELSE_APP_REG_CLIENT_SECRET
  } else {
    logger('error', ['getGraphToken', `didnt find any matching scope, current scope: ${scope}`])
  }

  const config = {
    auth: {
      clientId: clientID,
      authority: `https://login.microsoftonline.com/${MS.TENANT_ID}/`,
      clientSecret
    }
  }

  // Create msal application object
  const cca = new ConfidentialClientApplication(config)
  const clientCredentials = {
    scopes: [scope]
  }

  const token = await cca.acquireTokenByClientCredential(clientCredentials)
  const expires = Math.floor((token.expiresOn.getTime() - new Date()) / 1000)
  logger('info', ['getGraphToken', `Got token from Microsoft, expires in ${expires} seconds.`])
  cache.set(cacheKey, token.accessToken, expires)
  logger('info', ['getGraphToken', 'Token stored in cache'])

  return token.accessToken
}
