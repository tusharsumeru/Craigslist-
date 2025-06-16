# Email Reporting Feature Documentation

## Overview
The Email Reporting feature automatically tracks all sent emails and generates a daily CSV report at 5 PM. It also allows manual export of email reports at any time.

## Features

### Automatic Daily Reports
- The system automatically generates a CSV report of all emails sent each day
- Reports are generated at 5 PM daily
- Reports include details such as recipient, subject, status, and timestamp
- Reports now include a summary section with daily counts and success rates

### Daily Email Count
- The Send page displays the total number of emails sent today
- A detailed breakdown shows successful emails, failed emails, and success rate
- Counts are updated in real-time as emails are sent

### Manual Report Export
- Users can manually export email reports from the Send page
- Click the "Export Report" button to download the current day's email activity as a CSV file
- Exported reports include a summary section with totals and statistics

### Email Activity Dashboard
- View today's email activity directly on the Send page
- See the status of all emails sent today (Sent/Failed)
- Track email volume and performance
- Visual indicators show success rates with color coding

## Technical Details

### Email Logger Service
The `EmailLoggerService` manages all email logging and reporting functionality:

- `logSentEmail(emailData)`: Records details of a sent email
- `getAllLogs()`: Returns all logged emails
- `getLogsByDate(date)`: Gets logs for a specific date (defaults to today)
- `exportToCSV(date)`: Exports logs to CSV for a specific date (defaults to today)
- `clearLogs()`: Clears all email logs

### Data Storage
Email logs are stored in the browser's localStorage under the key 'sentEmails'.

### CSV Format
The CSV export includes two sections:

#### Summary Section
- Total number of emails sent for the day
- Count of successfully sent emails
- Count of failed emails
- Success rate percentage

#### Detailed Email Log
- Title: Job title
- Email: Recipient's email address
- Subject: Email subject line
- Status: Sent or Failed
- Date: Date sent (MM/DD/YYYY)
- Time: Time sent (HH:MM:SS)
- City: Location from job posting
- Link: Job posting URL

## Usage

1. **Send emails** - The system automatically logs all email sending attempts
2. **View today's activity** - Scroll to the bottom of the Send page
3. **Export report manually** - Click the "Export Report" button
4. **Automatic reports** - Generated daily at 5 PM (browser must be open)

## Requirements
- file-saver: For CSV file download functionality
- PapaParse: For CSV generation
- LocalStorage: For data persistence

## Limitations
- Data is stored in browser localStorage, so it's specific to each device/browser
- Automatic exports only occur if the browser is open at 5 PM
- Storage limitation based on browser localStorage capacity

---

For questions or issues, please contact the development team. 