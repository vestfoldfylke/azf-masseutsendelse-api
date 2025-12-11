const { logger } = require("@vestfoldfylke/loglady");
const { MS } = require("../../config");

const alertTeams = async (error, color, failedTask, completedJob, jobId, endpoint) => {
  if (!color) {
    throw new Error("Color must be provided");
  }
  if (!error) {
    throw new Error("Error must be provided");
  }
  if (!failedTask) {
    throw new Error("failedTasks must be provided");
  }
  if (!completedJob) {
    throw new Error("completedJob must be provided");
  }
  if (typeof color !== "string") {
    throw new Error("Color must be of type string");
  }
  if (!MS.TEAMS_ALERTS_WEBHOOK_URL) {
    return;
  }

  color = color === "error" ? "a80c0c" : "1ea80c";

  const teamsMsg = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.5",
          msteams: { width: "full" },
          body: [
            {
              type: "TextBlock",
              text: color === "a80c0c" ? "azf-masseutsendelse-api failed" : "azf-masseutsendelse-api finished a job",
              wrap: true,
              style: "heading",
              color
            },
            {
              type: "TextBlock",
              text: `endpoint: ${endpoint}`,
              wrap: true,
              weight: "Bolder",
              size: "Medium"
            },
            {
              type: "TextBlock",
              text: `Task ${color === "a80c0c" ? "Failed" : "Completed"}`,
              wrap: true,
              weight: "Bolder",
              size: "Medium"
            },
            {
              type: "TextBlock",
              text: color === "a80c0c" ? failedTask : completedJob,
              wrap: true,
              weight: "Bolder",
              size: "Medium"
            },
            {
              type: "TextBlock",
              text: color === "a80c0c" ? JSON.stringify(error) : "Everything is good!",
              wrap: true,
              weight: "Bolder",
              size: "Medium"
            }
          ]
        }
      }
    ]
  };

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
  //         name: 'JobId (mongoDB ObjectId)',
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

  const response = await fetch(MS.TEAMS_ALERTS_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(teamsMsg)
  });

  if (!response.ok) {
    const errorData = await response.text();
    logger.error("Failed to send Teams alert with JobId {JobId}. Status: {Status}: {StatusText}: {@ErrorData}", jobId, response.status, response.statusText, errorData);
    throw new Error(`Failed to send Teams alert: ${response.status} ${response.statusText}`);
  }
};

module.exports = {
  alertTeams
};
