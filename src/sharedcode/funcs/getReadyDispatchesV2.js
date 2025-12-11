const blobClient = require("@vtfk/azure-blob-client");
const { logger } = require("@vestfoldfylke/loglady");
const dayjs = require("dayjs");
const getDb = require("../connections/masseutsendelseDB.js");
const { alertTeams } = require("../helpers/alertTeams");
const Dispatches = require("../models/dispatches.js");
const Jobs = require("../models/jobs");
const { response } = require("../response/response-handler");
const HTTPError = require("../vtfk-errors/httperror");
const { PDF_GENERATOR, MISC } = require("../../config");

const generatePdfFromTemplate = async (dispatch) => {
  const data = dispatch.template.data || {};

  if (dispatch.attachments && Array.isArray(dispatch.attachments) && dispatch.attachments.length > 0) {
    data.attachments = dispatch.attachments;
  }

  data.info = {
    sector: dispatch.createdByDepartment,
    "our-reference": dispatch.archivenumber,
    "our-caseworker": dispatch.createdBy
  };

  logger.info("Creating the request");
  const pdfRequestBody = {
    template: dispatch.template.template,
    documentDefinitionId: dispatch.template.documentDefinitionId || "brevmal",
    data
  };

  // Generate PDF from template
  const legalFilename = dispatch.title.replace(/[/\\?%*:|"<>;¤]/g, "");
  logger.info("Making the request to the PDF api");
  const response = await fetch(PDF_GENERATOR.PDF_GENERATOR_ENDPOINT, {
    method: "POST",
    headers: {
      "x-functions-key": PDF_GENERATOR.PDF_GENERATOR_X_FUNCTIONS_KEY
    },
    body: JSON.stringify(pdfRequestBody)
  });

  if (!response.ok) {
    const errorData = await response.text();
    logger.error("Failed to create a PDF from the template: {Filename}, Status: {Status}: {StatusText}: {@ErrorData}", legalFilename, response.status, response.statusText, errorData);
    throw new HTTPError(response.status, `Could not generate PDF for dispatch ${dispatch.title}`);
  }

  const responseData = await response.json();
  logger.info("Successfully created a PDF from the template: {Filename}", legalFilename);

  return {
    title: legalFilename,
    format: "pdf",
    versionFormat: "A",
    base64: responseData.base64
  };
};

const retrieveAttachments = async (dispatch) => {
  if (process.env.NODE_ENV === "test") {
    logger.info("Currently in test, will not look for attachments");
    return [
      {
        title: "test",
        format: ".txt",
        base64: "base64"
      }
    ];
  }

  logger.info("Retrieving the attachments if any attachments was added");
  if (!Array.isArray(dispatch.attachments) || dispatch.attachments.length === 0) {
    logger.info("No attachments found");
    return [];
  }

  logger.info("{DispatchAttachmentCount} attachment(s) found", dispatch.attachments.length);
  const attachments = [];
  for (const attachment of dispatch.attachments) {
    logger.info("Fetching the attachment: {AttachmentName} from blob storage", attachment.name);
    const file = await blobClient.get(`${dispatch._id}/${attachment.name}`);

    // Validate the files
    if (!file || !file.data || file.data.length === 0) {
      logger.error("No files found, check if you passed the right filename and/or the right dispatchId");
      throw new HTTPError(404, "No files found, check if you passed the right filename and/or the right dispatchId");
    }

    logger.info("Successfully fetched the attachment: {AttachmentName} from blob storage, validating the file.", attachment.name);
    if (file.data.startsWith("data:") && file.data.includes(",")) {
      file.data = file.data.substring(file.data.indexOf(",") + 1);
    }
    if (file.name.includes(".")) {
      file.name = file.name.substring(0, file.name.indexOf("."));
    }
    logger.info("Attachment: {AttachmentName} is valid, pushing it to the file array.", attachment.name);

    attachments.push({
      title: file.name,
      format: file.extension,
      base64: file.data
    });
  }

  return attachments;
};

const getReadyDispatchesV2 = async (_req, context) => {
  // Arrays
  const dispatchJobs = [];

  // Await the DB connection
  logger.info("Connecting to DB");
  await getDb();

  // Find all dispatches
  logger.info("Looking for approved dispatches to handle");
  const d = await Dispatches.findOne({ status: "approved" });
  if (d === null) {
    logger.info("No approved dispatches found");
    return response("No approved dispatches found");
  }

  const dispatches = [];
  dispatches.push(await d);
  if (dispatches.length === 0) {
    logger.info("No approved dispatches found");
    return response("No approved dispatches found");
  }

  // Loop through all dispatches
  for (const dispatch of dispatches) {
    // Validate if the dispatch is ready
    logger.info("Found an approved dispatch to handle, checking if it has passed the registration threshold");
    if (!dispatch.approvedTimestamp) continue;

    // Check if the dispatch has passed the registration threshold
    const registrationThreshold = dayjs(dispatch.approvedTimestamp).set("hour", 23).set("minute", 59).set("second", 59).set("millisecond", 0);
    const delaySendUntil = dayjs().set("hour", 11).set("minute", 0).set("second", 0).set("millisecond", 0);

    // If true, registration threshold check will be skipped and jobs will be created.
    if (!MISC.BYPASS_REGISTRATION_THRESHOLD) {
      logger.info("Checking registration threshold, will create job if it is passed.");
      if (dayjs(new Date()).isBefore(registrationThreshold)) continue;
    }

    // Variables
    const dispatchFiles = []; // Stores all files that should be registered to the job
    const dispatchJob = {
      title: dispatch.title,
      approvedTimeStamp: dispatch.approvedTimestamp,
      delayUntil: delaySendUntil.toISOString(),
      status: {
        syncRecipients: "waiting",
        uploadAttachments: "waiting",
        createCaseDocument: "waiting",
        issueDispatch: "waiting",
        createStatistics: "waiting"
      },
      tasks: {
        syncRecipients: [],
        uploadAttachments: [],
        createCaseDocument: [],
        issueDispatch: [],
        createStatistics: ""
      }
    };

    // Generate PDF from template, if applicable
    logger.info("Generating PDF from template if a template was used in the dispatch (brevmal)");
    if (dispatch.template?.template) {
      const generatedPdf = await generatePdfFromTemplate(dispatch);
      dispatchFiles.push(generatedPdf);
    }

    // Retrieve any attachments if applicable
    const attachments = await retrieveAttachments(dispatch);
    if (attachments.length > 0) {
      dispatchFiles.push(...attachments);
    }

    // Create the archive task
    const personArray = [];
    const businessArray = [];
    logger.info("Creating the archive task, for DispatchId: {DispatchId}", dispatch._id);
    for (const owner of dispatch.owners) {
      if (owner._type.toLowerCase().includes("juridisk")) {
        businessArray.push({
          orgnr: owner.nummer
        });
      } else {
        personArray.push({
          ssn: owner.nummer
        });
      }
    }

    logger.info("Creating the task to sync recipients in archive, for DispatchId: {DispatchId}", dispatch._id);
    // Create tasks for create/update private persons
    personArray.forEach((person) => {
      dispatchJob.tasks.syncRecipients.push({
        method: "SyncPrivatePerson",
        retry: 0,
        status: "waiting",
        ssn: person.ssn
      });
    });
    // Create tasks for creating/updated persons
    businessArray.forEach((business) => {
      dispatchJob.tasks.syncRecipients.push({
        method: "SyncEnterprise",
        retry: 0,
        status: "waiting",
        ssn: business.orgnr
      });
    });
    logger.info("Creating the archive caseDocument task, for DispatchId: {DispatchId}", dispatch._id);
    // Create the p360 caseDocument
    dispatchJob.tasks.createCaseDocument.push({
      method: "archive",
      data: {
        system: "masseutsendelse",
        template: "utsendelsesdokument",
        parameter: {
          title: dispatch.title,
          caseNumber: dispatch.archivenumber,
          date: new Date().toISOString(),
          contacts: dispatch.owners.map((o) => {
            return { ssn: o.nummer, role: "Mottaker" };
          }),
          attachments: [dispatchFiles[0]],
          accessCode: "U", // U = Alle
          accessGroup: "Alle", // No access restriction
          paragraph: "", // No paragraph
          responsiblePersonEmail: dispatch.createdByEmail
        }
      }
    });

    if (dispatchFiles.length > 1) {
      // Create one uploadDocuments-job pr. Attachment
      let fileIndex = -1;
      for (const file of dispatchFiles) {
        logger.info("Creating the archive uploadDocuments task, for attachment: {FileTitle} ({FileFormat}) with DispatchId: {DispatchId}", file.title, file.format, dispatch._id);
        fileIndex++;
        if (fileIndex === 0) continue;
        dispatchJob.tasks.uploadAttachments.push({
          dataMapping: "parameter.documentNumber=DocumentNumber",
          data: {
            system: "archive",
            template: "add-attachment",
            parameter: {
              secure: false,
              title: file.title,
              format: file.format,
              base64: file.base64,
              versionFormat: "P"
            }
          }
        });
      }
    }

    // Create task to send to each contact
    logger.info("Creating the archive issueDispatch task, for DispatchId: {DispatchId}", dispatch._id);
    dispatchJob.tasks.issueDispatch.push({
      dataMapping: '{"parameter": { "Documents": [ { "DocumentNumber": "{{DocumentNumber}}" }]}}',
      data: {
        method: "DispatchDocuments",
        service: "DocumentService"
      }
    });

    // Add the job to the jobs array
    dispatchJobs.push({ _id: dispatch._id, ...dispatchJob });
  }

  let updatedDispatch = {};
  if (dispatchJobs.length > 0) {
    logger.info("Creating a new job and saving it to the Jobs collection");
    const job = new Jobs(...dispatchJobs);
    // Save the new dispatch to the database
    await job.save();
    logger.info("Successfully saved the job to the Jobs collection with the JobId: {JobId}", job._id);
    // Set dispatch to completed and wipe data that is not needed.
    const filter = { _id: job._id };
    const update = {
      status: "completed",
      owners: [],
      excludedOwners: [],
      matrikkelUnitsWithoutOwners: []
    };
    logger.info("Updating and wiping the dispatch with JobId: {JobId} for personal information", job._id);
    updatedDispatch = await Dispatches.findOneAndUpdate(filter, update, {
      new: true
    });

    logger.info("Successfully updated the dispatch with JobId: {JobId}", job._id);
    await alertTeams([], "completed", [], "Jobs have now been created for the dispatch, everything went well", job._id, context.functionName);
  }

  return response(updatedDispatch);
};

module.exports = { getReadyDispatchesV2 };
