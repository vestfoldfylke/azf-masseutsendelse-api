const Dispatches = require('../sharedcode/models/dispatches.js')
const getDb = require('../sharedcode/connections/masseutsendelseDB.js')
const utils = require('@vtfk/utilities')
const { ObjectID } = require('mongodb')
const HTTPError = require('../sharedcode/vtfk-errors/httperror.js')
const validate = require('../sharedcode/validators/dispatches').validate
const blobClient = require('@vtfk/azure-blob-client')
const { STORAGE } = require('../config')
const { azfHandleResponse, azfHandleError } = require('@vtfk/responsehandlers')

module.exports = async function (context, req) {
  try {
    // Strip away som fields that should not bed set by the request.
    req.body = utils.removeKeys(req.body, ['validatedArchivenumber', 'createdTimestamp', 'createdBy', 'createdById', 'modifiedTimestamp', 'modifiedBy', 'modifiedById'])
    delete req.body._id // _id must be removed by it self to not remove template _id and other _ids as well

    // Authentication / Authorization
    const requestor = await require('../sharedcode/auth/auth').auth(req)

    // Set values
    req.body._id = new ObjectID()
    req.body.status = 'notapproved'

    req.body.createdBy = requestor.name
    req.body.createdById = requestor.id
    req.body.createdByEmail = requestor.email
    req.body.createdByDepartment = requestor.department
    req.body.modifiedById = requestor.id
    req.body.modifiedBy = requestor.name
    req.body.modifiedByEmail = requestor.email
    req.body.modifiedByDepartment = requestor.department

    // Validate dispatch against schenarios that cannot be described by schema
    await validate(req.body)
    req.body.validatedArchivenumber = req.body.archivenumber

    // Await the DB connection
    await getDb()

    // Check if the attachments contains any invalid characters
    if (process.env.NODE_ENV === 'test') {
      // For the jest testing
      console.log('This is a test, uploading to blob is skipped. Any code inside the else statement will not be tested!')
      if (req.body.attachments && Array.isArray(req.body.attachments) && req.body.attachments.length > 0) {
        if (!process.env.AZURE_BLOB_CONNECTIONSTRING_TEST || !process.env.AZURE_BLOB_CONTAINERNAME_TEST) {
          throw new HTTPError(500, 'Cannot upload attachments when azure blob storage is not configured')
        }
        for (const blob of req.body.attachments) {
          for (const char of blobClient.unallowedPathCharacters) {
            if (blob.name.includes(char)) throw new HTTPError(400, `${blob.name} contains the illegal character ${char}`)
          }
        }
      }
    } else {
      if (req.body.attachments && Array.isArray(req.body.attachments) && req.body.attachments.length > 0) {
        if (!STORAGE.AZURE_BLOB_CONNECTIONSTRING || !STORAGE.AZURE_BLOB_CONTAINERNAME) {
          throw new HTTPError(500, 'Cannot upload attachments when azure blob storage is not configured')
        }
        for (const blob of req.body.attachments) {
          for (const char of blobClient.unallowedPathCharacters) {
            if (blob.name.includes(char)) throw new HTTPError(400, `${blob.name} contains the illegal character ${char}`)
          }
        }
      }
    }

    // Create a new document using the model
    const dispatch = new Dispatches(req.body)

    // Save the new dispatch to the database
    const results = await dispatch.save()
    const allowedExtensions = ['pdf', 'xlsx', 'xls', 'rtf', 'msg', 'ppt', 'pptx', 'docx', 'doc', 'png', 'jpg', 'jpeg']

    // Upload files attached to the dispatch object if files exist.
    if (req.body.attachments || Array.isArray(req.body.attachments)) {
      for await (const file of req.body.attachments) {
        const split = file.name.split('.')
        if (split.length === 1) throw new HTTPError(400, 'All filenames must have an extension')
        const extension = split[split.length - 1]
        if (!allowedExtensions.includes(extension.toLowerCase())) throw new HTTPError(400, `The file extension ${extension} is not allowed`)

        if (file.name && file.name.includes('/')) throw new HTTPError(400, 'Illigal character in filname, "/" is not allowed.')
        if (!file.name) file.name = file._id

        if (process.env.NODE_ENV !== 'test') await blobClient.save(`${req.body._id}/${file.name}`, file.data)
      }
    }

    return await azfHandleResponse(results, context, req)
  } catch (err) {
    return await azfHandleError(err, context, req)
  }
}
