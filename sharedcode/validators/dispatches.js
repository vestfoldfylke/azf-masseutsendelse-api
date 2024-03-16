/*
  Import dependencies
*/
const HTTPError = require('../vtfk-errors/httperror')
const { getCase } = require('../helpers/checkP360Case')

/*
  Validator function
*/
module.exports.validate = async (dispatch, req) => {
  // Validate that the dispatch is defined
  if (!dispatch) throw new HTTPError('400', 'No dispatch object was provided')

  // Validate that the dispatch has a template and/or attachments
  if ((!dispatch.attachments || dispatch.attachments.length === 0) && (!dispatch.template || Object.keys(dispatch.template).length === 0)) throw new HTTPError('400', 'Template OR Attachments must be provided')
  if (!dispatch.template && dispatch.attachments && Array.isArray(dispatch.attachments) && dispatch.attachments.length <= 0) throw new HTTPError('400', 'Attachments cannot be empty when there is no template')

  // Validate that the provided archivenumber exists in P360
  if (!dispatch.archivenumber) throw new HTTPError('400', 'No archivenumber has been provided')
  if (dispatch.archivenumber !== dispatch.validatedArchivenumber) {
    try {
      const p360Case = await getCase(dispatch.archivenumber)
      if (!p360Case) throw new HTTPError('400', 'Could not find a valid case in the archive system')
      if (p360Case.URL) dispatch.archiveUrl = p360Case.URL
    } catch (err) {
      throw new HTTPError(500, `Something went wrong contacting the archive: ${err.message}`, 'Problem contacting the archive')
    }
  }
}
