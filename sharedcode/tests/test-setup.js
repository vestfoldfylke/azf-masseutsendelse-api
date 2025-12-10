const dbMem = require("./Memory-DB");

module.exports = {
  setupDB() {
    // Connect to the memory DB
    beforeAll(async () => {
      await dbMem.connect();
    });

    // Clear DB & Disconnect from the memory DB
    afterAll(async () => {
      await dbMem.closeDatabase();
    });
  }
};
