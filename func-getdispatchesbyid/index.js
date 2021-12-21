const mongoose = require("mongoose");
const Dispatches = require('../sharedcode/models/dispatches.js')
const getDb = require('../sharedcode/connections/masseutsendelseDB.js')
const HTTPError = require('../sharedcode/vtfk-errors/httperror');


module.exports = async function (context, req) {
    try {
        // Get ID from request
        const id = context.bindingData.id

        // Await the database
        await getDb()
        context.log("Mongoose is connected.");

        //Find Dispatch by ID
        let disptach = await Dispatches.findById(id)
        if(!disptach) { throw new HTTPError(404, `Disptach with id ${id} could no be found`) }
        
        //Return the dispatch object 
        let disptachById = await Dispatches.findById(id, req.body, {new: true})
        context.res.send(disptachById)

        // Close the database connection
        // mongoose.connection.close();
    } catch (err) {
        context.log(err);
        context.res.status(400).send(err);
        throw err;
    }
}
