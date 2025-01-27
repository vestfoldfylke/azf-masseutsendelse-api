const Jobs = require('../sharedcode/models/jobs.js')
const Dispatches = require('../sharedcode/models/dispatches.js')
const getDb = require('../sharedcode/connections/masseutsendelseDB.js')
const HTTPError = require('../sharedcode/vtfk-errors/httperror.js')
const blobClient = require('@vtfk/azure-blob-client')
const { logger } = require('@vtfk/logger')
const { alertTeams } = require('../sharedcode/helpers/alertTeams.js')
const axios = require('axios')
const { MISC, PDFGENERATOR } = require('../config.js')
const dayjs = require('dayjs')
const { azfHandleResponse, azfHandleError } = require('@vtfk/responsehandlers')

module.exports = async function (context, req) {
  try {
    // Arrays
    let dispatchJobs = []
    // Clear the dispatchJobs Array
    dispatchJobs = []

    // Await the DB connection
    logger('info', 'Connecting to DB')
    await getDb()

    // Find all disptaches
    logger('info', 'Looking for jobs to handle')
    const d = await Dispatches.findOne({ status: 'approved' })
    if (d === null) {
      logger('info', 'No jobs found')
      return context.res.send([])
    }
    const dispatches = []
    dispatches.push(await d)
    if (!dispatches || dispatches.length === 0) return context.res.send([])

    // Loop through all dispatches
    for (const dispatch of dispatches) {
      // Validate if the dispatch is ready
      logger('info', 'Found a job to handle, checking if it has passed the registration threshold')
      if (!dispatch.approvedTimestamp) continue

      // Check if the dispatch has passed the registration threshold
      const registrationThreshold = dayjs(dispatch.approvedTimestamp).set('hour', 23).set('minute', 59).set('second', 59).set('millisecond', 0)
      const delaySendUntil = dayjs().set('hour', 11).set('minute', 0).set('second', 0).set('millisecond', 0)
      if (!MISC.BYPASS_REGISTRATION_THRESHOLD) {
        logger('info', 'Buypassing registartion threshold')
        if (dayjs(new Date()).isBefore(registrationThreshold)) continue
      }
      // Variables
      const dispatchFiles = [] // Stores all files that should be registrered to the job
      const dispatchJob = {
        title: dispatch.title,
        approvedTimeStamp: dispatch.approvedTimestamp,
        delayUntil: delaySendUntil.toISOString(),
        status: {
          syncRecipients: 'waiting',
          uploadAttachments: 'waiting',
          createCaseDocument: 'waiting',
          issueDispatch: 'waiting',
          createStatistics: 'waiting'
        },
        tasks: {
          syncRecipients: [],
          uploadAttachments: [],
          createCaseDocument: [],
          issueDispatch: [],
          createStatistics: ''
        }
      }
      // Generate PDF from template, if applicable
      logger('info', 'Generating PDF from template if a template was used in the dispatch (brevmal)')
      if (dispatch.template?.template) {
        let data = {}
        if (dispatch.template.data) {
          data = dispatch.template.data
        }
        if (dispatch.attachments && Array.isArray(dispatch.attachments) && dispatch.attachments.length > 0) data.attachments = dispatch.attachments
        data.info = {
          sector: dispatch.createdByDepartment,
          'our-reference': dispatch.archivenumber,
          'our-caseworker': dispatch.createdBy
        }
        logger('info', 'Creating the request')
        const generatePDFRequest = {
          url: PDFGENERATOR.PDFGENERATOR_ENDPOINT,
          method: 'post',
          headers: {
            'x-functions-key': PDFGENERATOR.PDFGENERATOR_X_FUNCTIONS_KEY
          },
          data: {
            template: dispatch.template.template,
            documentDefinitionId: dispatch.template.documentDefinitionId || 'brevmal',
            data
          }
        }
        // Generate PDF from template
        const legalFilename = dispatch.title.replace(/[/\\?%*:|"<>;¤]/g, '')
        logger('info', 'Making the request to the PDF api')
        const response = await axios.request(generatePDFRequest)
        if (response.data) {
          logger('info', `Successfully created a pdf from the template: ${legalFilename}`)
          dispatchFiles.push({ title: legalFilename, format: 'pdf', versionFormat: 'A', base64: response.data.base64 })
        } else {
          logger('info', `Failed to create a pdf from the template: ${legalFilename}`)
          throw new HTTPError(404, `Could not genereate PDF for dispatch ${dispatch.title}`)
        }
      }
      // Retreive any attachments if applicable
      if (process.env.NODE_ENV !== 'test') {
        logger('info', 'Retriving the attachments if any attachments was added')
        if (dispatch.attachments && Array.isArray(dispatch.attachments) && dispatch.attachments.length > 0) {
          logger('info', 'Attachments found')
          for (const attachment of dispatch.attachments) {
            logger('info', `Fetching the attachment: ${attachment.name} from the blob storage`)
            const file = await blobClient.get(`${dispatch._id}/${attachment.name}`)
            // Validate the files
            if (!file || !file.data || file.data.length === 0) {
              logger('error', 'No files found, check if you passed the right filename and/or the right dispatchId')
              throw new HTTPError(404, 'No files found, check if you passed the right filename and/or the right dispatchId')
            }
            logger('info', `Successfully fetched the attachment: ${attachment.name} from the blob storage, validating the file.`)
            if (file.data.startsWith('data:') && file.data.includes(',')) file.data = file.data.substring(file.data.indexOf(',') + 1)
            if (file.name.includes('.')) file.name = file.name.substring(0, file.name.indexOf('.'))
            logger('info', `Attachment: ${attachment.name} is valid, pushing it to the file array.`)
            // Push it to the files array
            dispatchFiles.push({ title: file.name, format: file.extension, base64: file.data })
          }
        }
      } else {
        logger('info', 'Currently in test, will not look for attachments')
        dispatchFiles.push({ title: 'test', format: '.txt', base64: 'base64' })
      }
      // Create the archive task
      const personArray = []
      const businessArray = []
      logger('info', `Creating the archive task, for dispatchID: ${dispatch._id}`)
      for (const owner of dispatch.owners) {
        if (owner._type.toLowerCase().includes('juridisk')) {
          businessArray.push({
            orgnr: owner.nummer
          })
        } else {
          personArray.push({
            ssn: owner.nummer
          })
        }
      }
      logger('info', `Creating the task to sync recipients in archive, for dispatchID: ${dispatch._id}`)
      // Create tasks for create/update private persons
      personArray.forEach((person) => {
        dispatchJob.tasks.syncRecipients.push({
          method: 'SyncPrivatePerson',
          rety: 0,
          status: 'waiting',
          ssn: person.ssn
        })
      })
      // Create tasks for creating/updated persons
      businessArray.forEach((business) => {
        dispatchJob.tasks.syncRecipients.push({
          method: 'SyncEnterprise',
          retry: 0,
          status: 'waiting',
          ssn: business.orgnr
        })
      })
      logger('info', `Creating the archive caseDocument task, for dispatchID: ${dispatch._id}`)
      // Create the p360 caseDocument
      dispatchJob.tasks.createCaseDocument.push({
        method: 'archive',
        data: {
          system: 'masseutsendelse',
          template: 'utsendelsesdokument',
          parameter: {
            title: dispatch.title,
            caseNumber: dispatch.archivenumber,
            date: new Date().toISOString(),
            contacts: dispatch.owners.map((o) => { return { ssn: o.nummer, role: 'Mottaker' } }),
            attachments: [dispatchFiles[0]],
            accessCode: 'U', // U = Alle
            accessGroup: 'Alle', // No access restriction
            paragraph: '', // No paragraph
            responsiblePersonEmail: dispatch.createdByEmail
          }
        }
      })
      if (dispatchFiles.length > 1) {
        // Create one uploadDocuments-job pr. Attachment
        let fileIndex = -1
        for (const file of dispatchFiles) {
          logger('info', `Creating the archive uploadDocuments task, for attachment: ${file.title} with dispatchID: ${dispatch._id}`)
          fileIndex++
          if (fileIndex === 0) continue
          dispatchJob.tasks.uploadAttachments.push({
            dataMapping: 'parameter.documentNumber=DocumentNumber',
            data: {
              system: 'archive',
              template: 'add-attachment',
              parameter: {
                secure: false,
                title: file.title,
                format: file.format,
                base64: file.base64,
                versionFormat: 'P'
              }
            }
          })
        }
      }

      // Create task to sendt to each contact
      logger('info', `Creating the archive issueDispatch task, for dispatchID: ${dispatch._id}`)
      dispatchJob.tasks.issueDispatch.push({
        dataMapping: '{"parameter": { "Documents": [ { "DocumentNumber": "{{DocumentNumber}}" }]}}',
        data: {
          method: 'DispatchDocuments',
          service: 'DocumentService'
        }
      })
      // Add the job to the jobs array
      dispatchJobs.push({ _id: dispatch._id, ...dispatchJob })
    }
    let updatedDispatch = {}
    if (dispatchJobs.length > 0) {
      logger('info', 'Creating a new job and saving it to the Jobs collection')
      const job = new Jobs(...dispatchJobs)
      // Save the new dispatch to the database
      await job.save()
      logger('info', `Successfully saved the job to the Jobs collection with the id: ${job._id}`)
      // Set dispatch to completed and wipe data that is not needed.
      const filter = { _id: job._id }
      const update = {
        status: 'completed',
        owners: [],
        excludedOwners: [],
        matrikkelUnitsWithoutOwners: []
      }
      logger('info', `Updating and wiping the dispatch with id: ${job._id} for personal information`)
      updatedDispatch = await Dispatches.findOneAndUpdate(filter, update, {
        new: true
      })
      logger('info', `Successfully updated the dispatch with id: ${job._id}`)
      await alertTeams([], 'completed', [], 'Jobs have now been created for the dispatch, everything went well', job._id, context.executionContext.functionName)
    }
    return await azfHandleResponse(updatedDispatch, context, req)
  } catch (err) {
    await alertTeams(err, 'error', 'func-getreadydispatchesV2 failed', [], 'no id found', context.executionContext.functionName)
    return await azfHandleError(err, context, req)
  }
}
