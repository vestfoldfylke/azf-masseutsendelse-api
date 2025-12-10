const { app } = require("@azure/functions");
const { handleJobs } = require("../sharedcode/funcs/handleJobs");

const getHandleJobs = async (_req, context) => {
  return await handleJobs(context, "auto");
};

app.timer("getHandleJobsTimer", {
  schedule: "0 */10 * * * *", // Every 10 minutes
  handler: getHandleJobs
});
