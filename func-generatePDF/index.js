const { default: axios } = require('axios')
const { PDFGENERATOR } = require('../config')
const { azfHandleError, azfHandleResponse } = require('@vtfk/responsehandlers')
const HTTPError = require('../sharedcode/vtfk-errors/httperror')

module.exports = async function (context, req) {
  try {
    // Get datt from request and validate
    const preview = context.bindingData.preview
    const template = context.bindingData.template
    const documentDefinitionId = context.bindingData.documentDefinitionId
    const data = context.bindingData.data

    if (!preview) throw new HTTPError(400, 'Preview must provided')
    if (!template) throw new HTTPError(400, 'Template must be provided')
    if (!documentDefinitionId) throw new HTTPError(400, 'DocumentDefinitionId must be provided')
    if (!data) throw new HTTPError(400, 'Data must be provided')

    // Build request
    const requestData = {
      preview,
      template,
      documentDefinitionId,
      data
    }

    // Define headers
    const headers = {
      'x-functions-key': PDFGENERATOR.PDFGENERATOR_X_FUNCTIONS_KEY
    }

    // Make the request
    const request = await axios.post(PDFGENERATOR.PDFGENERATOR_ENDPOINT, requestData, { headers })

    return await azfHandleResponse(request.data, context, req, 200)
  } catch (error) {
    return await azfHandleError(error, context, req)
  }
}
