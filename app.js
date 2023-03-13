require('dotenv').config();
const mysql = require('mysql2/promise');
const cron = require('node-cron');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');

// Create a connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST_PROD,
    user: process.env.DB_USER_PROD,
    password: process.env.DB_PASSWORD_PROD,
    database: process.env.DB_NAME_PROD
});

// Check if the connection pool was created successfully
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error creating connection pool: ', err);
        return;
    }
    console.log('Connection pool created successfully');
    connection.release();
});


// Schedule the job to run every day at 12:00 PM
cron.schedule('0 12 * * *', async() => {
    // Log start of the job
    console.log('Starting cron job at 12:00 PM');

    // Get the current date
    const today = new Date();

    // Variable to hold the API key of SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Check if the table exists in the database
    const checkTableQuery = "SELECT 1 FROM Information_Schema.Tables WHERE Table_Name = 'Log_ActivationReminderEmails'";
    const [rows, fields] = await pool.execute(checkTableQuery);

    // If the table does not exist, create it
    if (rows.length === 0) {
        const createTableQuery = "CREATE TABLE Log_ActivationReminderEmails (LogID INT NOT NULL AUTO_INCREMENT, UserID INT NOT NULL, Interval INT NOT NULL, PRIMARY KEY (LogID))";
        await pool.execute(createTableQuery);
    }


    async function getUsersSignedUpDaysAgo() {
        try {
            const [users] = await pool.execute(
                'SELECT UserID, ReferredByID, FirstName, LastName, WorkEmail, PersonalEmail, ActivatedDate, IsRegistrationCompleted FROM User WHERE IsRegistrationCompleted < > 1 AND ActivatedDate IS NOT NULL'
            );
            return users;
        } catch (error) {
            console.error(error);
        }
    }

    // Function to SendEmail using SendGrid
    async function sendEmail(user, daysInterval) {
        const msg = {
            personalizations: [{
                to: [{ email: user.WorkEmail }],
                dynamic_template_data: {
                    user: {
                        FirstName: user.FirstName,
                        LastName: user.LastName,
                        Email: user.WorkEmail,
                        SignupDaysAgo: daysInterval,
                        StartedURL: 'https://cariclub.com/onboarding?token=3482f028-ba03-11ed-887c-0ec1fd0ce199'
                    }
                }
            }],
            template_id: 'd-1fbbd600286f48338e661be0a26274be',
            from: 'hello@cariclub.com',
            subject: "It's Time to Get Started: Activate Your CariClub",
            content: [{
                type: 'text/html',
                value: 'This is email contain'
            }],
        };

        try {
            await sgMail.send(msg);
            console.log('Email sent successfully');
        } catch (error) {
            console.error(error);
        }
    }



    async function getAndLogUsersSignedUpDaysAgo() {
        try {
            // var emmaEmail = "emma.awokoya.work@gmail.com"; // Email to send to

            const users = await getUsersSignedUpDaysAgo();
            console.log("The users not activated account", users);

            // Define the time intervals for sending emails
            const timeIntervals = [30, 20, 10, 2];

            // Map to track the interval and last email sent date for each user
            const intervalMap = new Map();

            // Iterate through each user and check if an email should be sent
            for (var i = 0; i < users.length; i++) {
                var user = users[i];

                // Calculate the number of days since the user's activated date
                const daysSinceActivation = Math.round((today - user.ActivatedDate) / (1000 * 60 * 60 * 24));

                // If the user has already received all 4 emails, skip them
                if (user.NumEmailsSent >= 4) {
                    continue;
                }

                // Iterate through the time intervals and check if an email should be sent for the user
                for (const interval of timeIntervals) {
                    console.log(user.FirstName + " signup " + interval + " days ago", daysSinceActivation);

                    // Check if the user has already received an email for this interval
                    if (user[`EmailSent_${interval}`]) {
                        continue;
                    }

                    // Check if an email should be sent for the user
                    const lastEmailSentDate = intervalMap.get(user.UserID);
                    if (!lastEmailSentDate || daysSinceActivation > lastEmailSentDate + interval) {

                        // Send an email to the user
                        await sendEmail(user, interval);

                        // Insert a record in the Log_ActivationReminderEmails table to indicate that an email was sent for this interval
                        const insertQuery = `INSERT INTO Log_ActivationReminderEmails (UserID, Interval) VALUES (?, ?)`;
                        await pool.execute(insertQuery, [user.UserID, interval]);

                        // Update the user's record to indicate that an email was sent for this interval
                        const updateQuery = `UPDATE User SET NumEmailsSent = NumEmailsSent + 1, EmailSent_${interval} = 1 WHERE UserID = ?`;
                        await pool.execute(updateQuery, [user.UserID]);

                        // If the user's email matches emmaEmail, send another email
                        // if (user.WorkEmail == emmaEmail || user.PersonalEmail == emmaEmail) {
                        //     await sendEmail(user, interval);
                        // }

                        // Update the interval map with the last email sent date for the user
                        intervalMap.set(user.UserID, daysSinceActivation);

                        // Exit the loop since the email has been sent
                        break;
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }





    getAndLogUsersSignedUpDaysAgo();


    // Log end of the job
    console.log('Cron job finished at 12:00 PM');

    // Save logs to a file
    const logFilePath = path.join(__dirname, 'cron-job.log');
    const logMessage = `Cron job finished at 12:00 PM\n`;
    fs.appendFileSync(logFilePath, logMessage);
});
// Where it can be improve
// 1. Check for users that ever activated their account
// [Careful not to send to already employee]
// 2. Add ReferralID to get the name of the person that 
// referred the user with a message in the email marketing bit
// Stating that the Referer is waiting for the user
// OrgID, LastLogin can also be used to contrust the email. 
// -- We could use this as follow email maybe after a few days
// Log when the cron was run successfully
// then use that as a date metrics to check
// when to transfer DB from DB1 to DB2
// Use that last cron job run date as a metric to know 
// know which date to retrieve the last log Users.