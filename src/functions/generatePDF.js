const { logger } = require("@vestfoldfylke/loglady");
const { app } = require("@azure/functions");
const { PDF_GENERATOR } = require("../config");
const { response } = require("../sharedcode/response/response-handler");
const HTTPError = require("../sharedcode/vtfk-errors/httperror");

const generatePDF = async (req) => {
  // Get data from request and validate
  const { preview, template, templateName, documentDefinitionId, data } = await req.json();
  if (!preview) {
    return new HTTPError(400, "Preview must provided").toHTTPResponse();
  }
  if (!template) {
    return new HTTPError(400, "Template must be provided").toHTTPResponse();
  }
  if (!documentDefinitionId) {
    return new HTTPError(400, "DocumentDefinitionId must be provided").toHTTPResponse();
  }
  if (!data) {
    return new HTTPError(400, "Data must be provided").toHTTPResponse();
  }

  // Build request
  const requestData = {
    preview,
    template,
    documentDefinitionId,
    data
  };

  // Define headers
  const headers = {
    "x-functions-key": PDF_GENERATOR.PDF_GENERATOR_X_FUNCTIONS_KEY
  };

  // Make the request
  const responseRequest = await fetch(PDF_GENERATOR.PDF_GENERATOR_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(requestData)
  });

  if (!responseRequest.ok) {
    const errorData = await responseRequest.text();
    logger.error("Failed to create a PDF using Template {TemplateName}. Status: {Status}: {StatusText}: {@ErrorData}", templateName, responseRequest.status, responseRequest.statusText, errorData);
    return new HTTPError(responseRequest.status, `Error from PDF Generator: ${responseRequest.statusText}`).toHTTPResponse();
  }

  const responseData = await responseRequest.json();
  logger.info("Generated a PDF from Template '{TemplateName}'", templateName);

  return response(responseData);
};

app.http("generatePDF", {
  authLevel: "anonymous",
  handler: generatePDF,
  methods: ["POST"],
  route: "generatePDF"
});
