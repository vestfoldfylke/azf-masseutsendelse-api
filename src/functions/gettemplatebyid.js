const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const { auth } = require("../sharedcode/auth/auth");
const getDb = require("../sharedcode/connections/masseutsendelseDB.js");
const Templates = require("../sharedcode/models/templates.js");
const { errorResponse, response } = require("../sharedcode/response/response-handler");
const HTTPError = require("../sharedcode/vtfk-errors/httperror");

const getTemplateById = async (req) => {
  try {
    // Authentication / Authorization
    await auth(req);

    // Get ID from request
    const id = req.params.id;

    if (!id) {
      return new HTTPError(400, "No template id was provided").toHTTPResponse();
    }

    // Await the database
    await getDb();

    // Find Template by ID
    const template = await Templates.findById(id);
    if (!template) {
      logger.error("Template with Id {Id} could not be found", id);
      return new HTTPError(400, `Template with id ${id} could not be found`).toHTTPResponse();
    }

    // Return the template object
    const templateById = await Templates.findById(id, {}, { new: true });
    logger.info("Returning template with Id {Id}", id);

    return response(templateById);
  } catch (err) {
    logger.errorException(err, "Failed to get templates by id");
    return errorResponse(err, "Failed to get template by id", 400);
  }
};

app.http("getTemplateById", {
  authLevel: "anonymous",
  handler: getTemplateById,
  methods: ["GET"],
  route: "templates/{id}"
});

module.exports = { getTemplateById };
