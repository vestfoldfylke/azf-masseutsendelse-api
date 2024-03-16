/*
  Import dependencies
*/
const { logger } = require('@vtfk/logger')
const { ARCHIVE } = require('../../config')
const { callArchive } = require('./call-archive')

/**
 * Attempt to get a case from P360
 * @param {string} casenumber The P360 casenumber to check if exists
 */
module.exports.getCase = async function getCase (casenumber) {
  // Input validation
  logger('info', ['checkCaseNumber', 'Validating input'])
  if (!casenumber) throw new Error('Archive casenumber cannot be empty')
  if (!ARCHIVE.ARCHIVE_ENDPOINT) throw new Error('Endpoint environment variable cannot be empty, checkcase')
  if (!ARCHIVE.ARCHIVE_SCOPE) throw new Error('Scope environment variable cannot be empty')

  // Build the payload
  const payload = {
    service: 'CaseService',
    method: 'GetCases',
    parameter: {
      CaseNumber: casenumber
    },
    options: {
      onlyOpenCases: true
    }
  }
  logger('info', ['checkCaseNumber', 'Checking if the casenumber exist and is open'])
  let data = await callArchive('archive', payload)

  // Handle and return the response
  logger('info', ['checkCaseNumber', 'Handle and return the response'])
  if (!data || !data) return undefined
  if (Array.isArray(data)) {
    if (data.length === 0) return undefined
    if (data.length > 1) throw new Error(`The casenumber ${casenumber} matched ${data.length} it must only match one`)
    data = data[0]
  }
  return data
}
