const { MS } = require('../../config')
const axios = require('axios').default

const alertTeams = async (error, color, failedTask, completedJob, jobId, endpoint) => {
  if (!color) throw new Error('Color must be provided')
  if (!error) throw new Error('Error must be provided')
  if (!failedTask) throw new Error('failedTasks must be provided')
  if (!completedJob) throw new Error('completedJob must be provided')
  if (typeof (color) !== 'string') throw new Error('Color must be of type string')

  if (color === 'error') {
    color = 'a80c0c'
  } else {
    color = '1ea80c'
  }

  const teamsMsg = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.5',
          msteams: { width: 'full' },
          body: [
            {
              type: 'TextBlock',
              text: color === 'a80c0c' ? 'azf-masseutsendelse-api failed' : 'azf-masseutsendelse-api finished a job',
              wrap: true,
              style: 'heading',
              color
            },
            {
              type: 'TextBlock',
              text: `endpoint: ${endpoint}`,
              wrap: true,
              weight: 'Bolder',
              size: 'Medium'
            },
            {
              type: 'TextBlock',
              text: `Task ${color === 'a80c0c' ? 'Failed' : 'Completed'}`,
              wrap: true,
              weight: 'Bolder',
              size: 'Medium'
            },
            {
              type: 'TextBlock',
              text: color === 'a80c0c' ? failedTask : completedJob,
              wrap: true,
              weight: 'Bolder',
              size: 'Medium'
            },
            {
              type: 'TextBlock',
              text: color === 'a80c0c' ? JSON.stringify(error) : 'Everything is good!',
              wrap: true,
              weight: 'Bolder',
              size: 'Medium'
            }
          ]
        }
      }
    ]
  }

  // const teamsMsgOld = {
  //   '@type': 'MessageCard',
  //   '@context': 'http://schema.org/extensions',
  //   themeColor: color,
  //   summary: color === 'a80c0c' ? 'azf-masseutsendelse-api failed' : 'azf-masseutsendelse-api finished a job',
  //   sections: [{
  //     activityTitle: color === 'a80c0c' ? 'azf-masseutsendelse-api failed' : 'azf-masseutsendelse-api',
  //     activitySubtitle: color === 'a80c0c' ? 'Oi, noe gikk galt! 😮' : 'Oi, alt gikk bra! 🥳',
  //     activityImage: 'https://adaptivecards.io/content/cats/3.png',
  //     facts: [
  //       {
  //         name: 'Endpoint',
  //         value: endpoint
  //       },
  //       {
  //         name: color === 'a80c0c' ? 'Failed Task' : 'Completed Job',
  //         value: color === 'a80c0c' ? failedTask : completedJob
  //       },
  //       {
  //         name: 'JobId (mongoDB ObjectID)',
  //         value: jobId
  //       },
  //       {
  //         name: color === 'a80c0c' ? 'Error' : 'Success',
  //         value: color === 'a80c0c' ? error : 'Everything is good!'
  //       }
  //     ],
  //     markdown: true
  //   }]
  // }
  const headers = { contentType: 'application/vnd.microsoft.teams.card.o365connector' }
  await axios.post(MS.TEAMS_WEBHOOK_URL, teamsMsg, { headers })
}

module.exports = {
  alertTeams
}
