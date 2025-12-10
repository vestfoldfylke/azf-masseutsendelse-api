const { app } = require("@azure/functions");
const { logger } = require("@vestfoldfylke/loglady");
const { auth } = require("../sharedcode/auth/auth");
const getDb = require("../sharedcode/connections/masseutsendelseDB.js");
const Templates = require("../sharedcode/models/templates.js");
const HTTPError = require("../sharedcode/vtfk-errors/httperror");
const { errorResponse, response } = require("../sharedcode/response/response-handler");

const putTemplates = async (req) => {
  try {
    // Authentication / Authorization
    const requestor = await auth(req);

    const requestBody = await req.json();

    // Update modified by
    requestBody.modifiedBy = requestor.name;
    requestBody.modifiedById = requestor.id;
    requestBody.modifiedTimestamp = new Date();
    requestBody.modifiedByDepartment = requestor.department;

    // Get ID from request
    const id = req.params.id;

    if (!id) {
      return new HTTPError(400, "No template id was provided").toHTTPResponse();
    }

    // Await the database
    await getDb();

    // Get the existing record
    const existingTemplate = await Templates.findById(id).lean();
    if (!existingTemplate) {
      logger.error("Template with Id {Id} could not be found", id);
      return new HTTPError(400, `Template with id ${id} could not be found`).toHTTPResponse();
    }

    // Increment the version number
    requestBody.version = existingTemplate.version + 1;

    // Update the template
    const updatedTemplate = await Templates.findByIdAndUpdate(id, requestBody, { new: true });

    logger.info("Returning updated template with Id {Id}", id);
    return response(updatedTemplate);
  } catch (err) {
    logger.errorException(err, "Failed to put templates");
    return errorResponse(err, "Failed to put templates", 400);
  }
};

app.http("putTemplates", {
  authLevel: "anonymous",
  handler: putTemplates,
  methods: ["PUT"],
  route: "templates/{id}"
});

module.exports = { putTemplates };
