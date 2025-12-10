const { STATUS_CODES } = require("node:http");
const HTTPError = require("../vtfk-errors/httperror");

/**
 * @param {number} statusCode
 * @returns {string}
 */
const httpStatusCodeToDescription = (statusCode) => {
  if (!STATUS_CODES[statusCode]) {
    return "Unknown status code";
  }

  const suffix = ((statusCode / 100) | 0) === 4 || ((statusCode / 100) | 0) === 5 ? "Error" : "";
  const statusName = STATUS_CODES[statusCode].replace(/error$/i, "").replace(/ /g, "");
  return `${statusName}${suffix}`;
};

/**
 * @param data
 * @param {number} statusCode
 * @returns {{status: number, headers: {"Content-Type": string}, body: *} | {status: number, headers: {"Content-Type": string}, jsonBody: *}}
 */
const response = (data, statusCode = 200) => {
  if (typeof data === "object" || Array.isArray(data)) {
    return {
      status: statusCode,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      jsonBody: data
    };
  }

  return {
    status: statusCode,
    headers: {
      "Content-Type": "plain/text; charset=utf-8"
    },
    body: data
  };
};

/**
 * @param {Error | HTTPError | string} error
 * @param {string} title - optional title for the error
 * @param {number} statusCode - optional status code, default is 200. If status is found in error, it will be used instead.
 * @returns {{status: any, headers: {"Content-Type": string}, jsonBody: {error: {statusCode: any, statusName: any, message: string, title: any, errors: any}, documentation: any | {}}} | {status: any, headers: {"Content-Type": string}, jsonBody: {error: {statusCode: any, statusName: any, message: string, title: any, errors: any}}}}
 */
const errorResponse = (error, title = "", statusCode = 200) => {
  if (error instanceof HTTPError) {
    return error.toHTTPResponse();
  }

  if (error instanceof Error) {
    return new HTTPError(statusCode, error.message, title || error.name).toHTTPResponse();
  }

  return {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    jsonBody: {
      error: {
        statusCode: statusCode,
        statusName: httpStatusCodeToDescription(statusCode),
        message: ["string", "number", "boolean"].includes(typeof error) ? error : JSON.stringify(error),
        title: title || "Error",
        errors: null
      }
    }
  };
};

module.exports = {
  response,
  errorResponse
};
