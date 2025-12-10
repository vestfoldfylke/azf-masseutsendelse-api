const mongoose = require("mongoose");

/*
  Subschemas
*/
// Dispatch template
const dispatchTemplateSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  language: {
    type: String
  },
  documentDefinitionId: {
    type: String
  },
  documentData: {
    type: Object
  },
  data: {
    type: Object
  },
  template: {
    type: String
  }
});

// Polygon
const polygonSchema = new mongoose.Schema({
  EPSG: {
    type: String,
    required: true
  },
  area: {
    type: Number,
    required: true
  },
  center: {
    type: [Number],
    required: true
  },
  extremes: {
    north: {
      type: [Number],
      required: true
    },
    west: {
      type: [Number],
      required: true
    },
    east: {
      type: [Number],
      required: true
    },
    south: {
      type: [Number],
      required: true
    }
  },
  vertices: []
});

// Attachment
const attachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    type: String,
    size: Number,
    lastModified: Number,
    lastModifiedDate: String
  },
  { _id: false }
);
/*
  Model schema
*/
const dispatchesSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  projectnumber: {
    type: String,
    required: true
  },
  archivenumber: {
    type: String,
    required: true
  },
  validatedArchivenumber: {
    type: String,
    required: true
  },
  archiveUrl: {
    type: String
  },
  status: {
    type: String,
    default: "notapproved",
    enum: ["notapproved", "approved", "inprogress", "completed"],
    required: true
  },
  template: {
    type: dispatchTemplateSchema
  },
  templateData: {
    Object
  },
  attachments: [attachmentSchema],
  stats: {
    affectedCount: {
      type: Number,
      required: true
    },
    area: {
      type: Number,
      required: false
    },
    totalOwners: {
      type: Number,
      required: true
    },
    privateOwners: {
      type: Number,
      required: true
    },
    businessOwners: {
      type: Number,
      required: true
    }
  },
  owners: {
    required: true,
    type: [Object]
  },
  excludedOwners: {
    type: [Object]
  },
  matrikkelUnitsWithoutOwners: {
    type: [Object]
  },
  polygons: {
    EPSG: {
      type: String,
      required: true
    },
    area: {
      type: Number,
      required: true
    },
    center: {
      type: [Number],
      required: true
    },
    extremes: {
      north: {
        type: [Number],
        required: true
      },
      west: {
        type: [Number],
        required: true
      },
      east: {
        type: [Number],
        required: true
      },
      south: {
        type: [Number],
        required: true
      }
    },
    polygons: [
      {
        type: polygonSchema,
        validate: [(val) => val.length > 0]
      }
    ]
  },
  e18Id: {
    type: String
  },
  createdTimestamp: {
    type: Date,
    default: new Date(),
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdByEmail: {
    type: String,
    required: true
  },
  createdById: {
    type: String,
    default: "00000000-0000-0000-0000-000000000000",
    required: true
  },
  createdByDepartment: {
    type: String,
    required: true
  },
  modifiedTimestamp: {
    type: Date,
    default: new Date(),
    required: true
  },
  modifiedBy: {
    type: String,
    default: "Noen André",
    required: true
  },
  modifiedByEmail: {
    type: String,
    required: true
  },
  modifiedByDepartment: {
    type: String,
    required: true
  },
  modifiedById: {
    type: String,
    default: "00000000-0000-0000-0000-000000000000",
    required: true
  },
  approvedTimestamp: {
    type: Date
  },
  approvedBy: {
    type: String
  },
  approvedById: {
    type: String
  },
  approvedByEmail: {
    type: String
  },
  approvedByDepartment: {
    type: String
  }
});

const Dispatches = mongoose.model("Dispatches", dispatchesSchema);

module.exports = Dispatches;
