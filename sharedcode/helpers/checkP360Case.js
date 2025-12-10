/*
  Import dependencies
*/
const { logger } = require("@vestfoldfylke/loglady");
const { ARCHIVE } = require("../../config");
const { callArchive } = require("./call-archive");

/**
 * Attempt to get a case from P360
 * @param {string} caseNumber The P360 case number to check if exists
 */
module.exports.getCase = async function getCase(caseNumber) {
  // Input validation
  logger.info("Validating input");
  if (!caseNumber) throw new Error("Archive case number cannot be empty");
  if (!ARCHIVE.ARCHIVE_ENDPOINT) throw new Error("Endpoint environment variable cannot be empty, check case");
  if (!ARCHIVE.ARCHIVE_SCOPE) throw new Error("Scope environment variable cannot be empty");

  // Build the payload
  const payload = {
    service: "CaseService",
    method: "GetCases",
    parameter: {
      CaseNumber: caseNumber
    },
    options: {
      onlyOpenCases: true
    }
  };
  logger.info("Checking if the case number exist and is open");
  let data = await callArchive("archive", payload);

  // Handle and return the response
  logger.info("Handle and return the response");
  if (!data || !data) return undefined;
  if (Array.isArray(data)) {
    if (data.length === 0) return undefined;
    if (data.length > 1) throw new Error(`The case number ${caseNumber} matched ${data.length} it must only match one`);
    data = data[0];
  }
  return data;
};
