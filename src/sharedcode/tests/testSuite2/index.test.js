// Endpoints
const { postTemplate } = require("../../../functions/posttemplate");
const { getTemplateById } = require("../../../functions/gettemplatebyid");
const { getTemplates } = require("../../../functions/gettemplates");
const { putTemplates } = require("../../../functions/puttemplates");
const { postDispatches } = require("../../../functions/postdispatches");
const { getDispatchById } = require("../../../functions/getdispatchbyid");
// const { getDispatches } = require('../../../functions/getdispatches')
const { editDispatches } = require("../../../functions/editdispatches");
// const { getReadyDispatches } = require('../../../functions/getreadydispatchesV2Dev')
const { completeDispatch } = require("../../../functions/completedispatch");
const { getMatrikkel } = require("../../../functions/getmatrikkel");
const { getBlob } = require("../../../functions/getblob");

// Valid test cases
const validTemplate = require("../testCases/validCases/post_template");
const validDispatchBoth = require("../testCases/validCases/post_dispatch_both");
const validDispatchAttachments = require("../testCases/validCases/post_dispatch_attachments");
// const validDispatchTemplate = require('../testCases/validCases/post_dispatch_template')
// const validDispatchEdit = require('../testCases/validCases/edit_dispatch')
// const validDispatchEditInprogress = require('../testCases/validCases/edit_dispatch_inprogress')
const validDispatchEditApproved = require("../testCases/validCases/edit_dispatch_approved");
// const validDispatchEditTimestamp = require('../testCases/validCases/edit_dispatch_approvedTimestamp')

// Invalid test cases
const invalidDispatch = require("../testCases/invalidCases/post_dispatch_missing_template_and_attachments");
const invalidDispatchArchiveNumber = require("../testCases/invalidCases/post_dispatch_missing_archivenumber");
const invalidDispatchMissingFileExtension = require("../testCases/invalidCases/post_dispatch_missing_extension");
const invalidDispatchIllegalFileExtension = require("../testCases/invalidCases/post_dispatch_illegal_extension");
const invalidDispatchIllegalCharacter = require("../testCases/invalidCases/post_dispatch_illegal_character");

// MSW
const { rest } = require("msw");
const { setupServer } = require("msw/node");

// Test setup
const { setupDB } = require("../test-setup");
const context = require("../defaultContext");

setupDB();
jest.setTimeout(15000);

// Tests
describe("Endpoint testing", () => {
  // MSW
  const server = setupServer(
    // getReadyDispatches, Generate PDF from template mock
    rest.post("https://api.vtfk.no/pdf/v1/jestTest", (_req, res, ctx) => {
      return res(
        ctx.status(201),
        ctx.json({
          body: {
            data: {
              tittel: "Parallel test",
              "beskrivelse av prosjekte": "Parallel test",
              fremdrift: "Parallel test",
              Regelverk: "Parallel test"
            },
            base64: { pdfBase64: "En pdfbase64" }
          }
        })
      );
    }),
    // getMatrikkel, mock
    rest.post("https://api.vtfk.no/matrikkel/v1/jestTestjestTest", (_req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          msg: "Matrikkel api successfully connected"
        })
      );
    }),
    // Validate archivenumber, mock
    rest.post("https://api.vtfk.dev/archive/v1/jestTestarchive", (_req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          msg: "Archive api successfully connected"
        })
      );
    })
  );

  // beforeAll(() => server.listen())
  // afterAll(() => server.close())
  // afterEach(() => server.resetHandlers())

  const OLD_ENV_VAR = process.env;

  beforeAll(() => {
    // jest.resetModules() // Clears the cache, remove the // if you want trouble :)
    process.env = { ...OLD_ENV_VAR };
    server.listen();
  });

  afterAll(() => {
    process.env = OLD_ENV_VAR;
    server.close();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  const apikeyHeader = {
    headers: {
      get: (_) => undefined,
      "x-api-key": process.env.APIKEYS_TEST
    }
  };

  // Variables
  let idTemplate = "";
  let _timestampTemplate = "";
  //const idDispatch = ""
  //const timestampDispatch = ""
  const idDispatchOnlyTemplate = "";
  //const idDispatchAttachments = ""

  // Valid cases
  describe("Testing valid cases", () => {
    // Template tests
    test("Should post a template to the db", async () => {
      const post = await postTemplate(validTemplate, context);

      idTemplate = post.jsonBody._id;
      _timestampTemplate = post.jsonBody.createdTimestamp;

      expect(post).resolves;
      expect(post.jsonBody).toBeTruthy();
      expect(post.status).toEqual(200);
      expect(post.jsonBody.name).toBe("Jest Test Template");
      expect(post.jsonBody.createdBy).toBe("timetrigger");
      expect(post.jsonBody.template).toBe("Et eller annet");
    });

    test("Should get a template with a given id from the db", async () => {
      const request = {
        ...apikeyHeader,
        params: {
          id: idTemplate
        },
        json: async () => {
          return {};
        }
      };
      const get = await getTemplateById(request, context);

      expect(get).resolves;
      expect(get).toBeTruthy();
      expect(get.status).toEqual(200);
      expect(get.jsonBody.name).toBe("Jest Test Template");
      expect(get.jsonBody.createdBy).toBe("timetrigger");
      expect(get.jsonBody.template).toBe("Et eller annet");
    });

    test("Should get all the templates from the db", async () => {
      const get = await getTemplates(apikeyHeader, context);

      expect(get).resolves;
      expect(get).toBeTruthy();
      expect(get.status).toEqual(200);
      expect(get.jsonBody[0].name).toBe("Jest Test Template");
      expect(get.jsonBody[0].createdBy).toBe("timetrigger");
      expect(get.jsonBody[0].template).toBe("Et eller annet");
    });

    test("Should edit a given template", async () => {
      const request = {
        headers: {
          get: (_) => undefined,
          "x-api-key": process.env.APIKEYS_TEST
        },
        params: {
          id: idTemplate
        },
        json: async () => {
          return {
            name: "Jeg er redigert",
            template: "Ja, det er jeg også."
          };
        }
      };

      const edit = await putTemplates(request, context);

      expect(edit).resolves;
      expect(edit).toBeTruthy();
      expect(edit.status).toEqual(200);
      expect(edit.jsonBody.name).not.toEqual("Jest Test Template");
      expect(edit.jsonBody.template).not.toEqual("Et eller annet");
      expect(edit.jsonBody.name).toEqual("Jeg er redigert");
      expect(edit.jsonBody.template).toEqual("Ja, det er jeg også.");
    });

    test("Should call the getBlob endpoint correctly", async () => {
      const request = {
        ...apikeyHeader,
        params: {
          id: 1,
          name: "test",
          file: "filename.docx"
        },
        json: async () => {
          return {};
        }
      };

      const get = await getBlob(request, context);

      expect(get).resolves;
      expect(get).toBeTruthy();
      expect(get.status).toEqual(200);
      expect(get.body).toEqual("filename.docx");
    });

    // Dispatch tests
    // test('Should post a dispatch object to the db with attachments and template', async () => {
    //   const post = await postDispatches(validDispatchBoth, context)

    //   idDispatch = post.jsonBody._id

    //   expect(post).resolves
    //   expect(post.jsonBody).toBeTruthy()
    //   expect(post.status).toEqual(200)
    //   expect(post.jsonBody.title).toBe('Parallel test')
    //   expect(post.jsonBody._id).toBe(idDispatch)
    //   expect.objectContaining(post.jsonBody.template)
    //   expect.arrayContaining(post.jsonBody.attachments)
    // })

    // test('Should post a dispatch object to the db with attachments', async () => {
    //   const post = await postDispatches(validDispatchAttachments, context)

    //   idDispatchAttachments = post.jsonBody._id

    //   expect(post).resolves
    //   expect(post.jsonBody).toBeTruthy()
    //   expect(post.status).toEqual(200)
    //   expect(post.jsonBody.title).toBe('Parallel test')
    //   expect(post.jsonBody._id).toBe(idDispatchAttachments)
    //   expect.not.objectContaining(post.jsonBody.template)
    //   expect.arrayContaining(post.jsonBody.attachments)
    // })

    // test('Should post a dispatch object to the db with template', async () => {
    //   const post = await postDispatches(validDispatchTemplate, context)

    //   idDispatchOnlyTemplate = post.jsonBody._id

    //   expect(post).resolves
    //   expect(post.jsonBody).toBeTruthy()
    //   expect(post.status).toEqual(200)
    //   expect(post.jsonBody.title).toBe('Parallel test')
    //   expect(post.jsonBody._id).toBe(idDispatchOnlyTemplate)
    //   expect.objectContaining(post.jsonBody.template)
    //   expect.not.arrayContaining(post.jsonBody.attachments)
    // })

    // test('Should get a dispatch with a given id from the db', async () => {
    //   const contextModified = context
    //   contextModified.bindingData = {
    //     id: idDispatch
    //   }

    //   const get = await getDispatchById(apikeyHeader, contextModified)

    //   expect(get).resolves
    //   expect(get).toBeTruthy()
    //   expect(get.status).toEqual(200)
    //   expect(get.jsonBody._id).toEqual(idDispatch)
    //   expect(get.jsonBody.title).toBe('Parallel test')
    //   expect.objectContaining(get.jsonBody.template)
    //   expect.arrayContaining(get.jsonBody.attachments)
    // })

    // test('Should get all the dispatches from the db', async () => {
    //   const get = await getDispatches(apikeyHeader, context)

    //   expect(get).resolves
    //   expect(get).toBeTruthy()
    //   expect(get.status).toEqual(200)
    //   expect.arrayContaining(get.jsonBody)
    //   expect(get.jsonBody[0]._id).toEqual(idDispatch)
    //   expect(get.jsonBody[1]._id).toEqual(idDispatchAttachments)
    //   expect(get.jsonBody[2]._id).toEqual(idDispatchOnlyTemplate)
    // })

    // test('Should edit a given dispatch', async () => {
    //   const contextModified = context
    //   contextModified.bindingData = {
    //     id: idDispatch
    //   }

    //   const edit = await editDispatches(validDispatchEdit, contextModified)

    //   expect(edit).resolves
    //   expect(edit).toBeTruthy()
    //   expect(edit.status).toEqual(200)
    //   expect(edit.jsonBody.status).not.toEqual('notapproved')
    //   expect(edit.jsonBody.status).toEqual('approved')
    // })

    // test('Should edit the given dispatch object to inprogress', async () => {
    //   const contextModified = context
    //   contextModified.bindingData = {
    //     id: idDispatchOnlyTemplate
    //   }

    //   const edit = await editDispatches(validDispatchEditInprogress, contextModified)

    //   expect(edit).resolves
    //   expect(edit).toBeTruthy()
    //   expect(edit.status).toEqual(200)
    //   expect(edit.jsonBody.status).not.toEqual('notapproved')
    //   expect(edit.jsonBody.status).toEqual('inprogress')
    // })

    // test('Should edit the given dispatch object to approved', async () => {
    //   const contextModified = context
    //   contextModified.bindingData = {
    //     id: idDispatchAttachments
    //   }

    //   const edit = await editDispatches(validDispatchEditApproved, contextModified)

    //   expect(edit).resolves
    //   expect(edit).toBeTruthy()
    //   expect(edit.status).toEqual(200)
    //   expect(edit.jsonBody.status).not.toEqual('notapproved')
    //   expect(edit.jsonBody.status).toEqual('approved')
    //   expect(edit.jsonBody.approvedBy).toEqual('timetrigger')
    //   expect(edit.jsonBody.approvedById).toEqual('timetrigger')
    //   expect(edit.jsonBody.approvedByEmail).toEqual('timetrigger@telemarkfylke.no' || 'timetrigger@vestfoldfylke.no')
    // })

    // test('Should return empty jsonBody since there\'s no approved dispatches with the correct time', async () => {
    //   const get = await getReadyDispatches(apikeyHeader, context)

    //   expect(get).resolves
    //   expect(get).toBeTruthy()
    //   expect(get.status).toEqual(200)
    //   expect(get.jsonBody).toEqual([])
    // })

    // test('Should edit a given dispatch, approvedTimeStamp', async () => {
    //   const contextModified = context
    //   contextModified.bindingData = {
    //     id: idDispatch
    //   }

    //   const edit = await editDispatches(validDispatchEditTimestamp, contextModified)

    //   expect(edit).resolves
    //   expect(edit).toBeTruthy()
    //   expect(edit.status).toEqual(200)
    //   expect(edit.jsonBody.status).toEqual('approved')
    //   // Denne testen fungerer lokalt, ikke på github pga tidssoner osv.
    //   // expect(edit.jsonBody.approvedTimestamp.toString()).toMatch('Thu Feb 03 2022 10:52:23 GMT+0100 (sentraleuropeisk normaltid)')
    // })

    // test('Should return all dispatches with the correct approvedTimestamp', async () => {
    //   const get = await getReadyDispatches(apikeyHeader, context)

    //   timestampDispatch = get.jsonBody[0].e18Job.tasks[3].data.parameter.date

    //   expect(get).resolves
    //   expect(get).toBeTruthy()
    //   expect(get.status).toEqual(200)
    //   expect(get.jsonBody).toBeInstanceOf(Array)
    //   expect(get.jsonBody[0]).toBeInstanceOf(Object)
    //   expect(get.jsonBody[0]._id).toEqual(idDispatch)
    //   expect(get.jsonBody[0].e18Job.tasks).toBeInstanceOf(Array)
    //   expect(get.jsonBody[0].e18Job.tasks).toEqual([
    //     {
    //       system: 'p360',
    //       method: 'SyncPrivatePerson',
    //       group: 'group2',
    //       dependencyTag: 'sync',
    //       data: { ssn: '13374201337' }
    //     },
    //     {
    //       system: 'p360',
    //       method: 'SyncPrivatePerson',
    //       group: 'group2',
    //       dependencyTag: 'sync',
    //       data: { ssn: '13374201337' }
    //     },
    //     {
    //       system: 'p360',
    //       method: 'SyncEnterprise',
    //       group: 'group2',
    //       dependencyTag: 'sync',
    //       data: { orgnr: '13374201337' }
    //     },
    //     {
    //       system: 'p360',
    //       method: 'archive',
    //       group: 'group1',
    //       dependencyTag: 'createCaseDocument',
    //       dependencies: ['sync'],
    //       data: {
    //         system: 'masseutsendelse',
    //         template: 'utsendelsesdokument',
    //         parameter: {
    //           accessCode: 'U',
    //           accessGroup: 'Alle',
    //           attachments: [
    //             {
    //               base64: undefined,
    //               format: 'pdf',
    //               title: 'Parallel test',
    //               versionFormat: 'A'
    //             }
    //           ],
    //           caseNumber: '22/00009',
    //           contacts: [
    //             {
    //               role: 'Mottaker',
    //               ssn: '13374201337'
    //             },
    //             {
    //               role: 'Mottaker',
    //               ssn: '13374201337'
    //             },
    //             {
    //               role: 'Mottaker',
    //               ssn: '13374201337'
    //             }
    //           ],
    //           date: timestampDispatch,
    //           paragraph: '',
    //           responsiblePersonEmail: 'jest.test@vtfk.no',
    //           title: 'Parallel test'
    //         }
    //       }
    //     },
    //     {
    //       system: 'p360',
    //       method: 'archive',
    //       group: 'group3',
    //       dependencyTag: 'uploadAttachment-1',
    //       dependencies: ['createCaseDocument'],
    //       dataMapping: 'parameter.documentNumber=DocumentNumber',
    //       data: {
    //         system: 'archive',
    //         template: 'add-attachment',
    //         parameter: {
    //           base64: 'base64',
    //           format: '.txt',
    //           secure: false,
    //           title: 'test',
    //           versionFormat: 'P'
    //         }
    //       }
    //     },
    //     {
    //       system: 'p360',
    //       method: 'archive',
    //       group: 'group4',
    //       dependencies: ['uploadAttachment-1'],
    //       dataMapping: '{"parameter": { "Documents": [ { "DocumentNumber": "{{DocumentNumber}}" }]}}',
    //       data: { method: 'DispatchDocuments', service: 'DocumentService' }
    //     }
    //   ])
    //   expect.objectContaining(get.jsonBody[0].template)
    //   expect.arrayContaining(get.jsonBody[0].attachments)
    // })

    // test('Should complete dispatch object with status approved', async () => {
    //   const complete = await completeDispatch(validDispatchEditApproved, context)
    //   console.log(complete)
    //   expect(complete).resolves
    //   expect(complete).toBeTruthy()
    //   expect(complete.status).toEqual(200)
    //   expect(complete.jsonBody.status).not.toEqual('approved')
    //   expect(complete.jsonBody.status).toEqual('completed')
    // })

    // test('Should call the get matrikkel endpoint correctly', async () => {
    //   const contextModified = context
    //   contextModified.bindingData = {
    //     endpoint: 'jestTest'
    //   }

    //   const get = await getMatrikkel(apikeyHeader, contextModified)

    //   expect(get).resolves
    //   expect(get).toBeTruthy()
    //   expect(get.status).toEqual(200)
    //   expect(get.jsonBody.msg).toEqual('Matrikkel api successfully connected')
    // })
  });

  // Invalid cases
  describe("Testing invalid cases", () => {
    // Dispatch testes
    test("Should reject posting a dispatch without template and attachments", async () => {
      const post = await postDispatches(invalidDispatch, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(400);
    });

    test("Should reject posting a dispatch because the jsonBody is empty", async () => {
      const post = await postDispatches(apikeyHeader, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(400);
    });

    test("Should reject posting a dispatch because the dispatch object is missing the archivenumber", async () => {
      const post = await postDispatches(invalidDispatchArchiveNumber, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(400);
    });

    test('Should reject posting a dispatch with only attachments because the "AZURE_BLOB_CONNECTIONSTRING_TEST" is missing', async () => {
      process.env.AZURE_BLOB_CONNECTIONSTRING_TEST = "";

      const post = await postDispatches(validDispatchAttachments, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(500);
    });

    test('Should reject posting a dispatch with only attachments because the "AZURE_BLOB_CONTAINERNAME_TEST" is missing', async () => {
      process.env.AZURE_BLOB_CONTAINERNAME_TEST = "";

      const post = await postDispatches(validDispatchAttachments, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(500);
    });

    test("Should reject posting a dispatch with attachments because a file is missing file extension", async () => {
      const post = await postDispatches(invalidDispatchMissingFileExtension, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(500);
    });

    test("Should reject posting a dispatch with attachments because a file got an illegal file extension", async () => {
      const post = await postDispatches(invalidDispatchIllegalFileExtension, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(500);
    });

    test("Should reject posting a dispatch with attachments because a file got an illegal character in the filename", async () => {
      const post = await postDispatches(invalidDispatchIllegalCharacter, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(500);
    });

    test("Should not get a dispatch object from the db since theres no id provided", async () => {
      process.env.ID_DISPATCH_TEST = "";
      const request = {
        ...apikeyHeader,
        params: {
          id: ""
        },
        json: async () => {
          return {};
        }
      };

      const get = await getDispatchById(request, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(400);
    });

    test("Should not get a dispatch object from the db since the id provided dose not exist", async () => {
      const request = {
        ...apikeyHeader,
        params: {
          id: "61f9502c1a6e890eec90d2b1"
        },
        json: async () => {
          return {};
        }
      };

      const get = await getDispatchById(request, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(404);
    });

    test("Should not edit a dispatch object since the id provided dose not exist", async () => {
      const request = {
        headers: {
          get: (_) => undefined,
          "x-api-key": process.env.APIKEYS_TEST
        },
        params: {
          id: "61f9502c1a6e890eec90d2b1"
        },
        json: async () => {
          return {
            status: "Ja, det er jeg også."
          };
        }
      };

      const edit = await editDispatches(request, context);

      expect(edit).toBeInstanceOf(Object);
      expect(edit.jsonBody).toBeDefined();
      expect(edit.status).toEqual(404);
    });

    /*// test('Should not edit the given dispatch object since the status is inprogress. Running dispatch should only be set to completed', async () => {
		//   const contextModified = context
		//   contextModified.bindingData = {
		//     id: idDispatchOnlyTemplate
		//   }

		//   const edit = await editDispatches(validDispatchAttachments, contextModified)

		//   expect(edit).toBeInstanceOf(Object)
		//   expect(edit.jsonBody.message).toBeDefined()
		//   expect(edit.status).toEqual(404)
		// })

		// test('Should not edit the given dispatch object since the status is inprogress. Running dispatch should only be set to completed', async () => {
		//   const contextModified = context
		//   contextModified.bindingData = {
		//     id: idDispatchOnlyTemplate
		//   }

		//   const edit = await editDispatches(validDispatchEditInprogress, contextModified)

		//   expect(edit).toBeInstanceOf(Object)
		//   expect(edit.jsonBody.message).toBeDefined()
		//   expect(edit.status).toEqual(404)
		// })

		// test('Should reject editing a dispatch with attachments because a file is missing file extension', async () => {
		//   const contextModified = context
		//   contextModified.bindingData = {
		//     id: idDispatchAttachments
		//   }

		//   const edit = await editDispatches(invalidDispatchMissingFileExtension, contextModified)

		//   expect(edit).toBeInstanceOf(Object)
		//   expect(edit.jsonBody.message).toBeDefined()
		//   expect(edit.status).toEqual(404)
		// })

		// test('Should reject editing a dispatch with attachments because a file got an illegal file extension', async () => {
		//   const contextModified = context
		//   contextModified.bindingData = {
		//     id: idDispatchAttachments
		//   }

		//   const edit = await editDispatches(invalidDispatchIllegalFileExtension, contextModified)

		//   expect(edit).toBeInstanceOf(Object)
		//   expect(edit.jsonBody.message).toBeDefined()
		//   expect(edit.status).toEqual(404)
		// })*/

    test("Should reject completing a dispatch since there is no id provided", async () => {
      const request = {
        ...validDispatchEditApproved,
        params: {
          id: ""
        },
        json: async () => {
          return {};
        }
      };

      const complete = await completeDispatch(request, context);

      expect(complete).toBeInstanceOf(Object);
      expect(complete.jsonBody).toBeDefined();
      expect(complete.status).toEqual(400);
    });

    test("Should reject completing a dispatch since the id provided is not valid", async () => {
      process.env.ID_DISPATCH_TEST = "61f9502c1a6e890eec90d2b1";
      const request = {
        ...validDispatchEditApproved,
        params: {
          id: "61f9502c1a6e890eec90d2b1"
        },
        json: async () => {
          return {};
        }
      };

      const complete = await completeDispatch(request, context);

      expect(complete).toBeInstanceOf(Object);
      expect(complete.jsonBody).toBeDefined();
      expect(complete.status).toEqual(404);
    });

    test("Should reject completing a dispatch since the dispatch status is not set to approved", async () => {
      const request = {
        ...validDispatchEditApproved,
        params: {
          id: idDispatchOnlyTemplate
        },
        json: async () => {
          return {};
        }
      };

      const complete = await completeDispatch(request, context);

      expect(complete).toBeInstanceOf(Object);
      expect(complete.jsonBody).toBeDefined();
      expect(complete.status).toEqual(400);
    });

    test("Should not call the matrikkel api since the url is missing", async () => {
      process.env.VTFK_MATRIKKELPROXY_BASEURL = "";

      const get = await getMatrikkel(apikeyHeader, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(400);
    });

    test("Should not call the matrikkel api since the apikey is missing", async () => {
      process.env.VTFK_MATRIKKELPROXY_APIKEY = "";

      const get = await getMatrikkel(apikeyHeader, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(400);
    });

    test("Should reject the get blob endpoint request since the id is missing", async () => {
      const request = {
        ...apikeyHeader,
        params: {
          id: "",
          name: "test",
          file: "filename.docx"
        },
        json: async () => {
          return {};
        }
      };

      const get = await getBlob(request, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(400);
    });

    test("Should reject the get blob endpoint request since the name is missing", async () => {
      const request = {
        ...apikeyHeader,
        params: {
          id: 1,
          name: "",
          file: "filename.docx"
        },
        json: async () => {
          return {};
        }
      };

      const get = await getBlob(request, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(400);
    });

    test("Should reject the get blob endpoint request since the file is missing", async () => {
      const request = {
        ...apikeyHeader,
        params: {
          id: 1,
          name: "test",
          file: ""
        },
        json: async () => {
          return {};
        }
      };

      const get = await getBlob(request, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(400);
    });

    test("Should reject the archive endpoint request since the endpoint url is missing", async () => {
      process.env.VTFK_P360_ARCHIVE_ENDPOINT = "";

      const post = await postDispatches(validDispatchBoth, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(500);
    });

    test("Should reject the archive endpoint request since the endpoint key is missing", async () => {
      process.env.VTFK_P360_ARCHIVE_SUBSCRIPTION_KEY = "";

      const post = await postDispatches(validDispatchBoth, context);

      expect(post).toBeInstanceOf(Object);
      expect(post.jsonBody).toBeDefined();
      expect(post.status).toEqual(500);
    });

    // Template tests
    test("Should not get a template from the db since theres no id provided", async () => {
      const request = {
        ...apikeyHeader,
        params: {
          id: ""
        },
        json: async () => {
          return {};
        }
      };

      const get = await getTemplateById(request, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(400);
    });

    test("Should not get a template from the db since the id provided dose not exist", async () => {
      const request = {
        ...apikeyHeader,
        params: {
          id: "61f9502c1a6e890eec90d2b1"
        },
        json: async () => {
          return {};
        }
      };

      const get = await getTemplateById(request, context);

      expect(get).toBeInstanceOf(Object);
      expect(get.jsonBody).toBeDefined();
      expect(get.status).toEqual(400);
    });

    test("Should not get a template from the db since theres no id provided", async () => {
      const request = {
        headers: {
          "x-api-key": process.env.APIKEYS_TEST
        },
        params: {
          id: ""
        },
        json: async () => {
          return {
            name: "Jeg er reddigert",
            template: "Ja, det er jeg også."
          };
        }
      };

      const edit = await putTemplates(request, context);

      expect(edit).toBeInstanceOf(Object);
      expect(edit.jsonBody).toBeDefined();
      expect(edit.status).toEqual(400);
    });

    test("Should not edit a template from the db since the id provided does not exist", async () => {
      const request = {
        headers: {
          "x-api-key": process.env.APIKEYS_TEST
        },
        params: {
          id: "61f9502c1a6e890eec90d2b1"
        },
        json: async () => {
          return {
            name: "Jeg er reddigert",
            template: "Ja, det er jeg også."
          };
        }
      };

      const edit = await putTemplates(request, context);

      expect(edit).toBeInstanceOf(Object);
      expect(edit.jsonBody).toBeDefined();
      expect(edit.status).toEqual(400);
    });
  });
});
