const { logger } = require("@vestfoldfylke/loglady");
const mongoose = require("mongoose");
const uri = process.env.MONGODB_CONNECTIONSTRING;

module.exports = async () => {
  if (mongoose.connection.readyState === 1) return;
  try {
    const client = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000
    });
    Promise.resolve(client);
  } catch (err) {
    logger.errorException(err, "Failed to connect to masseutsendelse database");
    Promise.reject(err);
  }
};
