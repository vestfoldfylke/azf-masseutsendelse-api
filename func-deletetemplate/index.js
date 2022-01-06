const mongoose = require("mongoose");
const Templates = require('../sharedcode/models/templates.js')
const getDb = require('../sharedcode/connections/masseutsendelseDB.js')
const HTTPError = require('../sharedcode/vtfk-errors/httperror');


module.exports = async function (context) {
  try {
    // Authentication / Authorization
    if(req.headers.authorization) await require('../sharedcode/auth/azuread').validate(req.headers.authorization);
    else if(req.headers['x-api-key']) require('../sharedcode/auth/apikey')(req.headers['x-api-key']);
    else throw new HTTPError(401, 'No authentication token provided');

    // Await the database
    await getDb()
    context.log("Mongoose is connected.");

    // Delete the template, if it fails it probably means that it is already deleted
    try { await Templates.findByIdAndDelete(context.bindingData.id); }
    catch { context.res.send(); }
    
    context.res.send();

  } catch (err) {
    context.log(err);
    context.res.status(400).send(err);
    throw err;
  }
}