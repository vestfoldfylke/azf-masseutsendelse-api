const { describe, test, before, after, afterEach } = require("node:test");
const assert = require("node:assert");

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

  const OLD_ENV_VAR = process.env;

  before(() => {
    // jest.resetModules() // Clears the cache, remove the // if you want trouble :)
    process.env = { ...OLD_ENV_VAR };
    server.listen();
  });

  after(() => {
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

      assert.ok(post);
      assert.ok(post.jsonBody);
      assert.strictEqual(post.status, 200);
      assert.strictEqual(post.jsonBody.name, "Jest Test Template");
      assert.strictEqual(post.jsonBody.createdBy, "timetrigger");
      assert.strictEqual(post.jsonBody.template, "Et eller annet");
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

      assert.ok(get);
      assert.strictEqual(get.status, 200);
      assert.strictEqual(get.jsonBody.name, "Jest Test Template");
      assert.strictEqual(get.jsonBody.createdBy, "timetrigger");
      assert.strictEqual(get.jsonBody.template, "Et eller annet");
    });

    test("Should get all the templates from the db", async () => {
      const get = await getTemplates(apikeyHeader, context);

      assert.ok(get);
      assert.strictEqual(get.status, 200);
      assert.strictEqual(get.jsonBody[0].name, "Jest Test Template");
      assert.strictEqual(get.jsonBody[0].createdBy, "timetrigger");
      assert.strictEqual(get.jsonBody[0].template, "Et eller annet");
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

      assert.ok(edit);
      assert.strictEqual(edit.status, 200);
      assert.notStrictEqual(edit.jsonBody.name, "Jest Test Template");
      assert.notStrictEqual(edit.jsonBody.template, "Et eller annet");
      assert.strictEqual(edit.jsonBody.name, "Jeg er redigert");
      assert.strictEqual(edit.jsonBody.template, "Ja, det er jeg også.");
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

      assert.ok(get);
      assert.strictEqual(get.status, 200);
      assert.strictEqual(get.body, "filename.docx");
    });
  });

  // Invalid cases
  describe("Testing invalid cases", () => {
    // Dispatch tests
    test("Should reject posting a dispatch without template and attachments", async () => {
      const post = await postDispatches(invalidDispatch, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 400);
    });

    test("Should reject posting a dispatch because the jsonBody is empty", async () => {
      const post = await postDispatches(apikeyHeader, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 400);
    });

    test("Should reject posting a dispatch because the dispatch object is missing the archivenumber", async () => {
      const post = await postDispatches(invalidDispatchArchiveNumber, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 400);
    });

    test('Should reject posting a dispatch with only attachments because the "AZURE_BLOB_CONNECTIONSTRING_TEST" is missing', async () => {
      process.env.AZURE_BLOB_CONNECTIONSTRING_TEST = "";

      const post = await postDispatches(validDispatchAttachments, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 500);
    });

    test('Should reject posting a dispatch with only attachments because the "AZURE_BLOB_CONTAINERNAME_TEST" is missing', async () => {
      process.env.AZURE_BLOB_CONTAINERNAME_TEST = "";

      const post = await postDispatches(validDispatchAttachments, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 500);
    });

    test("Should reject posting a dispatch with attachments because a file is missing file extension", async () => {
      const post = await postDispatches(invalidDispatchMissingFileExtension, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 500);
    });

    test("Should reject posting a dispatch with attachments because a file got an illegal file extension", async () => {
      const post = await postDispatches(invalidDispatchIllegalFileExtension, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 500);
    });

    test("Should reject posting a dispatch with attachments because a file got an illegal character in the filename", async () => {
      const post = await postDispatches(invalidDispatchIllegalCharacter, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 500);
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

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 400);
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

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 404);
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

      assert.ok(edit);
      assert.notStrictEqual(edit.jsonBody, undefined);
      assert.strictEqual(edit.status, 404);
    });

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

      assert.ok(complete);
      assert.notStrictEqual(complete.jsonBody, undefined);
      assert.strictEqual(complete.status, 400);
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

      assert.ok(complete);
      assert.notStrictEqual(complete.jsonBody, undefined);
      assert.strictEqual(complete.status, 404);
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

      assert.ok(complete);
      assert.notStrictEqual(complete.jsonBody, undefined);
      assert.strictEqual(complete.status, 400);
    });

    test("Should not call the matrikkel api since the url is missing", async () => {
      process.env.VTFK_MATRIKKELPROXY_BASEURL = "";

      const get = await getMatrikkel(apikeyHeader, context);

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 400);
    });

    test("Should not call the matrikkel api since the apikey is missing", async () => {
      process.env.VTFK_MATRIKKELPROXY_APIKEY = "";

      const get = await getMatrikkel(apikeyHeader, context);

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 400);
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

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 400);
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

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 400);
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

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 400);
    });

    test("Should reject the archive endpoint request since the endpoint url is missing", async () => {
      process.env.VTFK_P360_ARCHIVE_ENDPOINT = "";

      const post = await postDispatches(validDispatchBoth, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 500);
    });

    test("Should reject the archive endpoint request since the endpoint key is missing", async () => {
      process.env.VTFK_P360_ARCHIVE_SUBSCRIPTION_KEY = "";

      const post = await postDispatches(validDispatchBoth, context);

      assert.ok(post);
      assert.notStrictEqual(post.jsonBody, undefined);
      assert.strictEqual(post.status, 500);
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

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 400);
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

      assert.ok(get);
      assert.notStrictEqual(get.jsonBody, undefined);
      assert.strictEqual(get.status, 400);
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

      assert.ok(edit);
      assert.notStrictEqual(edit.jsonBody, undefined);
      assert.strictEqual(edit.status, 400);
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

      assert.ok(edit);
      assert.notStrictEqual(edit.jsonBody, undefined);
      assert.strictEqual(edit.status, 400);
    });
  });
});
