// Get the hostname (IP address) of the current machine
const getHostname = () => {
  // In development, you can replace this with your actual IP address
  return window.location.hostname;
};

// API base URLs
export const API_BASE_URLS = {
  scraper: `http://${getHostname()}:8000/api`,
  gptMail: `http://${getHostname()}:61325/api`,
  mailer: `http://${getHostname()}:8020`
}; 