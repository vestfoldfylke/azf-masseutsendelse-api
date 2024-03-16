const mongoose = require('mongoose')

// Tasks
// const tasksSchema = new mongoose.Schema({
//   method: {
//     type: String,
//     required: true
//   },
//   status: {
//     type: String,
//     default: 'waiting',
//     enum: ['waiting', 'inprogress', 'completed', 'failed'],
//     required: true
//   },
//   ssn: {
//     type: String,
//     required: true
//   }
// }, { _id: false })

const jobsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  approvedTimeStamp: {
    type: Date,
    required: true
  },
  jobCreatedTimeStamp: {
    type: Date,
    default: new Date(),
    required: true
  },
  status: {
    syncRecipients: {
      type: String,
      default: 'waiting',
      enum: ['waiting', 'inprogress', 'completed', 'failed'],
      required: true
    },
    createCaseDocument: {
      type: String,
      default: 'waiting',
      enum: ['waiting', 'inprogress', 'completed', 'failed'],
      required: true
    },
    uploadAttachments: {
      type: String,
      default: 'waiting',
      enum: ['waiting', 'inprogress', 'completed', 'failed'],
      required: true
    },
    issueDispatch: {
      type: String,
      default: 'waiting',
      enum: ['waiting', 'inprogress', 'completed', 'failed'],
      required: true
    },
    createStatistics: {
      type: String,
      default: 'waiting',
      enum: ['waiting', 'inprogress', 'completed', 'failed'],
      required: true
    }
  },
  tasks: {
    type: Object,
    required: true,
    syncRecipients: {
      type: Array
    },
    createCaseDocument: {
      type: Array
    },
    uploadAttachments: {
      type: Array
    },
    issueDispatch: {
      type: Array
    },
    createStatistics: {
      type: Array
    }
  },
  failedTasks: []

})

const Jobs = mongoose.model('Jobs', jobsSchema)

module.exports = Jobs
