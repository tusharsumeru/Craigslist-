import axios from 'axios';
import { API_BASE_URLS } from '../config/api';

// Create a dedicated axios instance for the GPT mail service
const gptMailApi = axios.create({
  baseURL: API_BASE_URLS.gptMail,
  timeout: 300000, // Increase timeout to 5 minutes for Llama 3 70B model
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // When using withCredentials:true, the server must specify an explicit origin, not a wildcard '*'
  withCredentials: true
});

// Helper to sanitize the subject (remove newlines and carriage returns)
const sanitizeSubject = (subject) => {
  if (!subject) return "No Subject";
  return subject.replace(/[\r\n]+/g, ' ').trim();
};

// Create and export the gptMailService object
export const gptMailService = {
  generateMail: async (mailData) => {
    try {
      console.log(`Generating email for: ${mailData.title}`);
      const response = await gptMailApi.post('/generate/', {
        title: mailData.title,
        description: mailData.description,
        dateOfPost: mailData.date,
        persona: "Abj",
        link: mailData.link,
        city: mailData.city
      });
      return response.data.reply;
    } catch (error) {
      console.error('Error generating mail:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`Server responded with ${error.response.status}:`, error.response.data);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from server');
      }
      throw error;
    }
  },

  // Function to generate and send email in one step
  sendMail: async (mailData) => {
    try {
      console.log(`Sending email to: ${mailData.recipient}`);
      const response = await gptMailApi.post('/send/', {
        title: mailData.title,
        description: mailData.description,
        dateOfPost: mailData.date,
        persona: "Abj",
        link: mailData.link,
        city: mailData.city,
        recipient: mailData.recipient
      });
      return response.data;
    } catch (error) {
      console.error('Error sending mail via MailGenrator:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`Server responded with ${error.response.status}:`, error.response.data);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from server');
      }
      throw error;
    }
  },

  // Helper function to parse mail response into subject and content
  parseMailResponse: (response) => {
    try {
      const [subjectLine, ...contentParts] = response.split('\n\n');
      let subject = subjectLine.replace('Subject:', '').trim();
      // Sanitize the subject
      subject = sanitizeSubject(subject);
      const content = contentParts.join('\n\n');
      return {
        subject: subject,
        content: content.trim()
      };
    } catch (error) {
      console.error('Error parsing mail response:', error);
      return {
        subject: '',
        content: response
      };
    }
  }
};
