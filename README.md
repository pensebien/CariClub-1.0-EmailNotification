# Intro
Simple NodeJS cron job script to send email reminders to users that have signed up but not yet completed the registration process on CariClub Platform.

### Script does the following
1. Run Cron job every day at 12:00 PM.
2. Send Reminder Dynamic Email Setup in Sendgrid
3. Log cron job

## Development

In order to get up and running using this repository you'll need the following:

- `.env` : database config
- `doc` installed
- `sendgrid/mail` installed
- `mysql` installed

With the above dependencies installed run the following to get up and running:

1. Run the script using `node app.js` command

For running the Client app on local machine, follow these steps: 

### Improvement
1. Add ReferralID to get the name of the person that referred the user. This can be used to add more personalization in the **SendGrid Dynamic Template** email campaign. 
2. Use OrgID and LastLogin to construct the email, and send follow-up emails after a few days.
