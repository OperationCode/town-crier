const Airtable = require('airtable');
const hook_url = "https://hooks.slack.com/services/" + process.env.SLACK_TOKEN;
const CronJob = require('cron').CronJob;
const Slack = require('node-slack');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;
const slack = new Slack(hook_url);
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE);

const logger = createLogger({
  format: combine(
    timestamp(),
    prettyPrint()
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
    new transports.Console(),
  ],
  level: 'info'
});

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
            var fan = record.get('Force At Night');
            fan = (fan === true) ? true: false;

            if (min > 1 && min < 5) {
                min = 5;
                console.log(`job ${name} was modified to run outside of the CRON table refresh window`);
                logger.log({
                  level: 'info',
                  message: `job ${name} was modified to run outside of the CRON table refresh window`
                })
            }
            
            logger.log({
                level: 'info',
                message: `Forcing at Night ${fan}`
            });

            var airtable_cron = (sec + ' ' + min + ' ' + hor + ' ' + dom + ' ' + mon + ' ' + dow);
            
            airtableCronJobs.push(new CronJob(airtable_cron, function () {
                //Makes the bot not post overnight unless the post is forced.
                var OutsideNormalHours = ((new Date().getUTCHours() >= 6 && new Date().getUTCHours() <= 13)) ? true : false;
                logger.log({
                    level: 'debug',
                    message: `Current local server date ${new Date().getUTCHours()}`
                });
                if(!OutsideNormalHours || fan) {
                    record.get('Channels').forEach(function (channel) {
                        logger.log({
                            level: 'info',
                            message: `Successfully sent '`  +record.get('Text').substring(0,30) + `' message to channel ${channel}`
                        })
                        try {
                            slack.send({
                                text: record.get('Text'),
                                channel: channel.toString(),
                                username: record.get('Announcer Name')
                            }); 
                            logger.log({
                              level: 'info',
                              message: `Successfully sent '`  +record.get('Text').substring(0,30) + `' message to channel ${channel}`
                            })
                        } catch (ex) {
                            logger.log({
                              level: 'error',
                              message: `Unable to run job ${name}: ${ex}`
                            })
                        }

                    })
                }
            }, null, true, 'America/Los_Angeles'));
            }, null, true, 'America/Los_Angeles'));
            
        // To fetch the next page of records, call `fetchNextPage`.
        // If there are more records, `page` will get called again.
        // If there are no more records, `done` will get called.
        fetchNextPage();

    }, function done(error) {
        if (error) {
            logger.log({
                level: 'crit',
                message: `Error Ocurred: ${error}`
            })
        }
    });
});
};

// Refresh the CRON table immediately upon npm start
try {
    refreshCronTable();
} catch (ex) {
    logger.log({
        level: 'crit',
        message: `Error refreshing Cron Table: ${ex}`
    })
}

function OnComplete() {
    
}
// and then flush and reload the CRON table at 3 minutes and 3 seconds past every hour
// This is specifically offset from 5, 10, 15 minute intervals to ensure that 
// a CRON job is not set to fire whe the CRON table is being refreshed

const update_cron = '3 3 * * * *';

try {
    
    new CronJob(update_cron, refreshCronTable, null, true, 'America/Los_Angeles');
} catch (ex) {
    logger.log({
        level: 'crit',
        message: `Invalid Cron Pattern: ${ex}`
    })
}
