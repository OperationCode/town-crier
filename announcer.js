const Airtable = require('airtable');
const hook_url = "https://hooks.slack.com/services/" + process.env.SLACK_TOKEN;
const CronJob = require('cron').CronJob;
const Slack = require('node-slack');
const slack = new Slack(hook_url);
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE);

var airtableCronJobs = [];

function refreshCronTable () {
    console.log("Refreshing the CRON Table");
    // Explicitly stop all airtable CRON jobs 
    airtableCronJobs.forEach(function (job) {
        job.stop();
    })

    // Flush all CronJob instances
    airtableCronJobs = [];

    // Refresh and start all CronJob instances from airtable
    base('Slack Announcer').select({
        view: "Announcer Filter"
    }).eachPage(function page(records, fetchNextPage) {

        // This function (`page`) will get called for each page of records.

        records.forEach(function (record) {

            var name = record.get('Name');
            var sec = record.get('Second');
            var min = record.get('Minute');
            var hor = record.get('Hour');
            var dom = record.get('Day of Month');
            var mon = record.get('Month');
            var dow = record.get('Day of Week');

            if (min > 1 && min < 5) {
                min = 5;
                console.log(`job ${name} was modified to run outside of the CRON table refresh window`);
            }

            var airtable_cron = (sec + ' ' + min + ' ' + hor + ' ' + dom + ' ' + mon + ' ' + dow);

            airtableCronJobs.push(new CronJob(airtable_cron, function () {
                console.log(`Running job ${name}`);

                // See what channels are associated with this entry.
                record.get('Channels').forEach(function (channel) {

                    slack.send({
                        text: record.get('Text'),
                        channel: channel.toString(),
                        username: record.get('Announcer Name')
                    });

                })
            }, null, true, 'America/Los_Angeles'));

        });

        // To fetch the next page of records, call `fetchNextPage`.
        // If there are more records, `page` will get called again.
        // If there are no more records, `done` will get called.
        fetchNextPage();

    }, function done(error) {
        if (error) {
            console.log(error);
        }
    });
}

// Refresh the CRON table immediately upon npm start
try {
    refreshCronTable();
} catch (ex) {
    console.log(`Error refreshing Cron Table: ${ex}`);
}

// and then flush and reload the CRON table at 3 minutes and 3 seconds past every hour
// This is specifically offset from 5, 10, 15 minute intervals to ensure that 
// a CRON job is not set to fire whe the CRON table is being refreshed

const update_cron = '3 3 * * * *';

try {
    new CronJob(update_cron, refreshCronTable, null, true, 'America/Los_Angeles');
} catch (ex) {
    console.log(`Invalid Cron Pattern: ${ex}`);
}

