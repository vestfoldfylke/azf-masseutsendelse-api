/*
  Import dependencies
*/
const { STATISTICS } = require('../../config')
const axios = require('axios')
const createStatistics = async (department, id, privatepersons, enterprises) => {
  // Build the request
  const request = {
    method: 'post',
    url: STATISTICS.STATISTICS_URL + '/stats',
    headers: {
      'x-functions-key': STATISTICS.STATISTICS_KEY
    },
    data: {
      system: 'Masseutsendelse',
      engine: 'azf-masseutsendelse-api',
      company: 'SMM',
      department,
      description: 'Viser antall bedrifer og privatpersoner som er varslet.',
      externalId: id,
      privatepersons,
      enterprises,
      type: 'SMM - Masseutsendelse'
      // Optional fields
    }
  }

  // Make the request
  const response = await axios.request(request)
  // Handle and return the response
  if (!response || !response.data) return undefined
  if (Array.isArray(response.data)) {
    if (response.data.length === 0) return undefined
    if (response.data.length > 1) throw new Error('Was not able to create statistics')
    response.data = response.data[0]
  }
  return response.data
}

module.exports = {
  createStatistics
}
