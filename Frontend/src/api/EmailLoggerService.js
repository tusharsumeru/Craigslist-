import { saveAs } from 'file-saver';
import Papa from 'papaparse';

// Initialize storage or get existing data
const getStoredEmails = () => {
  const storedData = localStorage.getItem('sentEmails');
  return storedData ? JSON.parse(storedData) : [];
};

// Email Logger Service
export const emailLoggerService = {
  // Log a sent email
  logSentEmail: (emailData) => {
    try {
      const emails = getStoredEmails();
      
      // Add timestamp and format the data
      const loggedEmail = {
        ...emailData,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString(),
        status: emailData.success ? 'Sent' : 'Failed'
      };
      
      // Add to storage
      emails.push(loggedEmail);
      localStorage.setItem('sentEmails', JSON.stringify(emails));
      
      console.log('Email logged successfully:', loggedEmail);
      return true;
    } catch (error) {
      console.error('Error logging email:', error);
      return false;
    }
  },
  
  // Get all logged emails
  getAllLogs: () => {
    return getStoredEmails();
  },
  
  // Get logs for a specific day
  getLogsByDate: (date) => {
    const emails = getStoredEmails();
    const targetDate = date || new Date().toLocaleDateString();
    
    return emails.filter(email => email.date === targetDate);
  },
  
  // Export logs to CSV
  exportToCSV: (date) => {
    try {
      // Get emails for the specified date or today
      const emails = date ? 
        emailLoggerService.getLogsByDate(date) : 
        emailLoggerService.getLogsByDate();
      
      if (emails.length === 0) {
        console.warn('No emails to export for the specified date');
        return false;
      }
      
      // Calculate statistics
      const totalSent = emails.filter(email => email.status === 'Sent').length;
      const totalFailed = emails.filter(email => email.status === 'Failed').length;
      const successRate = Math.round((totalSent / emails.length) * 100);
      
      // Create summary data
      const summaryData = [
        {
          Title: '--- DAILY EMAIL REPORT SUMMARY ---',
          Email: '',
          Subject: '',
          Status: '',
          Date: date || new Date().toLocaleDateString(),
          Time: '',
          City: '',
          Link: ''
        },
        {
          Title: 'Total Emails',
          Email: emails.length,
          Subject: '',
          Status: '',
          Date: '',
          Time: '',
          City: '',
          Link: ''
        },
        {
          Title: 'Successfully Sent',
          Email: totalSent,
          Subject: '',
          Status: '',
          Date: '',
          Time: '',
          City: '',
          Link: ''
        },
        {
          Title: 'Failed',
          Email: totalFailed,
          Subject: '',
          Status: '',
          Date: '',
          Time: '',
          City: '',
          Link: ''
        },
        {
          Title: 'Success Rate',
          Email: successRate + '%',
          Subject: '',
          Status: '',
          Date: '',
          Time: '',
          City: '',
          Link: ''
        },
        {
          Title: '',
          Email: '',
          Subject: '',
          Status: '',
          Date: '',
          Time: '',
          City: '',
          Link: ''
        },
        {
          Title: '--- DETAILED EMAIL LOG ---',
          Email: '',
          Subject: '',
          Status: '',
          Date: '',
          Time: '',
          City: '',
          Link: ''
        }
      ];
      
      // Format data for CSV
      const csvData = [
        ...summaryData,
        ...emails.map(email => ({
          Title: email.title || '',
          Email: email.recipient || email.email || '',
          Subject: email.subject || '',
          Status: email.status,
          Date: email.date,
          Time: new Date(email.timestamp).toLocaleTimeString(),
          City: email.city || '',
          Link: email.link || ''
        }))
      ];
      
      // Convert to CSV
      const csv = Papa.unparse(csvData);
      
      // Create file and trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const dateStr = date || new Date().toLocaleDateString().replace(/\//g, '-');
      saveAs(blob, `email_report_${dateStr}.csv`);
      
      return true;
    } catch (error) {
      console.error('Error exporting emails to CSV:', error);
      return false;
    }
  },
  
  // Clear logs
  clearLogs: () => {
    localStorage.removeItem('sentEmails');
    console.log('Email logs cleared');
    return true;
  }
};

// Set up automatic daily export at 5 PM
export const setupDailyExport = () => {
  const scheduleNextExport = () => {
    const now = new Date();
    const exportTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      17, // 5 PM
      0,  // 0 minutes
      0   // 0 seconds
    );
    
    // If it's already past 5 PM, schedule for tomorrow
    if (now > exportTime) {
      exportTime.setDate(exportTime.getDate() + 1);
    }
    
    const timeUntilExport = exportTime - now;
    
    // Schedule the export
    setTimeout(() => {
      // Export today's logs
      emailLoggerService.exportToCSV();
      console.log('Daily email report exported at 5 PM');
      
      // Schedule the next day's export
      scheduleNextExport();
    }, timeUntilExport);
    
    console.log(`Next email export scheduled for ${exportTime.toLocaleString()}`);
  };
  
  // Start the scheduling cycle
  scheduleNextExport();
}; 