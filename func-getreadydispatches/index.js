const Dispatches = require('../sharedcode/models/dispatches.js')
const getDb = require('../sharedcode/connections/masseutsendelseDB.js')
const HTTPError = require('../sharedcode/vtfk-errors/httperror')
const blobClient = require('@vtfk/azure-blob-client')
const axios = require('axios')
const config = require('../config')
const dayjs = require('dayjs')
const { azfHandleResponse, azfHandleError } = require('@vtfk/responsehandlers')
/*
  Might delete later ;)
*/
// Arrays
let e18Jobs = []
// Clear the e18Jobs Array
e18Jobs = []
module.exports = async function (context, req) {
  try {
    // Authentication / Authorization
    await require('../sharedcode/auth/auth').auth(req)

    // Await the DB connection
    await getDb()

    // Find all disptaches
    const dispatches = await Dispatches.find({ status: 'approved' })
    if (!dispatches || dispatches.length === 0) return context.res.send([])

    // Loop through all dispatches
    for (const dispatch of dispatches) {
      // Validate if the dispatch is ready
      if (!dispatch.approvedTimestamp) continue

      // Check if the dispatch has passed the registration threshold
      const registrationThreshold = dayjs(dispatch.approvedTimestamp).set('hour', 23).set('minute', 59).set('second', 59).set('millisecond', 0)
      const delaySendUntil = dayjs().set('hour', 11).set('minute', 0).set('second', 0).set('millisecond', 0)
      if (!config.BYPASS_REGISTRATION_THRESHOLD) {
        if (dayjs(new Date()).isBefore(registrationThreshold)) continue
      }

      // Variables
      const e18Files = [] // Stores all files that should be registrered to E18
      const e18Job = {
        system: 'masseutsendelse',
        projectId: 30,
        type: 'masseutsendelse',
        parallel: false,
        delayUntil: delaySendUntil.toISOString(),
        tasks: []
      }

      // Generate PDF from template, if applicable
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

        const generatePDFRequest = {
          url: config.PDFGENERATOR_ENDPOINT,
          method: 'post',
          headers: {
            'x-functions-key': config.PDFGENERATOR_X_FUNCTIONS_KEY
          },
          data: {
            template: dispatch.template.template,
            documentDefinitionId: dispatch.template.documentDefinitionId || 'brevmal',
            data
          }
        }

        // Generate PDF from template
        const legalFilename = dispatch.title.replace(/[/\\?%*:|"<>;¤]/g, '')
        const response = await axios.request(generatePDFRequest)
        if (response.data) e18Files.push({ title: legalFilename, format: 'pdf', versionFormat: 'A', base64: response.data.base64 })
        else throw new HTTPError(404, `Could not genereate PDF for dispatch ${dispatch.title}`)
      }

      // Retreive any attachments if applicable
      if (process.env.NODE_ENV !== 'test') {
        if (dispatch.attachments && Array.isArray(dispatch.attachments) && dispatch.attachments.length > 0) {
          for (const attachment of dispatch.attachments) {
            const file = await blobClient.get(`${dispatch._id}/${attachment.name}`)
            // Validate the files
            if (!file || !file.data || file.data.length === 0) throw new HTTPError(404, 'No files found, check if you passed the right filename and/or the right dispatchId')
            if (file.data.startsWith('data:') && file.data.includes(',')) file.data = file.data.substring(file.data.indexOf(',') + 1)
            if (file.name.includes('.')) file.name = file.name.substring(0, file.name.indexOf('.'))
            // Push it to the files array
            e18Files.push({ title: file.name, format: file.extension, base64: file.data })
          }
        }
      } else {
        e18Files.push({ title: 'test', format: '.txt', base64: 'base64' })
      }

      // Create the archive task
      const personArray = []
      const businessArray = []
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

      // Create tasks for create/update private persons
      personArray.forEach((person) => {
        e18Job.tasks.push({
          system: 'p360',
          method: 'SyncPrivatePerson',
          group: 'group2',
          dependencyTag: 'sync',
          data: person
        })
      })

      // Create tasks for creating/updated persons
      businessArray.forEach((business) => {
        e18Job.tasks.push({
          system: 'p360',
          method: 'SyncEnterprise',
          group: 'group2',
          dependencyTag: 'sync',
          data: business
        })
      })

      // Create the p360 caseDocument
      e18Job.tasks.push({
        system: 'p360',
        method: 'archive',
        dependencyTag: 'createCaseDocument',
        group: 'group1',
        dependencies: ['sync'],
        data: {
          system: 'masseutsendelse',
          template: 'utsendelsesdokument',
          parameter: {
            title: dispatch.title,
            caseNumber: dispatch.archivenumber,
            date: new Date().toISOString(),
            contacts: dispatch.owners.map((o) => { return { ssn: o.nummer, role: 'Mottaker' } }),
            attachments: [e18Files[0]],
            accessCode: 'U', // U = Alle
            accessGroup: 'Alle', // No access restriction
            paragraph: '', // No paragraph
            responsiblePersonEmail: dispatch.createdByEmail
          }
        }
      })

      if (e18Files.length > 1) {
        // Create one uploadDocuments-job pr. Attachment
        let fileIndex = -1
        for (const file of e18Files) {
          fileIndex++
          if (fileIndex === 0) continue

          e18Job.tasks.push({
            system: 'p360',
            method: 'archive',
            group: 'group3',
            dependencyTag: `uploadAttachment-${fileIndex}`,
            dependencies: fileIndex === 1 ? ['createCaseDocument'] : [`uploadAttachment-${fileIndex - 1}`],
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
      e18Job.tasks.push({
        system: 'p360',
        method: 'archive',
        group: 'group4',
        dependencies: [`uploadAttachment-${e18Files.length - 1}`],
        dataMapping: '{"parameter": { "Documents": [ { "DocumentNumber": "{{DocumentNumber}}" }]}}',
        data: {
          method: 'DispatchDocuments',
          service: 'DocumentService'
        }
      })

      // Add the job to the e18 jobs array
      e18Jobs.push({ _id: dispatch._id, e18Job })
    }

    return await azfHandleResponse(e18Jobs, context, req)
  } catch (err) {
    return await azfHandleError(err, context, req)
  }
}
