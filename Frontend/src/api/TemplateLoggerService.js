import { saveAs } from 'file-saver';
import Papa from 'papaparse';

// Initialize storage or get existing data
const getStoredTemplates = () => {
  const storedData = localStorage.getItem('generatedTemplates');
  return storedData ? JSON.parse(storedData) : [];
};

// Template Logger Service
export const templateLoggerService = {
  // Log a generated template
  logGeneratedTemplate: (templateData) => {
    try {
      const templates = getStoredTemplates();
      
      // Add timestamp and format the data
      const loggedTemplate = {
        ...templateData,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString(),
        status: templateData.success ? 'Generated' : 'Failed'
      };
      
      // Add to storage
      templates.push(loggedTemplate);
      localStorage.setItem('generatedTemplates', JSON.stringify(templates));
      
      console.log('Template logged successfully:', loggedTemplate);
      return true;
    } catch (error) {
      console.error('Error logging template:', error);
      return false;
    }
  },
  
  // Get all logged templates
  getAllLogs: () => {
    return getStoredTemplates();
  },
  
  // Get logs for a specific day
  getLogsByDate: (date) => {
    const templates = getStoredTemplates();
    const targetDate = date || new Date().toLocaleDateString();
    
    return templates.filter(template => template.date === targetDate);
  },
  
  // Export logs to CSV
  exportToCSV: (date) => {
    try {
      // Get templates for the specified date or today
      const templates = date ? 
        templateLoggerService.getLogsByDate(date) : 
        templateLoggerService.getLogsByDate();
      
      if (templates.length === 0) {
        console.warn('No templates to export for the specified date');
        return false;
      }
      
      // Calculate statistics
      const totalGenerated = templates.filter(template => template.status === 'Generated').length;
      const totalFailed = templates.filter(template => template.status === 'Failed').length;
      const successRate = Math.round((totalGenerated / templates.length) * 100);
      
      // Create summary data
      const summaryData = [
        {
          Title: '--- DAILY TEMPLATE GENERATION REPORT SUMMARY ---',
          Email: '',
          Subject: '',
          Status: '',
          Date: date || new Date().toLocaleDateString(),
          Time: '',
          City: '',
          Link: ''
        },
        {
          Title: 'Total Templates',
          Email: templates.length,
          Subject: '',
          Status: '',
          Date: '',
          Time: '',
          City: '',
          Link: ''
        },
        {
          Title: 'Successfully Generated',
          Email: totalGenerated,
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
          Title: '--- DETAILED TEMPLATE LOG ---',
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
        ...templates.map(template => ({
          Title: template.title || '',
          Email: template.email || '',
          Subject: template.subject || '',
          Status: template.status,
          Date: template.date,
          Time: new Date(template.timestamp).toLocaleTimeString(),
          City: template.city || '',
          Link: template.link || ''
        }))
      ];
      
      // Convert to CSV
      const csv = Papa.unparse(csvData);
      
      // Create file and trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const dateStr = date || new Date().toLocaleDateString().replace(/\//g, '-');
      saveAs(blob, `template_report_${dateStr}.csv`);
      
      return true;
    } catch (error) {
      console.error('Error exporting templates to CSV:', error);
      return false;
    }
  },
  
  // Clear logs
  clearLogs: () => {
    localStorage.removeItem('generatedTemplates');
    console.log('Template logs cleared');
    return true;
  }
};

// Set up automatic daily export at 5 PM
export const setupDailyTemplateExport = () => {
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
      templateLoggerService.exportToCSV();
      console.log('Daily template report exported at 5 PM');
      
      // Schedule the next day's export
      scheduleNextExport();
    }, timeUntilExport);
    
    console.log(`Next template export scheduled for ${exportTime.toLocaleString()}`);
  };
  
  // Start the scheduling cycle
  scheduleNextExport();
};