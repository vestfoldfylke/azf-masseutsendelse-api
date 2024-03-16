/*
  Import dependencies
*/
const { ARCHIVE } = require('../../config')
const { callArchive } = require('./call-archive')
const { logger } = require('@vtfk/logger')

/**
 * Attempt to get a case from P360
 * @param {string} casenumber The P360 casenumber to check if exists
 */
const syncRecipient = async (number, method) => {
  // Input validation
  logger('info', ['syncPrivatePerson', 'Validating input'])
  if (!number) throw new Error('SSN cannot be empty')
  if (!method) throw new Error('Method cannot be empty')
  if (!ARCHIVE.ARCHIVE_ENDPOINT) throw new Error('Endpoint environment variable cannot be empty, sync recipient')
  if (!ARCHIVE.ARCHIVE_SCOPE) throw new Error('Scope environment variable cannot be empty')

  // Make the request
  let data
  if (method === 'SyncPrivatePerson') {
    logger('info', ['syncPrivatePerson', 'Syncing private person'])
    data = await callArchive(method, { ssn: number })
  } else {
    logger('info', ['syncEnterprise', 'Syncing enterprise person'])
    data = await callArchive(method, { orgnr: number })
  }

  // Handle and return the response
  logger('info', ['syncPrivatePerson', 'Handle and return the response'])
  if (data.status !== 200) return data[0]
  if (!data) return undefined
  if (Array.isArray(data)) {
    if (data.length === 0) return undefined
    if (data.length > 1) return data[0]
    data = data[0]
  }
  return data
}

const addAttachment = async (method, documentNumber, base64, format, title) => {
  // Input validation
  logger('info', ['addAttachment', 'Validating input'])
  if (!title) throw new Error('title cannot be empty')
  if (!method) throw new Error('Method cannot be empty')
  if (!base64) throw new Error('base64 cannot be empty')
  if (!format) throw new Error('format cannot be empty')
  if (!documentNumber) throw new Error('DocumentNumber cannot be empty')
  if (!ARCHIVE.ARCHIVE_ENDPOINT) throw new Error('Endpoint environment variable cannot be empty, add attachment')
  if (!ARCHIVE.ARCHIVE_SCOPE) throw new Error('Scope environment variable cannot be empty')

  // Build the payload
  const payload = {
    system: 'archive', // NB! Denne referere til hvilken system template som skal brukes "archive-add-attachment", se https://github.com/vtfk/azf-archive/tree/master/templates
    template: 'add-attachment',
    parameter: {
      documentNumber,
      base64,
      format,
      title,
      versionFormat: 'P'
    }
  }

  logger('info', ['addAttachment', 'Adding attachment'])
  let data = await callArchive(method, payload)

  // Handle and return the response
  logger('info', ['addAttachment', 'Handle and return the response'])
  if (!data) return undefined
  if (Array.isArray(data)) {
    if (data.length === 0) return undefined
    if (data.length > 1) throw new Error(`Was not able to add attachment with the title ${title}`)
    data = data[0]
  }
  return data
}

const createCaseDocument = async (method, title, caseNumber, date, contacts, attachments, paragraph, responsiblePersonEmail) => {
  // Input validation
  logger('info', ['createCaseDocument', 'Validating input'])
  if (!method) throw new Error('Method cannot be empty')
  if (!title) throw new Error('title cannot be empty')
  if (!caseNumber) throw new Error('caseNumber cannot be empty')
  if (!date) throw new Error('date cannot be empty')
  if (!contacts) throw new Error('contacts cannot be empty')
  if (!responsiblePersonEmail) throw new Error('responsiblePersonEmail cannot be empty')
  if (!ARCHIVE.ARCHIVE_ENDPOINT) throw new Error('Endpoint environment variable cannot be empty, create case doc')
  if (!ARCHIVE.ARCHIVE_SCOPE) throw new Error('Scope environment variable cannot be empty')

  // Build the payload
  const payload = {
    system: 'masseutsendelse',
    template: 'utsendelsesdokument',
    parameter: {
      title,
      caseNumber,
      date, // dato prosjektet ble opprettet i masseutsendelse
      contacts, // An array of contacts
      attachments, // An array of attachments
      accessCode: 'U',
      accessGroup: 'Alle',
      paragraph,
      responsiblePersonEmail
    }
  }
  logger('info', ['createCaseDocument', 'Creating the casedocument'])
  let data = await callArchive(method, payload)

  // Handle and return the response
  logger('info', ['createCaseDocument', 'Handle and return the response'])
  if (!data) return undefined
  if (Array.isArray(data)) {
    if (data.length === 0) return undefined
    if (data.length > 1) throw new Error(`Was not able to create the case with the title: ${title}`)
    data = data[0]
  }
  return data
}

const dispatchDocuments = async (documents, method) => {
  // Input validation
  logger('info', ['dispatchDocuments', 'Validating input'])
  if (!documents) throw new Error('Documents cannot be empty')
  if (documents.length < 0) throw new Error('Documents array must contain minimum one document')
  if (!ARCHIVE.ARCHIVE_ENDPOINT) throw new Error('Endpoint environment variable cannot be empty, dispatch doc')
  if (!ARCHIVE.ARCHIVE_SCOPE) throw new Error('Scope environment variable cannot be empty')

  // Build the payload
  const payload = {
    service: 'DocumentService',
    method: 'DispatchDocuments',
    parameter: {
      Documents: [{
        DocumentNumber: documents[0]
      }]
    }
  }

  logger('info', ['dispatchDocuments', 'Dispatching documents'])
  let data = await callArchive(method, payload)
  // Handle and return the response
  logger('info', ['dispatchDocuments', 'Handle and return the response'])
  if (!data) return undefined
  if (Array.isArray(data)) {
    if (data[0].Successful !== true) throw new Error(`Was not able to dispatch the documents: ${documents}`)
    data = data[0]
  }
  return data
}

module.exports = {
  syncRecipient,
  addAttachment,
  createCaseDocument,
  dispatchDocuments
}
