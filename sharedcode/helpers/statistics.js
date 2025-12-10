/*
  Import dependencies
*/
const { logger } = require("@vestfoldfylke/loglady");
const { STATISTICS } = require("../../config");

const createStatistics = async (department, id, privatepersons, enterprises) => {
  // Build the request
  const payload = {
    system: "Masseutsendelse",
    engine: "azf-masseutsendelse-api",
    company: "SMM",
    department,
    description: "Viser antall bedrifter og privatpersoner som er varslet.",
    externalId: id,
    privatepersons,
    enterprises,
    type: "SMM - Masseutsendelse"
    // Optional fields
  };

  // Make the request
  const response = await fetch(`${STATISTICS.STATISTICS_URL}/stats`, {
    method: "POST",
    headers: {
      "x-functions-key": STATISTICS.STATISTICS_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    logger.error("Failed to insert statistics. Status: {Status}: {StatusText}: {@ErrorData}", response.status, response.statusText, errorData);
    return undefined;
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return data;
  }

  if (data.length === 0) {
    return undefined;
  }

  if (data.length > 1) {
    logger.error("Failed to insert statistics");
    throw new Error("Was not able to create statistics");
  }

  return data[0];
};

module.exports = {
  createStatistics
};
