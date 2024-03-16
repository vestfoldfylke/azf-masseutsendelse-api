// Models
const Jobs = require('../sharedcode/models/jobs.js')
const Dispatches = require('../sharedcode/models/dispatches.js')

const getDb = require('../sharedcode/connections/masseutsendelseDB.js')
const { logger } = require('@vtfk/logger')
const { syncRecipient, createCaseDocument, addAttachment, dispatchDocuments } = require('../sharedcode/helpers/archive.js')
const { createStatistics } = require('../sharedcode/helpers/statistics.js')
const { azfHandleResponse, azfHandleError } = require('@vtfk/responsehandlers')
const { alertTeams } = require('../sharedcode/helpers/alertTeams.js')

module.exports = async function (context, req) {
  let jobId
  try {
    logger('info', 'Checking AUTH')
    await require('../sharedcode/auth/auth.js').auth(req)
    // Await the DB connection
    logger('info', 'Connecting to DB')
    await getDb()
    // Find the jobs
    logger('info', 'Looking for jobs to handle')
    const jobs = await Jobs.findOne({
      $or: [
        { 'status.syncRecipients': 'waiting' },
        { 'status.createCaseDocument': 'waiting' },
        { 'status.uploadAttachments': 'waiting' },
        { 'status.issueDispatch': 'waiting' },
        { 'status.createStatistics': 'waiting' },
        { 'status.syncRecipients': 'inprogress' },
        { 'status.createCaseDocument': 'inprogress' },
        { 'status.uploadAttachments': 'inprogress' },
        { 'status.issueDispatch': 'inprogress' },
        { 'status.createStatistics': 'inprogress' }
      ]
    })
    // Handle if no jobs.
    if (!jobs) {
      logger('info', 'No jobs to handle found, exit')
      // await alertTeams([], 'completed', [] , 'job', context.executionContext.functionName)
      // await alertTeams({}, 'completed', {}, 'This job is done', 'et endpoint') Dette er ikke teams webhooken glad i
      return await azfHandleResponse('No jobs found', context, req)
    }

    const taskArr = []
    const failedJobsArr = []
    let stopHandling = false

    jobId = jobs._id
    logger('info', `Found a job with id: ${jobId}`)
    logger('info', 'Checking the job status')
    for (const job in jobs.status) {
      if (Object.hasOwnProperty.call(jobs.status, job)) {
        const status = jobs.status[job]
        // Check if any jobs have failed
        if (status === 'failed') {
          if (job === 'syncRecipients' || job === 'createCaseDocument' || job === 'uploadAttachments' || job === 'issueDispatch') {
            logger('info', `The job: ${job} have status failed.`)
            stopHandling = true
          }
          const failedJobsObj = { [job]: jobs.tasks[job] }
          for (const task of failedJobsObj[job]) {
            if (task.status === 'failed') {
              failedJobsArr.push({ [job]: task })
            }
          }
          // Update the job with the failed tasks
          logger('info', `Updating the failedJobs array for ${jobId}`)
          try {
            const filter = { _id: jobId }
            const update = {
              $push: {
                failedTasks: failedJobsArr
              }
            }
            await Jobs.findOneAndUpdate(filter, update, {
              new: true,
              upsert: true
            })
            logger('info', `The failedJobs array for ${jobId} have been updated`)
            logger('error', `The job: ${job} with mongoDB id: ${jobId} have failed 7 times and the whole job is stopped!`)
            await alertTeams('Job failed 7 times, please look at it!', 'error', failedJobsArr, [], context.executionContext.functionName)
          } catch (error) {
            await alertTeams(JSON.stringify(error), 'error', 'pushing failed job to mongodb', [], jobId, context.executionContext.functionName)
            logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
            throw new Error(JSON.stringify(error), 'error', 'pushing failed job to mongodb', jobId, context.executionContext.functionName)
          }
        }
        // Find the job
        if (status === 'waiting' || status === 'inprogress') {
          if (((job === 'createCaseDocument' || job === 'issueDispatch' || job === 'uploadAttachments') && stopHandling === true) || (job === 'issueDispatch' && stopHandling === true)) {
            await alertTeams(`Current job: ${job} and stopHandling is: ${stopHandling}. DispatchID: ${jobId}. You need to look into it!`)
          } else {
            logger('info', 'Pushing the tasks to the task array.')
            const jobsObj = { [job]: jobs.tasks[job] }
            taskArr.push(jobsObj)
          }
        }
      }
    }
    // Håndter den første jobben, sett den til completed om alt gikk bra. Kjør på nytt om 5min.
    const currentJob = Object.keys(taskArr[0])
    for (const job in currentJob) {
      if (Object.hasOwnProperty.call(currentJob, job)) {
        const jobToHandle = currentJob[job]
        logger('info', `Current Job: ${jobToHandle}`)
        if (jobToHandle === 'syncRecipients') {
          // Handle the job
          try {
            let currentTasks = Object.values(taskArr[0])
            currentTasks = Object.assign([], ...currentTasks)
            const updatedTask = []
            let numbOfFailedTasks = 0
            logger('info', 'Checking each task of currentTask')
            for (const task of currentTasks) {
              const ssn = task.ssn
              const method = task.method
              const doc = await Jobs.findOne({ _id: jobId })
              if (!doc) {
                logger('info', `Current Job: ${jobToHandle}, no job found.`)
                throw new Error('Document not found')
              }
              const currentTaskIndex = doc.tasks.syncRecipients.findIndex(task => task.ssn === ssn)
              logger('info', `Working with the task with index: ${currentTaskIndex}.`)
              if (task.status === 'waiting' || task.status === 'inprogress' || task.status === 'failed') {
                if (task.status === 'failed' && task.retry === 7) {
                  logger('info', `The task with index: ${currentTaskIndex} have failed 7 times. Whole job is set to failed`)
                  const filter = { _id: jobId }
                  const update = {
                    'status.syncRecipients': 'failed'
                  }
                  await Jobs.findOneAndUpdate(filter, update, {
                    new: true
                  })
                }
                try {
                  logger('info', `Syncing recipient using: ${method}`)
                  const res = await syncRecipient(ssn, method)
                  logger('info', 'Recipient synced')
                  if (currentTaskIndex !== -1) {
                    if (doc.tasks.syncRecipients[currentTaskIndex].status === 'completed') {
                      // Push completed tasks to the updatedTask array.
                      updatedTask.push(doc.tasks.syncRecipients[currentTaskIndex])
                    } else {
                      doc.tasks.syncRecipients[currentTaskIndex].status = 'completed'
                      const data = Object.assign({}, doc.tasks.syncRecipients[currentTaskIndex], { res })
                      // Update the correct object with status "completed" and with the data.
                      updatedTask.push(data)
                    }
                  } else {
                    logger('error', `Failed Syncing recipient using: ${method} in job: ${job} with mongoDB id: ${jobId}`)
                    await alertTeams(`Failed Syncing recipient using: ${method} in job: ${job}`, 'error', 'syncRecipients', [], jobId, context.executionContext.functionName)
                  }
                } catch (error) {
                  try {
                    logger('info', 'Handling the failed task, updating')
                    numbOfFailedTasks += 1
                    await alertTeams(JSON.stringify(error.response.data), 'error', 'syncRecipients', [], jobId, context.executionContext.functionName)
                    logger('error', `The job: ${job} with mongoDB id: ${jobId} failed. Task with the index ${currentTaskIndex} failed. Check the teams warning for more info!`)
                    const errorObj = {
                      msg: error.response.data,
                      retry: doc.tasks.syncRecipients[currentTaskIndex]?.retry ? doc.tasks.syncRecipients[currentTaskIndex].retry += 1 : 1
                    }
                    logger('info', `Task with the index: ${currentTaskIndex} is set to failed`)
                    doc.tasks.syncRecipients[currentTaskIndex].status = 'failed'
                    const data = Object.assign({}, doc.tasks.syncRecipients[currentTaskIndex], errorObj)
                    // Update the correct object with status "failed" and with the data.
                    updatedTask.push(data)
                  } catch (error) {
                    logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
                    await alertTeams(JSON.stringify(error), 'error', 'syncRecipients', [], jobId, context.executionContext.functionName)
                  }
                }
              } else if (task.status === 'completed') {
                updatedTask.push(doc.tasks.syncRecipients[currentTaskIndex])
              }
            }
            const filter = { _id: jobId }
            const update = {
              'status.syncRecipients': numbOfFailedTasks === 0 ? 'completed' : 'inprogress',
              'tasks.syncRecipients': updatedTask
            }
            logger('info', `Updating the job with the id: ${jobId}`)
            await Jobs.findOneAndUpdate(filter, update, {
              new: true
            })
          } catch (error) {
            logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
            await alertTeams(JSON.stringify(error), 'error', 'syncRecipients', [], jobId, context.executionContext.functionName)
          }
        } else if (jobToHandle === 'createCaseDocument') {
          let currentTasks = Object.values(taskArr[0])
          currentTasks = Object.assign([], ...currentTasks)
          const doc = await Jobs.findOne({ _id: jobId })
          // Handle doc if not found
          if (!doc) {
            logger('info', `Current Job: ${jobToHandle}, no job found.`)
            throw new Error('Document not found')
          }
          // Current case we're working with.
          const currentCase = doc.tasks.createCaseDocument[0]
          // Array of attachments that needs the documentNumber retunren from the createCaseDocumnet Job.
          const uploadAttachmentsCopy = doc.tasks.uploadAttachments
          // Define the retry prop if not found. If found assume we already tried to finish the job but failed and add 1 to the count.
          currentCase?.retry ? currentCase.retry += 1 : currentCase.retry = 0
          try {
            if (currentTasks[0]?.retry === 7) {
              const filter = { _id: jobId }
              const update = {
                'status.createCaseDocument': 'failed'
              }
              await Jobs.findOneAndUpdate(filter, update, {
                new: true
              })
            } else {
              // There's only one casedocument for each task. Index[0] Is fine.
              logger('info', 'Creating the case object')
              const caseObj = {
                method: currentTasks[0].method,
                title: currentTasks[0].data.parameter.title,
                caseNumber: currentTasks[0].data.parameter.caseNumber,
                date: currentTasks[0].data.parameter.date,
                contacts: currentTasks[0].data.parameter.contacts,
                attachments: currentTasks[0].data.parameter.attachments,
                paragraph: currentTasks[0].data.parameter.paragraph,
                responsiblePersonEmail: currentTasks[0].data.parameter.responsiblePersonEmail
              }
              // Make the request
              logger('info', 'Trying to create the case document')
              const caseDoc = await createCaseDocument(
                caseObj.method,
                caseObj.title,
                caseObj.caseNumber,
                caseObj.date,
                caseObj.contacts,
                caseObj.attachments,
                caseObj.paragraph,
                caseObj.responsiblePersonEmail
              )
              logger('info', 'Case document created')
              // Just for testing
              // const caseDocSampleReturn = { Recno: 212144, DocumentNumber: '23/00024-10' }

              for (const attachment of uploadAttachmentsCopy) {
                attachment.dataMapping = caseDoc.DocumentNumber
              }

              const filter = { _id: jobId }
              const update = {
                'status.createCaseDocument': 'completed',
                'tasks.createCaseDocument': currentCase,
                'tasks.uploadAttachments': uploadAttachmentsCopy
              }
              logger('info', `Updating job with id: ${jobId}`)
              await Jobs.findOneAndUpdate(filter, update, {
                new: true
              })
              logger('info', `Job with id: ${jobId} updated`)
            }
          } catch (error) {
            logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
            await alertTeams(JSON.stringify(error), 'error', 'createCaseDocument', [], jobId, context.executionContext.functionName)
          }
        } else if (jobToHandle === 'uploadAttachments') {
          // Handle the job
          let currentTasks = Object.values(taskArr[0])
          currentTasks = Object.assign([], ...currentTasks)
          const doc = await Jobs.findOne({ _id: jobId })
          // Handle doc if not found
          if (!doc) {
            logger('info', `Current Job: ${jobToHandle}, no job found.`)
            throw new Error('Document not found')
          }
          // Array of attachments that needs the documentNumber retunren from the createCaseDocumnet Job.
          const issueDispatchCopy = doc.tasks.issueDispatch
          const attachments = []
          let currentTaskIndex
          try {
            for (const attachment of currentTasks) {
              // method, documentNumber, base64, format, title
              const title = attachment.data.parameter.title
              currentTaskIndex = currentTasks.findIndex(task => task.data.parameter.title === title)
              logger('info', `Handling current attachment: ${title}, with index: ${currentTaskIndex}`)
              // Failsafe, check if any jobs have failed 7 times or more
              if (currentTasks[currentTaskIndex]?.retry >= 7) {
                // Update the DB
                try {
                  const filter = { _id: jobId }
                  const update = {
                    'status.uploadAttachments': 'failed'
                  }
                  await Jobs.findOneAndUpdate(filter, update, {
                    new: true
                  })
                } catch (error) {
                  logger('error', `Failed to update the status of: ${jobToHandle} with the job id: ${jobId}`)
                  await alertTeams(`Failed to update the status of: ${jobToHandle}`, 'error', 'uploadAttachments', [], jobId, context.executionContext.functionName)
                }
                throw new Error('Task have failed 7 times or more')
              }

              // NB! Ikke gå videre før attachemnt 0 er lagt til! Dette blir hoveddokumentet
              logger('info', 'Checking if the first attachment is added')
              if (currentTasks[0].status === 'completed') {
                logger('info', 'The first attachment is added, handling the rest')
                if (currentTasks[currentTaskIndex]?.status) {
                  if (currentTasks[currentTaskIndex].status !== 'completed') {
                    currentTasks[currentTaskIndex].status = 'inprogress'
                  }
                } else {
                  currentTasks[currentTaskIndex].status = 'inprogress'
                }
              } else {
                currentTasks[currentTaskIndex].status = 'inprogress'
              }
              if (currentTasks[currentTaskIndex].status === 'inprogress') {
                logger('info', 'Adding attachment')
                const addedAttachment = await addAttachment(
                  attachment.data.system,
                  attachment.dataMapping,
                  attachment.data.parameter.base64,
                  attachment.data.parameter.format,
                  attachment.data.parameter.title
                )
                logger('info', 'Attachment added')
                issueDispatchCopy[0].dataMapping = addedAttachment.DocumentNumber
                currentTasks[currentTaskIndex].response = addedAttachment
                currentTasks[currentTaskIndex].status = 'completed'
              }
            }
            attachments.push(...currentTasks)

            // Check if all the jobs is completed.
            logger('info', 'Checking if all the attachments have been added')
            let completedTasks = 0
            for (const task of attachments) {
              if (task.status === 'completed') {
                completedTasks += 1
              }
            }
            logger('info', `Number of attachments: ${attachments.length}, attachments added: ${completedTasks}`)

            // Push the changes to the DB
            logger('info', 'Updating the changes made to the job')
            const filter = { _id: jobId }
            const update = {
              'tasks.issueDispatch': issueDispatchCopy,
              'status.uploadAttachments': attachments.length === completedTasks ? 'completed' : 'inprogress',
              'tasks.uploadAttachments': attachments
            }
            logger('info', 'Finding the job and updating the job')
            await Jobs.findOneAndUpdate(filter, update, {
              new: true
            })
            logger('info', 'The job have been updated')
          } catch (error) {
            currentTasks[currentTaskIndex].status = 'failed'
            currentTasks[currentTaskIndex].retry ? currentTasks[currentTaskIndex].retry += 1 : currentTasks[currentTaskIndex].retry = 1
            currentTasks[currentTaskIndex].error = { ...error }

            if (currentTasks[currentTaskIndex].retry === 7) {
              const filter = { _id: jobId }
              const update = {
                'status.uploadAttachments': 'failed'
              }
              await Jobs.findOneAndUpdate(filter, update, {
                new: true
              })
            }
            if (currentTasks[currentTaskIndex].status === 'failed') {
              const filter = { _id: jobId }
              const update = {
                'tasks.uploadAttachments': currentTasks
              }
              await Jobs.findOneAndUpdate(filter, update, {
                new: true
              })
            }
            logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
            await alertTeams(JSON.stringify(...error), 'error', 'uploadAttachments', [], jobId, context.executionContext.functionName)
          }
        } else if (jobToHandle === 'issueDispatch') {
          let currentTasks = Object.values(taskArr[0])
          currentTasks = Object.assign([], ...currentTasks)
          const doc = await Jobs.findOne({ _id: jobId })
          // Handle doc if not found
          if (!doc) {
            logger('info', `Current Job: ${jobToHandle}, no job found.`)
            throw new Error('Document not found')
          }
          const issueDispatchCopy = doc.tasks.issueDispatch
          const documentsArray = []
          for (const documents of currentTasks) {
            logger('info', `Document(s) to issue: ${documents.dataMapping}`)
            documentsArray.push(documents.dataMapping)
          }
          try {
            logger('info', `Dispatching docmunets: ${documentsArray}`)
            const dispatchDocument = await dispatchDocuments(documentsArray, 'archive')
            if (dispatchDocument.Successful) {
              // Handle success
              logger('info', `Dispatch successful for documents: ${documentsArray}`)
              issueDispatchCopy[0].status = 'completed'
              issueDispatchCopy[0].response = dispatchDocument
              try {
                const filter = { _id: jobId }
                const update = {
                  'status.issueDispatch': 'completed',
                  'tasks.issueDispatch': issueDispatchCopy
                }
                logger('info', 'Updating the job')
                await Jobs.findOneAndUpdate(filter, update, {
                  new: true
                })
                logger('info', 'Job updated')
              } catch (error) {
                logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
                await alertTeams(JSON.stringify(error), 'error', 'issueDispatch', [], jobId, context.executionContext.functionName)
              }
            } else {
              if (!issueDispatchCopy[0].retry) issueDispatchCopy[0].retry = 0
              // Handle fail
              logger('info', `Dispatch failed for documents: ${documentsArray}`)
              issueDispatchCopy[0].status = 'failed'
              issueDispatchCopy[0].retry += 1
              issueDispatchCopy[0].response = dispatchDocument
              try {
                const filter = { _id: jobId }
                const update = {
                  'status.issueDispatch': issueDispatchCopy[0].retry >= 7 ? 'failed' : 'waiting',
                  'tasks.issueDispatch': issueDispatchCopy
                }
                logger('info', 'Updating the job')
                await Jobs.findOneAndUpdate(filter, update, {
                  new: true
                })
                logger('info', 'Job updated')
              } catch (error) {
                logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
                await alertTeams(JSON.stringify(error), 'error', 'issueDispatch', [], jobId, context.executionContext.functionName)
              }
            }
          } catch (error) {
            logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
            await alertTeams(JSON.stringify(error), 'error', 'issueDispatch', [], jobId, context.executionContext.functionName)
          }
        } else if (jobToHandle === 'createStatistics') {
          // Handle the job
          try {
            const DispatchDoc = await Dispatches.findOne({ _id: jobId })
            const jobDoc = await Jobs.findOne({ _id: jobId })
            logger('info', 'Creating statistics')
            const privatepersons = jobDoc.tasks.syncRecipients.filter(t => t.method === 'SyncPrivatePerson').length
            const enterprises = jobDoc.tasks.syncRecipients.filter(t => t.method === 'SyncEnterprise').length
            logger('info', 'Pushing statistics to the DB')
            const statRes = await createStatistics(DispatchDoc.createdByDepartment, jobId, privatepersons, enterprises)
            if (statRes.acknowledged) {
              logger('info', 'Statistics successfully pushed to the DB')
              const filter = { _id: jobId }
              const update = {
                'status.createStatistics': 'completed',
                'tasks.createStatistics': [{
                  status: 'completed',
                  privatepersons,
                  enterprises,
                  response: statRes
                }]
              }
              logger('info', 'Updating the job')
              await Jobs.findOneAndUpdate(filter, update, {
                new: true
              })
              logger('info', 'The job is updated and all tasks is completed! Removing the job from the jobs collection')
              await Jobs.findOneAndDelete({ _id: jobId })
              logger('info', 'The job has successfully been deleted')
              await alertTeams([], 'completed', [], 'Job has been completed and removed from the jobs collection', jobId, context.executionContext.functionName)
            } else {
              logger('info', 'Failed pushing statistics to the DB')
              const filter = { _id: jobId }
              const update = {
                'status.createStatistics': 'failed',
                'tasks.createStatistics': [{
                  status: 'failed',
                  privatepersons,
                  enterprises,
                  response: statRes
                }]
              }
              logger('info', 'Updating the job')
              await Jobs.findOneAndUpdate(filter, update, {
                new: true
              })
              logger('info', 'Job updated')
            }
          } catch (error) {
            logger('error', `Failed pushing the job: ${job} with mongoDB id: ${jobId} to mongoDB!`)
            await alertTeams(JSON.stringify(error), 'error', 'createStatistics', [], jobId, context.executionContext.functionName)
          }
        } else {
          logger('error', `Did not find any tasks to handle, but for some reason we ended up here? JobID: ${jobId}, Endpoint: ${context.executionContext.functionName}`)
          await alertTeams('Did not find any tasks to handle, but for some reason we ended up here?', 'error', 'Unknown', [], jobId, context.executionContext.functionName)
        }
      }
    }
    return await azfHandleResponse(taskArr, context, req)
  } catch (error) {
    logger('error', `The job with the job id: ${jobId} failed`)
    return await azfHandleError(error, context, req)
  }
}
