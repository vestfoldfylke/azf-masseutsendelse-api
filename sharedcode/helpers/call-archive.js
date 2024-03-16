const axios = require('axios').default
const { ARCHIVE } = require('../../config')
const getAccessToken = require('./get-entraid-token')

module.exports.callArchive = async (endpoint, payload) => {
  const accessToken = await getAccessToken(ARCHIVE.ARCHIVE_SCOPE)
  const { data } = await axios.post(`${ARCHIVE.ARCHIVE_ENDPOINT}/${endpoint}`, payload, { headers: { Authorization: `Bearer ${accessToken}` } })
  return data
}
