// Models
const Jobs = require("../models/jobs.js");
const Dispatches = require("../models/dispatches.js");

const { logger } = require("@vestfoldfylke/loglady");
const mongoose = require("mongoose");
const getDb = require("../connections/masseutsendelseDB.js");
const { alertTeams } = require("../helpers/alertTeams.js");
const { syncRecipient, createCaseDocument, addAttachment, dispatchDocuments } = require("../helpers/archive.js");
const { createStatistics } = require("../helpers/statistics.js");
const { errorResponse, response } = require("../response/response-handler");

const handleJobs = async (context, runStatus) => {
  let jobId;
  try {
    // Await the DB connection
    logger.info("Connecting to DB");
    await getDb();

    // Find the jobs
    logger.info("Looking for jobs to handle");
    const jobs = await Jobs.findOne({
      $or: [
        { "status.syncRecipients": "waiting" },
        { "status.createCaseDocument": "waiting" },
        { "status.uploadAttachments": "waiting" },
        { "status.issueDispatch": "waiting" },
        { "status.createStatistics": "waiting" },
        { "status.syncRecipients": "inprogress" },
        { "status.createCaseDocument": "inprogress" },
        { "status.uploadAttachments": "inprogress" },
        { "status.issueDispatch": "inprogress" },
        { "status.createStatistics": "inprogress" }
      ]
    });
    // Handle if no jobs.
    if (!jobs) {
      logger.info("No jobs found to handle, exit");
      // await alertTeams([], 'completed', [] , 'job', context.functionName)
      // error: any, color: any, failedTask: any, completedJob: any, jobId: any, endpoint: any
      // await alertTeams({error: 'noe gikk galt!!!'}, 'error', 'failed task' , [], undefined, context.functionName)
      // await alertTeams({error: 'noe gikk galt!!!'}, 'error', 'funcgetandlejobsDev failed', [], 'no id found', context.functionName)
      // await alertTeams({}, 'completed', {}, 'This job is done', 'et endpoint') Dette er ikke teams webhook glad i
      return response("No jobs found");
    }

    const taskArr = [];
    const failedJobsArr = [];
    let stopHandling = false;

    jobId = jobs._id.toString();
    const jobIdObj = new mongoose.Types.ObjectId(jobId);
    logger.info("Found a job with id: {JobId}", jobId);
    logger.info("Checking the job status");
    for (const job in jobs.status) {
      if (!Object.hasOwn(jobs.status, job)) {
        continue;
      }

      const status = jobs.status[job];
      // Check if any jobs have failed
      if (status === "failed") {
        if (job === "syncRecipients" || job === "createCaseDocument" || job === "uploadAttachments" || job === "issueDispatch") {
          logger.info("The job: {Job} have status failed.", job);
          stopHandling = true;
        }
        const failedJobsObj = { [job]: jobs.tasks[job] };
        for (const task of failedJobsObj[job]) {
          if (task.status === "failed") {
            failedJobsArr.push({ [job]: task });
          }
        }
        // Update the job with the failed tasks
        logger.info("Updating the failedJobs array for JobId {JobId}", jobId);
        try {
          const filter = { _id: jobId };
          const update = {
            $push: {
              failedTasks: failedJobsArr
            }
          };
          await Jobs.findOneAndUpdate(filter, update, {
            new: true,
            upsert: true
          });
          logger.info("The failedJobs array for JobId {JobId} have been updated", jobId);
          logger.error("The job: {Job} with mongoDB id: {JobId} have failed 7 times and the whole job is stopped!", job, jobId);
          await alertTeams("Job failed 7 times, please look at it!", "error", failedJobsArr, [], context.functionName);
        } catch (error) {
          await alertTeams(JSON.stringify(error), "error", "pushing failed job to mongodb", [], jobId, context.functionName);
          logger.errorException(error, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
          return errorResponse(error, "Failed pushing the failed job to mongodb", 400);
        }
      }
      // Find the job
      if (status === "waiting" || status === "inprogress") {
        if (((job === "createCaseDocument" || job === "issueDispatch" || job === "uploadAttachments") && stopHandling === true) || (job === "issueDispatch" && stopHandling === true)) {
          logger.error("The job: {Job} with mongoDB id: {JobId} cannot be handled because StopHandling is true ({StopHandling})", job, jobId, stopHandling);
          await alertTeams(
            `Current job: ${job} and stopHandling is: ${stopHandling}. DispatchID: ${jobId}. You need to look into it!`,
            "error",
            `${job} cannot be handled because StopHandling is true`,
            [],
            jobId,
            context.functionName
          );
        } else {
          const jobsObj = { [job]: jobs.tasks[job] };
          logger.info("Pushing task to the task array for Job: {@Job}", job);
          taskArr.push(jobsObj);
        }
      }
    }

    // Håndter den første jobben, sett den til completed om alt gikk bra. Kjør på nytt om 5min.
    const currentJob = Object.keys(taskArr[0]);
    for (const job in currentJob) {
      if (!Object.hasOwn(currentJob, job)) {
        continue;
      }

      const jobToHandle = currentJob[job];
      logger.info("Current Job: {JobToHandle}", jobToHandle);
      if (jobToHandle === "syncRecipients") {
        // Handle the job
        try {
          let currentTasks = Object.values(taskArr[0]);
          currentTasks = Object.assign([], ...currentTasks);
          const updatedTask = [];
          let numbOfFailedTasks = 0;
          logger.info("Checking each task of currentTask");
          for (const task of currentTasks) {
            const ssn = task.ssn;
            const method = task.method;
            const doc = await Jobs.findOne({ _id: jobId });
            if (!doc) {
              logger.error("Current Job: {JobToHandle}, no job document found.", jobToHandle);
              throw new Error("Document not found");
            }

            const currentTaskIndex = doc.tasks.syncRecipients.findIndex((task) => task.ssn === ssn);
            logger.info("Working with task with index: {CurrentTaskIndex}.", currentTaskIndex);
            if (task.status === "waiting" || task.status === "inprogress" || task.status === "failed") {
              if (task.status === "failed" && task.retry === 7) {
                logger.error("The task with index: {CurrentTaskIndex} have failed {TaskRetry} times. Whole job is set to failed", currentTaskIndex, task.retry);
                const filter = { _id: jobId };
                const update = {
                  "status.syncRecipients": "failed"
                };
                await Jobs.findOneAndUpdate(filter, update, {
                  new: true
                });
              }
              try {
                logger.info("Syncing recipient using: {Method}", method);
                const res = await syncRecipient(ssn, method);
                logger.info("Recipient synced");
                if (currentTaskIndex !== -1) {
                  if (doc.tasks.syncRecipients[currentTaskIndex].status === "completed") {
                    // Push completed tasks to the updatedTask array.
                    updatedTask.push(doc.tasks.syncRecipients[currentTaskIndex]);
                  } else {
                    doc.tasks.syncRecipients[currentTaskIndex].status = "completed";
                    const data = Object.assign({}, doc.tasks.syncRecipients[currentTaskIndex], { res });
                    // Update the correct object with status "completed" and with the data.
                    updatedTask.push(data);
                  }
                } else {
                  logger.error("Failed Syncing recipient using: {Method} in job: {Job} with mongoDB id: {JobId}", method, job, jobId);
                  await alertTeams(`Failed Syncing recipient using: ${method} in job: ${job}`, "error", "syncRecipients", [], jobId, context.functionName);
                }
              } catch (error) {
                try {
                  logger.info("Handling the failed task, updating");
                  numbOfFailedTasks += 1;
                  await alertTeams(JSON.stringify(error.response?.data || error), "error", "syncRecipients", [], jobId, context.functionName);
                  logger.errorException(
                    error,
                    "The job: {Job} with mongoDB id: {JobId} failed. Task with the index {CurrentTaskIndex} failed. Check the teams warning for more info!",
                    job,
                    jobId,
                    currentTaskIndex
                  );

                  if (doc.tasks.syncRecipients[currentTaskIndex]?.retry) {
                    doc.tasks.syncRecipients[currentTaskIndex].retry += 1;
                  }
                  const errorObj = {
                    msg: error.response?.data || error,
                    retry: doc.tasks.syncRecipients[currentTaskIndex]?.retry ? doc.tasks.syncRecipients[currentTaskIndex].retry : 1
                  };
                  logger.warn("Task with the index: {CurrentTaskIndex} is set to failed with ErrorObj: {@ErrorObj}", currentTaskIndex, errorObj);
                  doc.tasks.syncRecipients[currentTaskIndex].status = "failed";
                  const data = Object.assign({}, doc.tasks.syncRecipients[currentTaskIndex], errorObj);
                  // Update the correct object with status "failed" and with the data.
                  updatedTask.push(data);
                } catch (innerError) {
                  logger.errorException(innerError, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
                  await alertTeams(JSON.stringify(innerError), "error", "syncRecipients", [], jobId, context.functionName);
                }
              }
            } else if (task.status === "completed") {
              updatedTask.push(doc.tasks.syncRecipients[currentTaskIndex]);
            }
          }
          const filter = { _id: jobId };
          const update = {
            "status.syncRecipients": numbOfFailedTasks === 0 ? "completed" : "inprogress",
            "tasks.syncRecipients": updatedTask
          };
          logger.info("Updating the job with the id: {JobId}", jobId);
          await Jobs.findOneAndUpdate(filter, update, {
            new: true
          });
        } catch (error) {
          logger.errorException(error, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
          await alertTeams(JSON.stringify(error), "error", "syncRecipients", [], jobId, context.functionName);
        }
      } else if (jobToHandle === "createCaseDocument") {
        let currentTasks = Object.values(taskArr[0]);
        currentTasks = Object.assign([], ...currentTasks);
        const doc = await Jobs.findOne({ _id: jobIdObj });
        // Handle doc if not found
        if (!doc) {
          logger.error("Current Job: {JobToHandle}, no job document found.", jobToHandle);
          throw new Error("Document not found");
        }
        // Current case we're working with.
        let currentCase;
        // TODO With the first run the currentCase is an array, if it fails it turns into and object, must look in to why this happens
        if (Array.isArray(doc.tasks.createCaseDocument)) {
          currentCase = doc.tasks.createCaseDocument[0];
        } else {
          currentCase = doc.tasks.createCaseDocument;
        }
        // Array of dispatches to be issued (always one, but in an array)
        const issueDispatchCopy = doc.tasks.issueDispatch;
        // Array of attachments that needs the documentNumber returned from the createCaseDocument Job.
        const uploadAttachmentsCopy = doc.tasks.uploadAttachments;
        // Define the retry prop if not found. If found assume we already tried to finish the job but failed and add 1 to the count.
        if (currentCase?.retry) {
          currentCase.retry += 1;
        } else {
          currentCase.retry = 0;
        }
        try {
          if (currentTasks[0]?.retry === 7) {
            const filter = { _id: jobId };
            const update = {
              "status.createCaseDocument": "failed"
            };
            await Jobs.findOneAndUpdate(filter, update, {
              new: true
            });
          } else {
            // There's only one case document for each task. Index[0] Is fine.
            logger.info("Creating the case object");
            // TODO With the first run the currentTasks is an array, if it fails it turns into and object, must look in to why this happens
            if (Array.isArray(currentTasks)) {
              currentTasks = currentTasks[0];
            }
            const caseObj = {
              method: currentTasks.method,
              title: currentTasks.data.parameter.title,
              caseNumber: currentTasks.data.parameter.caseNumber,
              date: currentTasks.data.parameter.date,
              contacts: currentTasks.data.parameter.contacts,
              attachments: currentTasks.data.parameter.attachments,
              paragraph: currentTasks.data.parameter.paragraph,
              responsiblePersonEmail: currentTasks.data.parameter.responsiblePersonEmail
            };
            // Make the request
            logger.info("Trying to create the case document");
            const caseDoc = await createCaseDocument(
              caseObj.method,
              caseObj.title,
              caseObj.caseNumber,
              caseObj.date,
              caseObj.contacts,
              caseObj.attachments,
              caseObj.paragraph,
              caseObj.responsiblePersonEmail
            );
            logger.info("Case document created");
            // Just for testing
            // const caseDocSampleReturn = { Recno: 212144, DocumentNumber: '23/00024-10' }

            // If no attachments we need to add the document number to the issueDispatch job
            for (const dispatch of issueDispatchCopy) {
              dispatch.dataMapping = caseDoc.DocumentNumber;
            }
            // Attach the document number to every attachment to make sure it is uploaded to the correct case
            for (const attachment of uploadAttachmentsCopy) {
              attachment.dataMapping = caseDoc.DocumentNumber;
            }

            const filter = { _id: jobId };
            const update = {
              "status.createCaseDocument": "completed",
              "tasks.createCaseDocument": currentCase,
              "tasks.issueDispatch": issueDispatchCopy,
              "tasks.uploadAttachments": uploadAttachmentsCopy
            };
            logger.info("Updating job with id: {JobId}", jobId);
            await Jobs.findOneAndUpdate(filter, update, {
              new: true
            });
            logger.info("Job with id: {JobId} updated", jobId);
          }
        } catch (error) {
          logger.errorException(error, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
          await alertTeams(JSON.stringify(error), "error", "createCaseDocument", [], jobId, context.functionName);
        }
      } else if (jobToHandle === "uploadAttachments") {
        // Handle the job
        let currentTasks = Object.values(taskArr[0]);
        currentTasks = Object.assign([], ...currentTasks);
        const doc = await Jobs.findOne({ _id: jobId });
        // Handle doc if not found
        if (!doc) {
          logger.error("Current Job: {JobToHandle}, no job document found.", jobToHandle);
          throw new Error("Document not found");
        }
        // Array of attachments that needs the documentNumber returned from the createCaseDocument Job.
        const issueDispatchCopy = doc.tasks.issueDispatch;
        const attachments = [];
        let currentTaskIndex;
        try {
          for (const attachment of currentTasks) {
            // method, documentNumber, base64, format, title
            const title = attachment.data.parameter.title;
            currentTaskIndex = currentTasks.findIndex((task) => task.data.parameter.title === title);
            logger.info("Handling current attachment: {Title}, with index: {CurrentTaskIndex}", title, currentTaskIndex);
            // Failsafe, check if any jobs have failed 7 times or more
            if (currentTasks[currentTaskIndex]?.retry >= 7) {
              // Update the DB
              try {
                const filter = { _id: jobId };
                const update = {
                  "status.uploadAttachments": "failed"
                };
                await Jobs.findOneAndUpdate(filter, update, {
                  new: true
                });
              } catch (error) {
                logger.errorException(error, "Failed to update the status of: {JobToHandle} with the job id: {JobId}", jobToHandle, jobId);
                await alertTeams(`Failed to update the status of: ${jobToHandle}`, "error", "uploadAttachments", [], jobId, context.functionName);
              }
              throw new Error("Task have failed 7 times or more");
            }

            // NB! Ikke gå videre før attachment 0 er lagt til! Dette blir hoveddokumentet
            logger.info("Checking if the first attachment is added");
            if (currentTasks[0].status === "completed") {
              logger.info("The first attachment is added, handling the rest");
              if (currentTasks[currentTaskIndex]?.status) {
                if (currentTasks[currentTaskIndex].status !== "completed") {
                  currentTasks[currentTaskIndex].status = "inprogress";
                }
              } else {
                currentTasks[currentTaskIndex].status = "inprogress";
              }
            } else {
              currentTasks[currentTaskIndex].status = "inprogress";
            }
            if (currentTasks[currentTaskIndex].status === "inprogress") {
              logger.info("Adding attachment");
              const addedAttachment = await addAttachment(
                attachment.data.system,
                attachment.dataMapping,
                attachment.data.parameter.base64,
                attachment.data.parameter.format,
                attachment.data.parameter.title
              );
              logger.info("Attachment added");
              issueDispatchCopy[0].dataMapping = addedAttachment.DocumentNumber;
              currentTasks[currentTaskIndex].response = addedAttachment;
              currentTasks[currentTaskIndex].status = "completed";
            }
          }
          attachments.push(...currentTasks);

          // Check if all the jobs is completed.
          logger.info("Checking if all the attachments have been added");
          let completedTasks = 0;
          for (const task of attachments) {
            if (task.status === "completed") {
              completedTasks += 1;
            }
          }
          logger.info("Number of attachments: {AttachmentCount}, attachments added: {CompletedTasks}", attachments.length, completedTasks);

          // Push the changes to the DB
          logger.info("Updating the changes made to the job with JobId: {JobId}", jobId);
          const filter = { _id: jobId };
          const update = {
            "tasks.issueDispatch": issueDispatchCopy,
            "status.uploadAttachments": attachments.length === completedTasks ? "completed" : "inprogress",
            "tasks.uploadAttachments": attachments
          };
          logger.info("Finding the job and updating the job with JobId {JobId}", jobId);
          await Jobs.findOneAndUpdate(filter, update, {
            new: true
          });
          logger.info("The job with JobId {JobId} have been updated", jobId);
        } catch (error) {
          currentTasks[currentTaskIndex].status = "failed";
          if (currentTasks[currentTaskIndex].retry) {
            currentTasks[currentTaskIndex].retry += 1;
          } else {
            currentTasks[currentTaskIndex].retry = 1;
          }
          currentTasks[currentTaskIndex].error = { ...error };

          if (currentTasks[currentTaskIndex].retry === 7) {
            const filter = { _id: jobId };
            const update = {
              "status.uploadAttachments": "failed"
            };
            await Jobs.findOneAndUpdate(filter, update, {
              new: true
            });
          }
          if (currentTasks[currentTaskIndex].status === "failed") {
            const filter = { _id: jobId };
            const update = {
              "tasks.uploadAttachments": currentTasks
            };
            await Jobs.findOneAndUpdate(filter, update, {
              new: true
            });
          }
          logger.errorException(error, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
          await alertTeams(JSON.stringify(error), "error", "uploadAttachments", [], jobId, context.functionName);
        }
      } else if (jobToHandle === "issueDispatch") {
        let currentTasks = Object.values(taskArr[0]);
        currentTasks = Object.assign([], ...currentTasks);
        const doc = await Jobs.findOne({ _id: jobId });
        // Handle doc if not found
        if (!doc) {
          logger.error("Current Job: {JobToHandle}, no job document found.", jobToHandle);
          throw new Error("Document not found");
        }
        const issueDispatchCopy = doc.tasks.issueDispatch;
        const documentsArray = [];
        for (const documents of currentTasks) {
          logger.info("Document(s) to issue: {@DataMapping}", documents.dataMapping);
          documentsArray.push(documents.dataMapping);
        }
        try {
          logger.info("Dispatching documents: {@DocumentsArray}", documentsArray);
          const dispatchDocument = await dispatchDocuments(documentsArray, "archive");
          if (dispatchDocument.Successful) {
            // Handle success
            logger.info("Dispatch successful for documents: {@DocumentsArray}", documentsArray);
            issueDispatchCopy[0].status = "completed";
            issueDispatchCopy[0].response = dispatchDocument;
            try {
              const filter = { _id: jobId };
              const update = {
                "status.issueDispatch": "completed",
                "tasks.issueDispatch": issueDispatchCopy
              };
              logger.info("Updating the job with JobId: {JobId}", jobId);
              await Jobs.findOneAndUpdate(filter, update, {
                new: true
              });
              logger.info("Job with JobId {JobId} updated", jobId);
            } catch (error) {
              logger.errorException(error, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
              await alertTeams(JSON.stringify(error), "error", "issueDispatch", [], jobId, context.functionName);
            }
          } else {
            if (!issueDispatchCopy[0].retry) issueDispatchCopy[0].retry = 0;
            // Handle fail
            logger.error("Dispatch failed for documents: {@DocumentsArray}", documentsArray);
            issueDispatchCopy[0].status = "failed";
            issueDispatchCopy[0].retry += 1;
            issueDispatchCopy[0].response = dispatchDocument;
            try {
              const filter = { _id: jobId };
              const update = {
                "status.issueDispatch": issueDispatchCopy[0].retry >= 7 ? "failed" : "waiting",
                "tasks.issueDispatch": issueDispatchCopy
              };
              logger.info("Updating the job with JobId: {JobId}", jobId);
              await Jobs.findOneAndUpdate(filter, update, {
                new: true
              });
              logger.info("Job with JobId {JobId} updated", jobId);
            } catch (error) {
              logger.errorException(error, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
              await alertTeams(JSON.stringify(error), "error", "issueDispatch", [], jobId, context.functionName);
            }
          }
        } catch (error) {
          logger.errorException(error, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
          await alertTeams(JSON.stringify(error), "error", "issueDispatch", [], jobId, context.functionName);
        }
      } else if (jobToHandle === "createStatistics") {
        // Handle the job
        try {
          const DispatchDoc = await Dispatches.findOne({ _id: jobId });
          const jobDoc = await Jobs.findOne({ _id: jobId });
          logger.info("Creating statistics for job with JobId: {JobId}", jobId);
          const privatepersons = jobDoc.tasks.syncRecipients.filter((t) => t.method === "SyncPrivatePerson").length;
          const enterprises = jobDoc.tasks.syncRecipients.filter((t) => t.method === "SyncEnterprise").length;
          logger.info("Pushing statistics to the DB");
          const statRes = await createStatistics(DispatchDoc.createdByDepartment, jobId, privatepersons, enterprises);
          if (statRes.acknowledged) {
            logger.info("Statistics successfully pushed to the DB");
            const filter = { _id: jobId };
            const update = {
              "status.createStatistics": "completed",
              "tasks.createStatistics": [
                {
                  status: "completed",
                  privatepersons,
                  enterprises,
                  response: statRes
                }
              ]
            };
            logger.info("Updating the job with JobId: {JobId} as completed", jobId);
            await Jobs.findOneAndUpdate(filter, update, {
              new: true
            });
            logger.info("The job with JobId {JobId} is updated and all tasks is completed! Removing the job from the jobs collection", jobId);
            await Jobs.findOneAndDelete({ _id: jobId });
            logger.info("The job with JobId {JobId} has successfully been deleted", jobId);
            await alertTeams([], "completed", [], "Job has been completed and removed from the jobs collection", jobId, context.functionName);
          } else {
            logger.error("Failed pushing statistics to the DB");
            const filter = { _id: jobId };
            const update = {
              "status.createStatistics": "failed",
              "tasks.createStatistics": [
                {
                  status: "failed",
                  privatepersons,
                  enterprises,
                  response: statRes
                }
              ]
            };
            logger.info("Updating the job with JobId: {JobId} as failed", jobId);
            await Jobs.findOneAndUpdate(filter, update, {
              new: true
            });
            logger.info("Job with JobId {JobId} updated", jobId);
          }
        } catch (error) {
          logger.errorException(error, "Failed pushing the job: {Job} with mongoDB id: {JobId} to mongoDB!", job, jobId);
          await alertTeams(JSON.stringify(error), "error", "createStatistics", [], jobId, context.functionName);
        }
      } else {
        logger.error("Did not find any tasks to handle, but for some reason we ended up here? JobID: {JobId}, Endpoint: {FunctionName}", jobId, context.functionName);
        await alertTeams("Did not find any tasks to handle, but for some reason we ended up here?", "error", "Unknown", [], jobId, context.functionName);
      }
    }

    return response(taskArr);
  } catch (error) {
    logger.errorException(error, "{RunStatus}: The job with the JobId: {JobId} failed", runStatus, jobId);
    return errorResponse(error, `${runStatus}: The job with the JobId: ${jobId} failed`, 400);
  }
};

module.exports = { handleJobs };
