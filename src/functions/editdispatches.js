const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const blobClient = require("@vtfk/azure-blob-client");
const allowedExtensions = require("../sharedcode/allowedExtensions.json");
const { auth } = require("../sharedcode/auth/auth");
const getDb = require("../sharedcode/connections/masseutsendelseDB.js");
const Dispatches = require("../sharedcode/models/dispatches.js");
const { errorResponse, response } = require("../sharedcode/response/response-handler");
const validate = require("../sharedcode/validators/dispatches").validate;
const HTTPError = require("../sharedcode/vtfk-errors/httperror");

const editDispatches = async (req) => {
  try {
    const requestBody = await req.json();
    delete requestBody._id;

    // Authentication / Authorization
    const requestor = await auth(req);

    // Update modified by
    requestBody.modifiedBy = requestor.name;
    requestBody.modifiedById = requestor.id;
    requestBody.modifiedTimestamp = new Date();
    requestBody.modifiedByEmail = requestor.email;
    requestBody.modifiedByDepartment = requestor.department;

    // Figure out if any items should be unset
    const unsets = {};
    if (Object.keys(requestBody).length === 2 && !requestBody.template) unsets.template = 1;
    if (requestBody.attachments && !requestBody.template) unsets.template = 1;

    // Get ID from request
    const id = req.params.id;

    // Await the Db connection
    await getDb();

    // Get the existing dispatch object
    const existingDispatch = await Dispatches.findById(id).lean();
    if (!existingDispatch) {
      return new HTTPError(404, `Dispatch with id ${id} could not be found`).toHTTPResponse();
    }

    // If the status is running or completed, only status is allowed to be updated
    if (existingDispatch.status === "inprogress" && requestBody.status !== "completed") {
      return new HTTPError(400, "No changes can be done to a running dispatch except setting it to completed").toHTTPResponse();
    }
    if (existingDispatch.status === "inprogress" && requestBody.status === "completed") {
      const result = await Dispatches.findByIdAndUpdate(id, { status: "completed" }, { new: true });
      return response(result, 201);
    }
    // Failsafe
    if (existingDispatch.status === "inprogress" || existingDispatch.status === "completed") {
      return new HTTPError(400, "No changes can be done to running or completed dispatches").toHTTPResponse();
    }

    // Update fields
    requestBody.validatedArchivenumber = existingDispatch.validatedArchivenumber;

    // Set approval information
    if (existingDispatch.status === "notapproved" && requestBody.status === "approved") {
      requestBody.approvedBy = requestor.name;
      requestBody.approvedById = requestor.id;
      requestBody.approvedByEmail = requestor.email;
      requestBody.approvedTimestamp = new Date();
    }
    if (requestBody.status === "notapproved") {
      requestBody.approvedBy = "";
      requestBody.approvedById = "";
      requestBody.approvedTimestamp = "";
    }

    // Validate dispatch against scenarios that cannot be described by schema
    // const toValidate = {...existingDispatch, ...requestBody}
    await validate(requestBody);
    requestBody.validatedArchivenumber = requestBody.archivenumber;

    // Validate attachments
    if (requestBody.attachments && Array.isArray(requestBody.attachments) && requestBody.attachments.length > 0) {
      requestBody.attachments.forEach((i) => {
        const split = i.name.split(".");
        if (split.length === 1) {
          throw new HTTPError(400, "All filenames must have an extension");
        }
        const extension = split[split.length - 1];
        if (!allowedExtensions.includes(extension.toLowerCase())) {
          throw new HTTPError(400, `The file extension ${extension} is not allowed`);
        }
        blobClient.unallowedPathCharacters.forEach((char) => {
          if (i.name.includes(char)) {
            throw new HTTPError(400, `${i} cannot contain illegal character ${char}`);
          }
        });
      });
    }

    // Update the dispatch
    const updatedDispatch = await Dispatches.findByIdAndUpdate(id, { ...requestBody, $unset: unsets }, { new: true });

    // Figure out the names of existing and requested attachments
    const existingNames = existingDispatch.attachments ? existingDispatch.attachments.map((i) => i.name) : [];
    const requestNames = requestBody.attachments ? requestBody.attachments.map((i) => i.name) : [];

    // Check for attachments to add
    if (requestBody.attachments) {
      const attachmentsToAdd = requestBody.attachments.filter((i) => !existingNames.includes(i.name) || i.data);
      const attachmentsToRemove = existingNames.filter((i) => !requestNames.includes(i));

      // Upload attachments if applicable
      if (process.env.NODE_ENV !== "test")
        for (const i of attachmentsToAdd) {
          await blobClient.save(`${id}/${i.name}`, i.data);
        }
      // Remove attachments if applicable
      if (process.env.NODE_ENV !== "test")
        for (const i of attachmentsToRemove) {
          await blobClient.remove(`${id}/${i}`);
        }
    }

    logger.info("Dispatch with Id {Id} has been edited by {User}", id, requestor.email);
    // Return the dispatch
    return response(updatedDispatch);
  } catch (err) {
    logger.errorException(err, "Failed to edit dispatches");
    return errorResponse(err, "Failed to edit dispatches", 400);
  }
};

app.http("editDispatches", {
  authLevel: "anonymous",
  handler: editDispatches,
  methods: ["PUT"],
  route: "dispatches/{id}"
});

module.exports = { editDispatches };
