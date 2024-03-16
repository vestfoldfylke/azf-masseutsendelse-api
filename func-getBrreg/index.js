const { azfHandleResponse, azfHandleError } = require('@vtfk/responsehandlers')
const axios = require('axios')
const HTTPError = require('../sharedcode/vtfk-errors/httperror')

module.exports = async function (context, req) {
  try {
    // Authentication / Authorization
    await require('../sharedcode/auth/auth').auth(req)

    // Get ID from request
    const id = context.bindingData.id
    if (!id) throw new HTTPError(400, 'No dispatch id was provided')

    // Make the request
    const response = await axios.get(`https://data.brreg.no/enhetsregisteret/api/enheter/${id}`)

    // Return the brreg info
    return await azfHandleResponse(response.data, context, req)
  } catch (err) {
    return await azfHandleError(err, context, req)
  }
}
