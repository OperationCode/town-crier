var hook_url = "https://hooks.slack.com/services/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"

var Slack = require('node-slack');
var slack = new Slack(hook_url);

slack.send({
    text: 'Our scholarship licenses for Treehouse web development and design, from https://www.teamtreehouse.com/, are still available! You can request a license at http://op.co.de/scholarship-license.',
    channel: '#general',
    username: 'Scholarship Announcement'
});

var CronJob = require('cron').CronJob;
new CronJob('* * * * * *', function () {
    console.log('You will see this message every second');
}, null, true, 'America/Los_Angeles');