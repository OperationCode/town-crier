require('dotenv').config()

const Airtable = require('airtable');
const hook_url = "https://hooks.slack.com/services/" + process.env.SLACK_TOKEN;
const CronJob = require('cron').CronJob;
const Slack = require('node-slack');
const slack = new Slack(hook_url);
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE);

base('Slack Announcer').select({
    view: "Announcer Filter"
}).eachPage(function page(records, fetchNextPage) {

    // This function (`page`) will get called for each page of records.

    records.forEach(function (record) {

        var sec = record.get('Second');
        var min = record.get('Minute');
        var hor = record.get('Hour');
        var dom = record.get('Day of Month');
        var mon = record.get('Month');
        var dow = record.get('Day of Week');
        
        var airtable_cron = (sec + ' ' + min + ' ' + hor + ' ' + dom + ' ' + mon + ' ' + dow);

        new CronJob(airtable_cron, function () {
            slack.send({
                text: record.get('Text'),
                channel: record.get('Channels').toString(),
                username: record.get('Announcer Name')
            });
        }, null, true, 'America/Los_Angeles');

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