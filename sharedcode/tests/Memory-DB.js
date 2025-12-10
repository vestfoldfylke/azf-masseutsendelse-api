const mongoose = require("mongoose");
const MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;

let mongodb;
/**
 * Connect to the in-memory database.
 */
module.exports.connect = async () => {
  mongodb = await MongoMemoryServer.create();
  const uri = mongodb.getUri();
  process.env.URI = uri;
  await mongoose.connect(uri);
};
/**
 * Drop database, close the connection and stop mongodb.
 */
module.exports.closeDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongodb.stop();
};
/**
 * Remove all the data for all db collections.
 */
module.exports.clearDatabase = async () => {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
};
