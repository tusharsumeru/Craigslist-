# Template Generation Reporting Feature Documentation

## Overview
The Template Reporting feature automatically tracks all generated email templates and generates a daily CSV report at 5 PM. It also allows manual export of template reports at any time.

## Features

### Automatic Daily Reports
- The system automatically generates a CSV report of all templates generated each day
- Reports are generated at 5 PM daily
- Reports include details such as title, email, subject, status, and timestamp
- Reports include a summary section with daily counts and success rates

### Daily Template Count
- The Generate page displays the total number of templates generated today
- A detailed breakdown shows successful generations, failed generations, and success rate
- Counts are updated in real-time as templates are generated

### Manual Report Export
- Users can manually export template reports from the Generate page
- Click the "Export Report" button to download the current day's template activity as a CSV file
- Exported reports include a summary section with totals and statistics

### Template Activity Dashboard
- View today's template activity directly on the Generate page
- See the status of all templates generated today (Generated/Failed)
- Track template volume and performance
- Visual indicators show success rates with color coding

## Technical Details

### Template Logger Service
The `TemplateLoggerService` manages all template logging and reporting functionality:

- `logGeneratedTemplate(templateData)`: Records details of a generated template
- `getAllLogs()`: Returns all logged templates
- `getLogsByDate(date)`: Gets logs for a specific date (defaults to today)
- `exportToCSV(date)`: Exports logs to CSV for a specific date (defaults to today)
- `clearLogs()`: Clears all template logs

### Data Storage
Template logs are stored in the browser's localStorage under the key 'generatedTemplates'.

### CSV Format
The CSV export includes two sections:

#### Summary Section
- Total number of templates generated for the day
- Count of successfully generated templates
- Count of failed templates
- Success rate percentage

#### Detailed Template Log
- Title: Job title
- Email: Recipient's email address
- Subject: Email subject line
- Status: Generated or Failed
- Date: Date generated (MM/DD/YYYY)
- Time: Time generated (HH:MM:SS)
- City: Location from job posting
- Link: Job posting URL

## Usage

1. **Generate templates** - The system automatically logs all template generation attempts
2. **View today's activity** - Scroll to the bottom of the Generate page
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