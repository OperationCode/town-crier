const Airtable = require('airtable');
const hook_url = "https://hooks.slack.com/services/" + process.env.SLACK_TOKEN;
const CronJob = require('cron').CronJob;
const Slack = require('node-slack');
const slack = new Slack(hook_url);
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE);

var airtableCronJobs = [];

const DIVIDER = '<divider>'

const generateTitleLinks = (text) => {
  if (/<.+\|.+>/.test(text)) {
    return {
      title: text.match(/<(.+)\|/)[1],
      title_link: text.match(/\|(.+)>/)[1],
      text: text.replace(/<.+\|.+>/, '\n')
    }
  }
  return { text }
}

const createAttachment = (text) => ({
  ...generateTitleLinks(text),
  color: "#3ed6f0",
  type: "section"
})

const createDividedAttachment = (text) => {
  return [
    createAttachment(text),
    {
      "type": "divider"
    }
  ]
}

const generateAttachments = (text) => {
  if (text.includes(DIVIDER)) {
    return text.split(DIVIDER).flatMap(createDividedAttachment)
  } else {
    return [createAttachment(text)]
  }
}

const handleError = (error) => {
  if (error) {
    console.error(error);
  }
};

/**
 * @summary
 * This function abstracts out the constant parameters and gives you a cron job. 
 * 
 * @param cronTime The time to fire off a job
 * @param onTick The function that is executed when the job is fired
 */
const createNewCronJob = (
  cronTime,
  onTick,
) => new CronJob(cronTime, onTick, null, true, 'America/Los_Angeles');

/**
 * @summary
 * Sends a slack message with the given parameters.
 * 
 * @param attachmentContent 
 * @param channel 
 * @param announcerName 
 */
const sendMessage = (
  attachmentContent,
  channel,
  announcerName,
) => slack.send({
  text: " ",
  attachments: generateAttachments(attachmentContent),
  channel: channel.toString(),
  username: announcerName,
});

/**
 * @summary
 * This job creates and returns and cron job from the given record.
 * Note that this function is used for each record in the page in
 * @see refreshCronTable.
 * 
 * @param record 
 */
const generateCronJobFromRecord = (record) => {
  const name = record.get('Name');
  const sec = record.get('Second');
  const min = record.get('Minute');
  const hor = record.get('Hour');
  const dom = record.get('Day of Month');
  const mon = record.get('Month');
  const dow = record.get('Day of Week');

  if (min > 1 && min < 5) {
    min = 5;
    console.log(`job ${name} was modified to run outside of the CRON table refresh window`);
  }

  const airtableCron = `${sec} ${min} ${hor} ${dom} ${mon} ${dow}`;

  const channels = record.get('Channels');
  const attachmentContent = record.get('Text');
  const announcerName = record.get('Announcer Name');

  const sendMessageForChannel = () => {
    channels.forEach((channel) => sendMessage(attachmentContent, channel, announcerName));
  };

  return createNewCronJob(airtableCron, sendMessageForChannel);
};

/**
 * @summary
 * Updates the list of cron jobs with the records of a new page.
 * 
 * @description
 * Note that this function is currently not pure because airtableCronJobs 
 * is a global variable.
 * 
 * @param records A list of records from a page
 * @param fetchNextPage A function that requests the next page. This is called 
 * after processing and results in the ERROR route being taken if there are no 
 * more records.
 */
const generateCronJobsFromPage = (
  records,
  fetchNextPage,
) => {
  const cronJobsFromRecords = records.map((record) => generateCronJobFromRecord(record));
  airtableCronJobs = [airtableCronJobs, ...cronJobsFromRecords];
  fetchNextPage();
};

/**
 * @summary
 * Refreshes the Cron Table.
 * 
 * @description
 * First explicitly stops all the airtable cron jobs.
 * Then flushes all the instances and restarts them from the airtable.
 */
const refreshCronTable = () => {
  console.log("Refreshing the CRON Table")

  airtableCronJobs.forEach((job) => job.stop());
  airtableCronJobs = [];

  base('Slack Announcher').select({
    view: "Announcer Filter",
  }).eachPage(
    (records, fetchNextPage) => generateCronJobsFromPage(records, fetchNextPage), 
    (error) => handleError(error),
  );
};

// Refresh the CRON table immediately upon npm start
try {
  refreshCronTable();
} catch (ex) {
  console.log(`Error refreshing Cron Table: ${ex}`);
}

// and then flush and reload the CRON table at 3 minutes and 3 seconds past every hour
// This is specifically offset from 5, 10, 15 minute intervals to ensure that 
// a CRON job is not set to fire whe the CRON table is being refreshed

const updateCron = '3 3 * * * *';

try {
  createNewCronJob(updateCron, refreshCronTable);
} catch (ex) {
  console.log(`Invalid Cron Pattern: ${ex}`);
}

