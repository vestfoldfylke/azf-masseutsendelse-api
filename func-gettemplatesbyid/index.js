const mongoose = require("mongoose");
const Templates = require('../sharedcode/models/templates.js')
const getDb = require('../sharedcode/connections/masseutsendelseDB.js')
const utils = require('@vtfk/utilities');


module.exports = async function (context, req, id) {
    try {
        // Get ID from request
        const id = context.bindingData.id

        // Await the database
        await getDb()
        context.log("Mongoose is connected.");

        //Find Template by ID
        let template = await Templates.findById(id)
        if(!template) { throw new Error(`Template with id ${id} could no be found`) }
        context.log('== Template ==');
        utils.inspect(template);

        //Return the template object 
        let templateById = await Templates.findById(id, req.body, {new: true})
        context.res.send(templateById)

        // Close the database connection
        mongoose.connection.close();
    }catch (err) {
        context.log(err);
        context.res.status(400).send(err);
        throw err;
    }
}
