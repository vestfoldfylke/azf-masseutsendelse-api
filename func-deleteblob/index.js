const { deleteBlob } = require("../sharedcode/blob-storage")
const HTTPError = require("../sharedcode/vtfk-errors/httperror")
const { logConfig, logger } = require('@vtfk/logger')

module.exports = async function (context, req) {
    logConfig({
        azure: { context }
    })

    try {
        // Authentication / Authorization
        if(req.headers.authorization) await require('../sharedcode/auth/azuread').validate(req.headers.authorization);
        else if(req.headers['x-api-key']) require('../sharedcode/auth/apikey')(req.headers['x-api-key']);
        else {
            logger('error', ['No authentication token provided'])
            throw new HTTPError(401, 'No authentication token provided');
        }

        //Get ID from the request 
        const id = context.bindingData.id
        //Get filename from the request 
        const fileName = context.bindingData.fileName

        const file = await deleteBlob({fileName: fileName})
        context.res.send(file)
        context.res.status(200).send('File deleted')
    }catch (err) {
        context.log(err)
        logger('error', [err])
        context.res.status(400).send(JSON.stringify(err, Object.getOwnPropertyNames(err)))
        throw err
    }
}