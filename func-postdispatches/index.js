const { app } = require("@azure/functions");
const { logger } = require("@vestfoldfylke/loglady");
const blobClient = require("@vtfk/azure-blob-client");
const { ObjectId } = require("mongodb");
const allowedExtensions = require("../sharedcode/allowedExtensions.json");
const { auth } = require("../sharedcode/auth/auth");
const getDb = require("../sharedcode/connections/masseutsendelseDB.js");
const Dispatches = require("../sharedcode/models/dispatches.js");
const { errorResponse, response } = require("../sharedcode/response/response-handler");
const HTTPError = require("../sharedcode/vtfk-errors/httperror.js");
const validate = require("../sharedcode/validators/dispatches").validate;
const { STORAGE } = require("../config");

const postDispatches = async (req) => {
  try {
    const requestBody = await req.json();
    delete requestBody._id; // _id must be removed by itself to not remove template _id and other _ids as well

    // Authentication / Authorization
    const requestor = await auth(req);

    // Set values
    requestBody._id = new ObjectId();
    requestBody.status = "notapproved";

    requestBody.createdBy = requestor.name;
    requestBody.createdById = requestor.id;
    requestBody.createdByEmail = requestor.email;
    requestBody.createdByDepartment = requestor.department;
    requestBody.modifiedById = requestor.id;
    requestBody.modifiedBy = requestor.name;
    requestBody.modifiedByEmail = requestor.email;
    requestBody.modifiedByDepartment = requestor.department;

    // Validate dispatch against scenarios that cannot be described by schema
    await validate(requestBody);
    requestBody.validatedArchivenumber = requestBody.archivenumber;

    // Await the DB connection
    await getDb();

    // Check if the attachments contains any invalid characters
    if (process.env.NODE_ENV === "test") {
      // For the jest testing
      console.log("This is a test, uploading to blob is skipped. Any code inside the else statement will not be tested!");
      if (requestBody.attachments && Array.isArray(requestBody.attachments) && requestBody.attachments.length > 0) {
        if (!process.env.AZURE_BLOB_CONNECTIONSTRING_TEST || !process.env.AZURE_BLOB_CONTAINERNAME_TEST) {
          return new HTTPError(500, "Cannot upload attachments when azure blob storage is not configured").toHTTPResponse();
        }
        for (const blob of requestBody.attachments) {
          for (const char of blobClient.unallowedPathCharacters) {
            if (blob.name.includes(char)) {
              return new HTTPError(400, `${blob.name} contains the illegal character ${char}`).toHTTPResponse();
            }
          }
        }
      }
    } else {
      if (requestBody.attachments && Array.isArray(requestBody.attachments) && requestBody.attachments.length > 0) {
        if (!STORAGE.AZURE_BLOB_CONNECTIONSTRING || !STORAGE.AZURE_BLOB_CONTAINERNAME) {
          return new HTTPError(500, "Cannot upload attachments when azure blob storage is not configured").toHTTPResponse();
        }
        for (const blob of requestBody.attachments) {
          for (const char of blobClient.unallowedPathCharacters) {
            if (blob.name.includes(char)) {
              return new HTTPError(400, `${blob.name} contains the illegal character ${char}`).toHTTPResponse();
            }
          }
        }
      }
    }

    // Create a new document using the model
    const dispatch = new Dispatches(requestBody);

    // Save the new dispatch to the database
    const results = await dispatch.save();

    // Upload files attached to the dispatch object if files exist.
    if (requestBody.attachments || Array.isArray(requestBody.attachments)) {
      for await (const file of requestBody.attachments) {
        const split = file.name.split(".");
        if (split.length === 1) {
          return new HTTPError(400, "All filenames must have an extension").toHTTPResponse();
        }
        const extension = split[split.length - 1];
        if (!allowedExtensions.includes(extension.toLowerCase())) {
          return new HTTPError(400, `The file extension ${extension} is not allowed`).toHTTPResponse();
        }

        if (file.name?.includes("/")) {
          return new HTTPError(400, 'Illegal character in filename, "/" is not allowed.').toHTTPResponse();
        }
        if (!file.name) file.name = file._id;

        if (process.env.NODE_ENV !== "test") await blobClient.save(`${requestBody._id}/${file.name}`, file.data);
      }
    }

    logger.info("Successfully created new dispatch by {User}", requestor.email);
    return response(results);
  } catch (err) {
    logger.errorException(err, "Failed to post dispatches");
    return errorResponse(err, "Failed to post dispatches", 400);
  }
};

app.http("postDispatches", {
  authLevel: "anonymous",
  handler: postDispatches,
  methods: ["POST"],
  route: "dispatches"
});

module.exports = { postDispatches };
