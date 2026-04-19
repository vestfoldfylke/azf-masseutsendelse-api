const { before, after } = require("node:test");
const dbMem = require("./Memory-DB");

module.exports = {
  setupDB() {
    before(async () => {
      await dbMem.connect();
    });

    after(async () => {
      await dbMem.closeDatabase();
    });
  }
};
