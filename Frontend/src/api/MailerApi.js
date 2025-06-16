import axios from 'axios';
import { API_BASE_URLS } from '../config/api';

const mailerApi = axios.create({
  baseURL: API_BASE_URLS.mailer,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true
});

// Helper to sanitize the subject (remove newlines and carriage returns)
const sanitizeSubject = (subject) => {
  if (!subject) return "No Subject";
  return subject.replace(/[\r\n]+/g, ' ').trim();
};

// Create and export the mailerService object
export const mailerService = {
  sendMail: async (mailData) => {
    try {
      // Sanitize the subject to prevent email header errors
      const cleanSubject = sanitizeSubject(mailData.subject);
      
      const response = await mailerApi.post('/send-mail', {
        mail_id: mailData.email,
        subject: cleanSubject,
        mail_body: mailData.mail_body
      });
      return response.data;
    } catch (error) {
      console.error('Error sending mail:', error);
      throw error;
    }
  }
};
