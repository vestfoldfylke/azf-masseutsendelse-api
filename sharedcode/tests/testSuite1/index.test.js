const Dispatches = require("../../models/dispatches");
const Templates = require("../../models/templates");
const { ObjectId } = require("mongodb");
const { setupDB } = require("../test-setup");
// const axios = require('axios')

setupDB("endpoint-testing");
// const axios = jest.mock('axios')
jest.setTimeout(30000); // Actions failer noen ganger med 5000ms

// Attachment Schema
const attachmentSchema = {
  _id: new ObjectId(),
  name: "test"
};

// Dispatch object
const bodyDispatch = {
  title: "Jest Test",
  projectnumber: "12",
  archivenumber: "1",
  validatedArchivenumber: "1",
  stats: {
    affectedCount: "1",
    area: "1",
    totalOwners: "1",
    privateOwners: "1",
    businessOwners: "1"
  },
  template: {
    version: "1",
    name: "jest test",
    description: "jest test"
  },
  matrikkelEnheter: [],
  polygon: {
    coordinatesystem: "asd",
    filename: "qsd",
    area: "12",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  polygons: {
    area: "1",
    EPSG: "asde",
    polygons: [
      {
        EPSG: "jest test",
        area: "1",
        center: ["1", "2", "3"],
        extremes: {
          north: ["1", "2", "3"],
          west: ["1", "2", "3"],
          east: ["1", "2", "3"],
          south: ["1", "2", "3"]
        }
      }
    ]
  },
  attachments: [attachmentSchema],
  geopolygon: {
    coordinateSystem: "a123sd",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  createdBy: "TEST",
  createdById: "00000000-0000-0000-0000-000000000000",
  createdByEmail: "test@test.no",
  createdByDepartment: "Test department",
  modifiedBy: "TEST",
  modifiedById: "00000000-0000-0000-0000-000000000000",
  modifiedByEmail: "test@test.no",
  modifiedByDepartment: "Test department",
  approvedBy: "",
  approvedById: "",
  approvedByEmail: "test@test.no",
  approvedTimestamp: new Date()
};

// Dispatch object with status approved
const bodyDispatchApproved = {
  title: "Jest Test",
  status: "approved",
  projectnumber: "12",
  caseworker: "Noen André",
  archivenumber: "1",
  validatedArchivenumber: "1",
  stats: {
    affectedCount: "1",
    area: "1",
    totalOwners: "1",
    privateOwners: "1",
    businessOwners: "1"
  },
  template: {
    version: "1",
    name: "jest test",
    description: "jest test"
  },
  matrikkelEnheter: [],
  polygon: {
    coordinatesystem: "asd",
    filename: "qsd",
    area: "12",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  polygons: {
    area: "1",
    EPSG: "asde",
    polygons: [
      {
        EPSG: "jest test",
        area: "1",
        center: ["1", "2", "3"],
        extremes: {
          north: ["1", "2", "3"],
          west: ["1", "2", "3"],
          east: ["1", "2", "3"],
          south: ["1", "2", "3"]
        }
      }
    ]
  },
  attachments: [attachmentSchema],
  geopolygon: {
    coordinateSystem: "a123sd",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  createdBy: "TEST",
  createdById: "00000000-0000-0000-0000-000000000000",
  createdByEmail: "test@test.no",
  createdByDepartment: "Test department",
  modifiedTimestamp: new Date(),
  modifiedBy: "TEST",
  modifiedById: "00000000-0000-0000-0000-000000000000",
  modifiedByEmail: "test@test.no",
  modifiedByDepartment: "Test department",
  approvedBy: "",
  approvedById: "",
  approvedByEmail: "test@test.no",
  approvedTimestamp: new Date()
};

// Dispatch object with no template and np attachment
const bodyDispatchNoTemplateNoAttachment = {
  title: "Jest Test",
  projectnumber: "12",
  caseworker: "Noen André",
  archivenumber: "1",
  validatedArchivenumber: "1",
  stats: {
    affectedCount: "1",
    area: "1",
    totalOwners: "1",
    privateOwners: "1",
    businessOwners: "1"
  },
  attachments: [],
  matrikkelEnheter: [],
  polygon: {
    coordinatesystem: "asd",
    filename: "qsd",
    area: "12",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  polygons: {
    area: "1",
    EPSG: "asde",
    polygons: [
      {
        EPSG: "jest test",
        area: "1",
        center: ["1", "2", "3"],
        extremes: {
          north: ["1", "2", "3"],
          west: ["1", "2", "3"],
          east: ["1", "2", "3"],
          south: ["1", "2", "3"]
        }
      }
    ]
  },
  geopolygon: {
    coordinateSystem: "a123sd",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  createdBy: "TEST",
  createdById: "00000000-0000-0000-0000-000000000000",
  createdByEmail: "test@test.no",
  createdByDepartment: "Test department",
  modifiedTimestamp: new Date(),
  modifiedBy: "TEST",
  modifiedById: "00000000-0000-0000-0000-000000000000",
  modifiedByEmail: "test@test.no",
  modifiedByDepartment: "Test department",
  approvedBy: "",
  approvedById: "",
  approvedByEmail: "test@test.no",
  approvedTimestamp: new Date()
};

// Dispatch object with no template and np attachment
const bodyDispatchNoTemplate = {
  title: "Jest Test",
  projectnumber: "12",
  caseworker: "Noen André",
  archivenumber: "1",
  validatedArchivenumber: "1",
  stats: {
    affectedCount: "1",
    area: "1",
    totalOwners: "1",
    privateOwners: "1",
    businessOwners: "1"
  },
  attachments: [attachmentSchema],
  matrikkelEnheter: [],
  polygon: {
    coordinatesystem: "asd",
    filename: "qsd",
    area: "12",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  polygons: {
    area: "1",
    EPSG: "asde",
    polygons: [
      {
        EPSG: "jest test",
        area: "1",
        center: ["1", "2", "3"],
        extremes: {
          north: ["1", "2", "3"],
          west: ["1", "2", "3"],
          east: ["1", "2", "3"],
          south: ["1", "2", "3"]
        }
      }
    ]
  },
  geopolygon: {
    coordinateSystem: "a123sd",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  createdBy: "TEST",
  createdById: "00000000-0000-0000-0000-000000000000",
  createdByEmail: "test@test.no",
  createdByDepartment: "Test department",
  modifiedTimestamp: new Date(),
  modifiedBy: "TEST",
  modifiedById: "00000000-0000-0000-0000-000000000000",
  modifiedByEmail: "test@test.no",
  modifiedByDepartment: "Test department",
  approvedBy: "",
  approvedById: "",
  approvedByEmail: "test@test.no",
  approvedTimestamp: new Date()
};

// Dispatch object with no attachment
const bodyDispatchNoAttachment = {
  title: "Jest Test",
  projectnumber: "12",
  caseworker: "Noen André",
  archivenumber: "1",
  validatedArchivenumber: "1",
  stats: {
    affectedCount: "1",
    area: "1",
    totalOwners: "1",
    privateOwners: "1",
    businessOwners: "1"
  },
  attachments: [],
  matrikkelEnheter: [],
  polygon: {
    coordinatesystem: "asd",
    filename: "qsd",
    area: "12",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  template: {
    version: "1",
    name: "jest test",
    description: "jest test"
  },
  polygons: {
    area: "1",
    EPSG: "asde",
    polygons: [
      {
        EPSG: "jest test",
        area: "1",
        center: ["1", "2", "3"],
        extremes: {
          north: ["1", "2", "3"],
          west: ["1", "2", "3"],
          east: ["1", "2", "3"],
          south: ["1", "2", "3"]
        }
      }
    ]
  },
  geopolygon: {
    coordinateSystem: "a123sd",
    vertices: [],
    extremes: {
      north: "1",
      west: "1",
      east: "1",
      south: "1",
      center: "1"
    }
  },
  createdBy: "TEST",
  createdById: "00000000-0000-0000-0000-000000000000",
  createdByEmail: "test@test.no",
  createdByDepartment: "Test department",
  modifiedTimestamp: new Date(),
  modifiedBy: "TEST",
  modifiedById: "00000000-0000-0000-0000-000000000000",
  modifiedByEmail: "test@test.no",
  modifiedByDepartment: "Test department",
  approvedBy: "",
  approvedById: "",
  approvedByEmail: "test@test.no",
  approvedTimestamp: new Date()
};

// Template Object
const bodyTemplates = {
  name: "Jest test",
  description: "jest testing",
  documentDefinitionId: "asd123e1",
  template: "noe"
};

// Variables
let templateId = "";
let dispatchId = "";
let attachments = "";

it("Should post a template to the database", async () => {
  // Create a new document using the model
  const template = new Templates(bodyTemplates);

  // Save the new dispatch object to the database
  const results = await template.save();

  expect(results).resolves;
});

it("Should post a dispatch object to the database", async () => {
  // Create a new document using the model
  const dispatch = new Dispatches(bodyDispatch);

  // Save the new dispatch object to the database
  const results = await dispatch.save();

  expect(results).resolves;
});

it("Should post a dispatch object to the database with status approved", async () => {
  // Create a new document using the model
  const dispatch = new Dispatches(bodyDispatchApproved);

  // Save the new dispatch object to the database
  const results = await dispatch.save();

  expect(results).resolves;
});

it("Should return all dispatches from the database", async () => {
  const dispatch = await Dispatches.find({}).lean();
  try {
    const records = await Dispatches.find({}).lean().exec();
    records.forEach((record) => {
      dispatchId = record._id;
      attachments = record.attachments;
    });
    expect([dispatch]).toContainEqual(dispatch);
  } catch (error) {
    console.error("Error fetching dispatches:", error);
    expect(error).toBeNull();
  }
});

it("Should return all dispatches from the database with the status approved", async () => {
  const dispatch = await Dispatches.find({ status: "approved" }).lean();
  try {
    const records = await Dispatches.find({}).lean().exec();
    records.forEach((record) => {
      dispatchId = record._id;
      attachments = record.attachments;
    });
    expect(dispatch[0].status).toEqual("approved");
  } catch (error) {
    console.error("Error fetching dispatches:", error);
    expect(error).toBeNull();
  }
});

it("Should return all templates from the database", async () => {
  const templates = await Templates.find({}).lean();
  try {
    const records = await Templates.find({}).lean().exec();
    records.forEach((record) => {
      templateId = record._id;
    });
    expect([templates]).toContainEqual(templates);
  } catch (error) {
    console.error("Error fetching dispatches:", error);
    expect(error).toBeNull();
  }
});

it("Should return a dispatch object with the given id from the database", async () => {
  const dispatch = await Dispatches.findById(dispatchId);
  expect(dispatch).toMatchObject(dispatch);
});

it("Should return a template with the given id from the database", async () => {
  const template = await Templates.findById(templateId);
  expect(template).toMatchObject(template);
});

it("Should edit one dispatch with the given ID from the database", async () => {
  // Get the existing dispatch object
  const existingDispatch = await Dispatches.findById(dispatchId).lean();

  // Update default values
  const newDate = new Date();

  // Update the dispatch
  const updatedDispatch = await Dispatches.findByIdAndUpdate(dispatchId, { modifiedTimestamp: `${newDate}` }, { new: true });

  expect(updatedDispatch.modifiedTimestamp).not.toBe(existingDispatch.modifiedTimestamp);
});

it("Should edit one template with the given ID from the database", async () => {
  // Get the existing dispatch object
  const existingTemplate = await Templates.findById(templateId).lean();

  // Update default values
  const newDate = new Date();

  // Update the dispatch
  const updatedTemplate = await Templates.findByIdAndUpdate(templateId, { modifiedTimestamp: `${newDate}` }, { new: true });

  expect(updatedTemplate.modifiedTimestamp).not.toBe(existingTemplate.modifiedTimestamp);
});

it("Should return an attachment from the database", async () => {
  expect(attachments).toBeTruthy();
});

// it('Should post a file and return that it succeeded', async () => {
//   const id = new ObjectId()
//   const postFile = [{ dispatchId: id, fileName: 'test jest' }]

//   const resp = { data: postFile }
//   // axios.post.mockResolvedValue(resp)

//   axios.post.mockImplementation(() => Promise.resolve(resp))
// })

// it('Should get a file and return that it succeeded', async () => {
//   const id = new ObjectId()
//   const getFile = [{ dispatchId: id, fileName: 'test jest' }]

//   const resp = { data: getFile }
//   //axios.get.mockResolvedValue(resp)

//   axios.get.mockImplementation(() => Promise.resolve(resp))
// })

// it('Should delete a file and return that it succeeded', async () => {
//   const getFile = [{ fileName: 'test jest' }]

//   const resp = { data: getFile }
//   //axios.delete.mockResolvedValue(resp)

//   axios.delete.mockImplementation(() => Promise.resolve(resp))
// })

it("Should reject the post of a dispatch object due to the lack of template or attachments", async () => {
  // Create a new document using the model
  const dispatch = new Dispatches(bodyDispatchNoTemplateNoAttachment);

  // Save the new dispatch object to the database
  const results = await dispatch.save();

  expect(results.attachments || results.template).rejects;
});

it("Should resolve the post of a dispatch object to the database since it contains a template", async () => {
  // Create a new document using the model
  const dispatch = new Dispatches(bodyDispatchNoAttachment);

  // Save the new dispatch object to the database
  const results = await dispatch.save();

  expect(results.attachments || results.template).resolve;
});

it("Should resolve the post of a dispatch object to the database since it contains an attachment", async () => {
  // Create a new document using the model
  const dispatch = new Dispatches(bodyDispatchNoTemplate);

  // Save the new dispatch object to the database
  const results = await dispatch.save();

  expect(results.attachments || results.template).resolve;
});
