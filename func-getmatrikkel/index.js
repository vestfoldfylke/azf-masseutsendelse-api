/*
  Import dependencies
*/
const axios = require('axios')
const HTTPError = require('../sharedcode/vtfk-errors/httperror')
const { MATRIKKEL } = require('../config')
const { azfHandleResponse, azfHandleError } = require('@vtfk/responsehandlers')
const getAccessToken = require('../sharedcode/helpers/get-entraid-token')

module.exports = async function (context, req) {
  try {
    // Authentication / Authorization
    await require('../sharedcode/auth/auth').auth(req)

    // Input validation
    if (!MATRIKKEL.MATRIKKEL_BASEURL) throw new HTTPError(400, 'The MatrikkelProxyAPI connection is not configured')
    if (!MATRIKKEL.MATRIKKEL_KEY) throw new HTTPError(400, 'The MatrikkelProxyAPI connection is missing the APIKey')

    let accessToken
    try {
      accessToken = await getAccessToken(MATRIKKEL.MATRIKKEL_SCOPE)
    } catch (error) {
      throw new HTTPError(400, 'Something went wrong fetching the accessToken')
    }

    // Get ID from request
    const endpoint = decodeURIComponent(context.bindingData.endpoint)

    const request = {
      method: 'post',
      url: `${MATRIKKEL.MATRIKKEL_BASEURL}/${endpoint}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-functions-key': MATRIKKEL.MATRIKKEL_KEY
      },
      data: req.body
    }

    const response = await axios.request(request)

    return await azfHandleResponse(response.data, context, req)
  } catch (err) {
    return await azfHandleError(err, context, req)
  }
}
