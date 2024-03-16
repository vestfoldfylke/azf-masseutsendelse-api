// Endpoints
const postTemplate = require('../../../func-posttemplate/index')
const getTemplateById = require('../../../func-gettemplatesbyid/index')
const getTemplates = require('../../../func-gettemplates/index')
const editTemplate = require('../../../func-puttemplates/index')
const postDispatches = require('../../../func-postdispatches/index')
const getDispachesById = require('../../../func-getdispatchesbyid/index')
const getDispaches = require('../../../func-getdispatches/index')
const editDispatches = require('../../../func-editdispatches/index')
const getReadyDispatches = require('../../../func-getreadydispatches/index')
const complteDispatch = require('../../../func-completedispatch/index')
const getMatrikkel = require('../../../func-getmatrikkel/index')
const getBlob = require('../../../func-getblob')

// Valid test cases
const validTemplate = require('../testCases/validCases/post_template')
const validDispatchBoth = require('../testCases/validCases/post_dispatch_both')
const validDispatchAttachments = require('../testCases/validCases/post_dispatch_attachments')
const validDispatchTemplate = require('../testCases/validCases/post_dispatch_template')
const validDispatchEdit = require('../testCases/validCases/edit_disaptch')
const validDispatchEditInprogress = require('../testCases/validCases/edit_dispatch_inprogress')
const validDispatchEditApproved = require('../testCases/validCases/edit_dispatch_approved')
const validDispatchEditTimestamp = require('../testCases/validCases/edit_dispatch_approvedTimestamp')

// Invalid test cases
const invalidDispatch = require('../testCases/invalidCases/post_dispatch_missing_template_and_attachments')
const invalidDispatchArchiveNumber = require('../testCases/invalidCases/post_dispatch_missing_archivenumber')
const invalidDispatchMissingFileExtension = require('../testCases/invalidCases/post_dispatch_missing_extension')
const invalidDispatchIllegalFileExtension = require('../testCases/invalidCases/post_dispatch_illegal_extension')
const invalidDispatchIllegalCharacter = require('../testCases/invalidCases/post_dispatch_illegal_character')

// MSW
const { rest } = require('msw')
const { setupServer } = require('msw/node')

// Test setup
const { setupDB } = require('../test-setup')
const context = require('../defaultContext')

setupDB()
jest.setTimeout(15000)

// Tests
describe('Endpoint testing', () => {
  // MSW
  const server = setupServer(
    // getReadyDispatches, Generate PDF from template mock
    rest.post('https://api.vtfk.no/pdf/v1/jestTest', (req, res, ctx) => {
      return res(ctx.status(201), ctx.json({
        body: {
          data: {
            tittel: 'Parallel test',
            'beskrivelse av prosjekte': 'Parallel test',
            fremdrift: 'Parallel test',
            Regelverk: 'Parallel test'
          },
          base64: { pdfBase64: 'En pdfbase64' }
        }
      }))
    }),
    // getMatrikkel, mock
    rest.post('https://api.vtfk.no/matrikkel/v1/jestTestjestTest', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({
        msg: 'Matrikkel api successfully connected'
      }))
    }),
    // Validate archivenumber, mock
    rest.post('https://api.vtfk.dev/archive/v1/jestTestarchive', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({
        msg: 'Archive api successfully connected'
      }))
    })
  )

  // beforeAll(() => server.listen())
  // afterAll(() => server.close())
  // afterEach(() => server.resetHandlers())

  const OLD_ENV_VAR = process.env

  beforeAll(() => {
    // jest.resetModules() // Clears the cache, remove the // if you want trouble :)
    process.env = { ...OLD_ENV_VAR },
    server.listen()
  })

  afterAll(() => {
    process.env = OLD_ENV_VAR,
    server.close()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  const apikeyHeader = {
    headers: {
      'x-api-key': process.env.APIKEYS_TEST
    }
  }

  // Variables
  let idTemplate = ''
  let timestampTemplate = ''
  let idDispatch = ''
  let timestampDispach = ''
  let idDispatchOnlyTemplate = ''
  let idDispatchAttachments = ''

  // Valid cases
  describe('Testing validcases', () => {
    // Template tests
    test('Should post a template to the db', async () => {
      const post = await postTemplate(context, validTemplate)

      idTemplate = post.body._id
      timestampTemplate = post.body.createdTimestamp

      expect(post).resolves
      expect(post.body).toBeTruthy()
      expect(post.status).toEqual(200)
      expect(post.body.name).toBe('Jest Test Template')
      expect(post.body.createdBy).toBe('timetrigger')
      expect(post.body.template).toBe('Et eller annet')
    })

//     test('Should get a template with a given id from the db', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: idTemplate
//       }
//       const get = await getTemplateById(contextModified, apikeyHeader)

//       expect(get).resolves
//       expect(get).toBeTruthy()
//       expect(get.status).toEqual(200)
//       expect(get.body.name).toBe('Jest Test Template')
//       expect(get.body.createdBy).toBe('timetrigger')
//       expect(get.body.template).toBe('Et eller annet')
//     })

//     test('Should get all the templates from the db', async () => {
//       const get = await getTemplates(context, apikeyHeader)

//       expect(get).resolves
//       expect(get).toBeTruthy()
//       expect(get.status).toEqual(200)
//       expect(get.body[0].name).toBe('Jest Test Template')
//       expect(get.body[0].createdBy).toBe('timetrigger')
//       expect(get.body[0].template).toBe('Et eller annet')
//     })

//     test('Should edit a given template', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: idTemplate
//       }

//       request = {
//         headers: {
//           'x-api-key': process.env.APIKEYS_TEST
//         },
//         body: {
//           name: 'Jeg er redigert',
//           template: 'Ja, det er jeg også.'
//         }
//       }

//       const edit = await editTemplate(context, request)

//       expect(edit).resolves
//       expect(edit).toBeTruthy()
//       expect(edit.status).toEqual(200)
//       expect(edit.body.name).not.toEqual('Jest Test Template')
//       expect(edit.body.template).not.toEqual('Et eller annet')
//       expect(edit.body.name).toEqual('Jeg er redigert')
//       expect(edit.body.template).toEqual('Ja, det er jeg også.')
//     })

//     // Dispatch tests
//     // test('Should post a dispatch object to the db with attachments and template', async () => {
//     //   const post = await postDispatches(context, validDispatchBoth)
//     //   console.log(post)
//     //   idDispatch = post.body._id

//     //   expect(post).resolves
//     //   expect(post.body).toBeTruthy()
//     //   expect(post.status).toEqual(200)
//     //   expect(post.body.title).toBe('Parallel test')
//     //   expect(post.body._id).toBe(idDispatch)
//     //   expect.objectContaining(post.body.template)
//     //   expect.arrayContaining(post.body.attachments)
//     // })

//     // test('Should post a dispatch object to the db with attachments', async () => {
//     //   const post = await postDispatches(context, validDispatchAttachments)

//     //   idDispatchAttachments = post.body._id

//     //   expect(post).resolves
//     //   expect(post.body).toBeTruthy()
//     //   expect(post.status).toEqual(200)
//     //   expect(post.body.title).toBe('Parallel test')
//     //   expect(post.body._id).toBe(idDispatchAttachments)
//     //   expect.not.objectContaining(post.body.template)
//     //   expect.arrayContaining(post.body.attachments)
//     // })

//     // test('Should post a dispatch object to the db with template', async () => {
//     //   const post = await postDispatches(context, validDispatchTemplate)

//     //   idDispatchOnlyTemplate = post.body._id

//     //   expect(post).resolves
//     //   expect(post.body).toBeTruthy()
//     //   expect(post.status).toEqual(200)
//     //   expect(post.body.title).toBe('Parallel test')
//     //   expect(post.body._id).toBe(idDispatchOnlyTemplate)
//     //   expect.objectContaining(post.body.template)
//     //   expect.not.arrayContaining(post.body.attachments)
//     // })

//     // test('Should get a dispatch with a given id from the db', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatch
//     //   }

//     //   const get = await getDispachesById(contextModified, apikeyHeader)

//     //   expect(get).resolves
//     //   expect(get).toBeTruthy()
//     //   expect(get.status).toEqual(200)
//     //   expect(get.body._id).toEqual(idDispatch)
//     //   expect(get.body.title).toBe('Parallel test')
//     //   expect.objectContaining(get.body.template)
//     //   expect.arrayContaining(get.body.attachments)
//     // })

//     // test('Should get all the dispatches from the db', async () => {
//     //   const get = await getDispaches(context, apikeyHeader)

//     //   expect(get).resolves
//     //   expect(get).toBeTruthy()
//     //   expect(get.status).toEqual(200)
//     //   expect.arrayContaining(get.body)
//     //   expect(get.body[0]._id).toEqual(idDispatch)
//     //   expect(get.body[1]._id).toEqual(idDispatchAttachments)
//     //   expect(get.body[2]._id).toEqual(idDispatchOnlyTemplate)
//     // })

//     // test('Should edit a given dispatch', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatch
//     //   }

//     //   const edit = await editDispatches(contextModified, validDispatchEdit)

//     //   expect(edit).resolves
//     //   expect(edit).toBeTruthy()
//     //   expect(edit.status).toEqual(200)
//     //   expect(edit.body.status).not.toEqual('notapproved')
//     //   expect(edit.body.status).toEqual('approved')
//     // })

//     // test('Should edit the given dispatch object to inprogress', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatchOnlyTemplate
//     //   }

//     //   const edit = await editDispatches(contextModified, validDispatchEditInprogress)

//     //   expect(edit).resolves
//     //   expect(edit).toBeTruthy()
//     //   expect(edit.status).toEqual(200)
//     //   expect(edit.body.status).not.toEqual('notapproved')
//     //   expect(edit.body.status).toEqual('inprogress')
//     // })

//     // test('Should edit the given dispatch object to approved', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatchAttachments
//     //   }

//     //   const edit = await editDispatches(contextModified, validDispatchEditApproved)

//     //   expect(edit).resolves
//     //   expect(edit).toBeTruthy()
//     //   expect(edit.status).toEqual(200)
//     //   expect(edit.body.status).not.toEqual('notapproved')
//     //   expect(edit.body.status).toEqual('approved')
//     //   expect(edit.body.approvedBy).toEqual('timetrigger')
//     //   expect(edit.body.approvedById).toEqual('timetrigger')
//     //   expect(edit.body.approvedByEmail).toEqual('timetrigger@telemarkfylke.no')
//     // })

//     // test('Should return empty body since theres no approved dispatches with the correct time', async () => {
//     //   const get = await getReadyDispatches(context, apikeyHeader)

//     //   expect(get).resolves
//     //   expect(get).toBeTruthy()
//     //   expect(get.status).toEqual(200)
//     //   expect(get.body).toEqual([])
//     // })

//     // test('Should edit a given dispatch, approvedTimeStamp', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatch
//     //   }

//     //   const edit = await editDispatches(contextModified, validDispatchEditTimestamp)

//     //   expect(edit).resolves
//     //   expect(edit).toBeTruthy()
//     //   expect(edit.status).toEqual(200)
//     //   expect(edit.body.status).toEqual('approved')
//     //   // Denne testen fungerer lokalt, ikke på github pga tidsoner osv.
//     //   // expect(edit.body.approvedTimestamp.toString()).toMatch('Thu Feb 03 2022 10:52:23 GMT+0100 (sentraleuropeisk normaltid)')
//     // })

//     // test('Should return all dispatches with the correct approvedTimestamp', async () => {
//     //   const get = await getReadyDispatches(context, apikeyHeader)

//     //   timestampDispach = get.body[0].e18Job.tasks[3].data.parameter.date

//     //   expect(get).resolves
//     //   expect(get).toBeTruthy()
//     //   expect(get.status).toEqual(200)
//     //   expect(get.body).toBeInstanceOf(Array)
//     //   expect(get.body[0]).toBeInstanceOf(Object)
//     //   expect(get.body[0]._id).toEqual(idDispatch)
//     //   expect(get.body[0].e18Job.tasks).toBeInstanceOf(Array)
//     //   expect(get.body[0].e18Job.tasks).toEqual([
//     //     {
//     //       system: 'p360',
//     //       method: 'SyncPrivatePerson',
//     //       group: 'group2',
//     //       dependencyTag: 'sync',
//     //       data: { ssn: '13374201337' }
//     //     },
//     //     {
//     //       system: 'p360',
//     //       method: 'SyncPrivatePerson',
//     //       group: 'group2',
//     //       dependencyTag: 'sync',
//     //       data: { ssn: '13374201337' }
//     //     },
//     //     {
//     //       system: 'p360',
//     //       method: 'SyncEnterprise',
//     //       group: 'group2',
//     //       dependencyTag: 'sync',
//     //       data: { orgnr: '13374201337' }
//     //     },
//     //     {
//     //       system: 'p360',
//     //       method: 'archive',
//     //       group: 'group1',
//     //       dependencyTag: 'createCaseDocument',
//     //       dependencies: ['sync'],
//     //       data: {
//     //         system: 'masseutsendelse',
//     //         template: 'utsendelsesdokument',
//     //         parameter: {
//     //           accessCode: 'U',
//     //           accessGroup: 'Alle',
//     //           attachments: [
//     //             {
//     //               base64: undefined,
//     //               format: 'pdf',
//     //               title: 'Parallel test',
//     //               versionFormat: 'A'
//     //             }
//     //           ],
//     //           caseNumber: '22/00009',
//     //           contacts: [
//     //             {
//     //               role: 'Mottaker',
//     //               ssn: '13374201337'
//     //             },
//     //             {
//     //               role: 'Mottaker',
//     //               ssn: '13374201337'
//     //             },
//     //             {
//     //               role: 'Mottaker',
//     //               ssn: '13374201337'
//     //             }
//     //           ],
//     //           date: timestampDispach,
//     //           paragraph: '',
//     //           responsiblePersonEmail: 'jest.test@vtfk.no',
//     //           title: 'Parallel test'
//     //         }
//     //       }
//     //     },
//     //     {
//     //       system: 'p360',
//     //       method: 'archive',
//     //       group: 'group3',
//     //       dependencyTag: 'uploadAttachment-1',
//     //       dependencies: ['createCaseDocument'],
//     //       dataMapping: 'parameter.documentNumber=DocumentNumber',
//     //       data: {
//     //         system: 'archive',
//     //         template: 'add-attachment',
//     //         parameter: {
//     //           base64: 'base64',
//     //           format: '.txt',
//     //           secure: false,
//     //           title: 'test',
//     //           versionFormat: 'P'
//     //         }
//     //       }
//     //     },
//     //     {
//     //       system: 'p360',
//     //       method: 'archive',
//     //       group: 'group4',
//     //       dependencies: ['uploadAttachment-1'],
//     //       dataMapping: '{"parameter": { "Documents": [ { "DocumentNumber": "{{DocumentNumber}}" }]}}',
//     //       data: { method: 'DispatchDocuments', service: 'DocumentService' }
//     //     }
//     //   ])
//     //   expect.objectContaining(get.body[0].template)
//     //   expect.arrayContaining(get.body[0].attachments)
//     // })

//     // test('Should complete dispatch object with status approved', async () => {
//     //   const complete = await complteDispatch(context, validDispatchEditApproved)
//     //   expect(complete).resolves
//     //   expect(complete).toBeTruthy()
//     //   expect(complete.status).toEqual(200)
//     //   expect(complete.body.status).not.toEqual('approved')
//     //   expect(complete.body.status).toEqual('completed')
//     // })

//     test('Should call the getblob endpoint correctly', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: 1,
//         name: 'test',
//         file: 'filename.docx'
//       }

//       const get = await getBlob(contextModified, apikeyHeader)

//       expect(get).resolves
//       expect(get).toBeTruthy()
//       expect(get.status).toEqual(200)
//       expect(get.body).toEqual('filename.docx')
//     })
//   })
//   // Invalid cases
//   describe('Testing invalid cases', () => {
//     // Dispatch testes
//     test('Should reject posting a dispatch without template and attachments', async () => {
//       const post = await postDispatches(context, invalidDispatch)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(400)
//     })

//     test('Should reject posting a dispatch because the body is empty', async () => {
//       const post = await postDispatches(context, apikeyHeader)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(400)
//     })

//     test('Should reject posting a dispatch because the dispatch object is missing the archivenumber', async () => {
//       const post = await postDispatches(context, invalidDispatchArchiveNumber)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(400)
//     })

//     test('Should reject posting a dispatch with only attachments because the "AZURE_BLOB_CONNECTIONSTRING_TEST" is missing', async () => {
//       process.env.AZURE_BLOB_CONNECTIONSTRING_TEST = ''

//       const post = await postDispatches(context, validDispatchAttachments)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(500)
//     })

//     test('Should reject posting a dispatch with only attachments because the "AZURE_BLOB_CONTAINERNAME_TEST" is missing', async () => {
//       process.env.AZURE_BLOB_CONTAINERNAME_TEST = ''

//       const post = await postDispatches(context, validDispatchAttachments)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(500)
//     })

//     test('Should reject posting a dispatch with attachments because a file is missing file extension', async () => {
//       const post = await postDispatches(context, invalidDispatchMissingFileExtension)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(500)
//     })

//     test('Should reject posting a dispatch with attachments because a file got an illegal file extension', async () => {
//       const post = await postDispatches(context, invalidDispatchIllegalFileExtension)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(500)
//     })

//     test('Should reject posting a dispatch with attachments becasue a file got an illegal character in the filename', async () => {
//       const post = await postDispatches(context, invalidDispatchIllegalCharacter)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(500)
//     })

//     test('Should not get a dispatch object from the db since theres no id provided', async () => {
//       process.env.ID_DISPATCH_TEST = ''
//       const contextModified = context
//       contextModified.bindingData = {
//         id: ''
//       }

//       const get = await getDispachesById(contextModified, apikeyHeader)

//       expect(get).toBeInstanceOf(Object)
//       expect(get.body.message).toBeDefined()
//       expect(get.status).toEqual(400)
//     })

//     test('Should not get a dispatch object from the db since the id provided dose not exist', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: '61f9502c1a6e890eec90d2b1'
//       }

//       const get = await getDispachesById(contextModified, apikeyHeader)

//       expect(get).toBeInstanceOf(Object)
//       expect(get.body.message).toBeDefined()
//       expect(get.status).toEqual(404)
//     })

//     test('Should not edit a dispatch object since the id provided dose not exist', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: '61f9502c1a6e890eec90d2b1'
//       }

//       request = {
//         headers: {
//           'x-api-key': process.env.APIKEYS_TEST
//         },
//         body: {
//           status: 'Ja, det er jeg også.'
//         }
//       }

//       const edit = await editDispatches(contextModified, request)

//       expect(edit).toBeInstanceOf(Object)
//       expect(edit.body.message).toBeDefined()
//       expect(edit.status).toEqual(404)
//     })

//     // test('Should not edit the given dispatch object since the status is inprogress. Running dispatch should only be set to completed', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatchOnlyTemplate
//     //   }

//     //   const edit = await editDispatches(contextModified, validDispatchAttachments)

//     //   expect(edit).toBeInstanceOf(Object)
//     //   expect(edit.body.message).toBeDefined()
//     //   expect(edit.status).toEqual(404)
//     // })

//     // test('Should not edit the given dispatch object since the status is inprogress. Running dispatch should only be set to completed', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatchOnlyTemplate
//     //   }

//     //   const edit = await editDispatches(contextModified, validDispatchEditInprogress)

//     //   expect(edit).toBeInstanceOf(Object)
//     //   expect(edit.body.message).toBeDefined()
//     //   expect(edit.status).toEqual(400)
//     // })

//     // test('Should reject editing a dispatch with attachments because a file is missing file extension', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatchAttachments
//     //   }

//     //   const edit = await editDispatches(contextModified, invalidDispatchMissingFileExtension)

//     //   expect(edit).toBeInstanceOf(Object)
//     //   expect(edit.body.message).toBeDefined()
//     //   expect(edit.status).toEqual(404)
//     // })

//     // test('Should reject editing a dispatch with attachments because a file got an illegal file extension', async () => {
//     //   const contextModified = context
//     //   contextModified.bindingData = {
//     //     id: idDispatchAttachments
//     //   }

//     //   const edit = await editDispatches(contextModified, invalidDispatchIllegalFileExtension)

//     //   expect(edit).toBeInstanceOf(Object)
//     //   expect(edit.body.message).toBeDefined()
//     //   expect(edit.status).toEqual(404)
//     // })

//     test('Should reject completing a dispatch since there is no id provided', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: ''
//       }

//       const complete = await complteDispatch(contextModified, validDispatchEditApproved)

//       expect(complete).toBeInstanceOf(Object)
//       expect(complete.body.message).toBeDefined()
//       expect(complete.status).toEqual(400)
//     })

//     test('Should reject completing a dispatch since the id provided is not valid', async () => {
//       process.env.ID_DISPATCH_TEST = '61f9502c1a6e890eec90d2b1'
//       const contextModified = context
//       contextModified.bindingData = {
//         id: '61f9502c1a6e890eec90d2b1'
//       }

//       const complete = await complteDispatch(contextModified, validDispatchEditApproved)

//       expect(complete).toBeInstanceOf(Object)
//       expect(complete.body.message).toBeDefined()
//       expect(complete.status).toEqual(404)
//     })

//     test('Should reject completing a dispatch since the dispach status is not set to approved', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: idDispatchOnlyTemplate
//       }

//       const complete = await complteDispatch(contextModified, validDispatchEditApproved)

//       expect(complete).toBeInstanceOf(Object)
//       expect(complete.body.message).toBeDefined()
//       expect(complete.status).toEqual(400)
//     })

//     test('Should not call the matrikkel api since the url is missing', async () => {
//       process.env.MATRIKKEL_BASEURL = ''

//       const get = await getMatrikkel(context, apikeyHeader)

//       expect(get).toBeInstanceOf(Object)
//       expect(get.body.message).toBeDefined()
//       expect(get.status).toEqual(400)
//     })

//     test('Should reject the get blob endpoint request since the id is missing', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: '',
//         name: 'test',
//         file: 'filename.docx'
//       }

//       const get = await getBlob(contextModified, apikeyHeader)

//       expect(get).toBeInstanceOf(Object)
//       expect(get.body.message).toBeDefined()
//       expect(get.status).toEqual(400)
//     })

//     test('Should reject the get blob endpoint request since the name is missing', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: 1,
//         name: '',
//         file: 'filename.docx'
//       }

//       const get = await getBlob(contextModified, apikeyHeader)

//       expect(get).toBeInstanceOf(Object)
//       expect(get.body.message).toBeDefined()
//       expect(get.status).toEqual(400)
//     })

//     test('Should reject the get blob endpoint request since the file is missing', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: 1,
//         name: 'test',
//         file: ''
//       }

//       const get = await getBlob(contextModified, apikeyHeader)

//       expect(get).toBeInstanceOf(Object)
//       expect(get.body.message).toBeDefined()
//       expect(get.status).toEqual(400)
//     })

//     test('Should reject the archive endpoint request since the endpoint url is missing', async () => {
//       process.env.ARCHIVE_ARCHIVE_ENDPOINT = ''

//       const post = await postDispatches(context, validDispatchBoth)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(500)
//     })

//     test('Should reject the archive endpoint request since the endpoint key is missing', async () => {
//       process.env.ARCHIVE_ARCHIVE_SUBSCRIPTION_KEY = ''

//       const post = await postDispatches(context, validDispatchBoth)

//       expect(post).toBeInstanceOf(Object)
//       expect(post.body.message).toBeDefined()
//       expect(post.status).toEqual(500)
//     })

//     // Template tests
//     test('Should not get a template from the db since theres no id provided', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: ''
//       }

//       const get = await getTemplateById(contextModified, apikeyHeader)

//       expect(get).toBeInstanceOf(Object)
//       expect(get.body.message).toBeDefined()
//       expect(get.status).toEqual(400)
//     })

//     test('Should not get a template from the db since the id provided dose not exist', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: '61f9502c1a6e890eec90d2b1'
//       }

//       const get = await getTemplateById(contextModified, apikeyHeader)

//       expect(get).toBeInstanceOf(Object)
//       expect(get.body.message).toBeDefined()
//       expect(get.status).toEqual(400)
//     })

//     test('Should not get a template from the db since theres no id provided', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: ''
//       }

//       request = {
//         headers: {
//           'x-api-key': process.env.APIKEYS_TEST
//         },
//         body: {
//           name: 'Jeg er reddigert',
//           template: 'Ja, det er jeg også.'
//         }
//       }

//       const edit = await editTemplate(contextModified, request)

//       expect(edit).toBeInstanceOf(Object)
//       expect(edit.body.message).toBeDefined()
//       expect(edit.status).toEqual(400)
//     })

//     test('Should not edit a template from the db since the id provided dose not exist', async () => {
//       const contextModified = context
//       contextModified.bindingData = {
//         id: '61f9502c1a6e890eec90d2b1'
//       }

//       request = {
//         headers: {
//           'x-api-key': process.env.APIKEYS_TEST
//         },
//         body: {
//           name: 'Jeg er reddigert',
//           template: 'Ja, det er jeg også.'
//         }
//       }

//       const edit = await editTemplate(contextModified, request)

//       expect(edit).toBeInstanceOf(Object)
//       expect(edit.body.message).toBeDefined()
//       expect(edit.status).toEqual(400)
//     })
  })
})
