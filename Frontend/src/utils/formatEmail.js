/**
 * Extracts the actual email address from a Gmail compose URL
 * @param {string} gmailUrl - The Gmail compose URL
 * @returns {string} - The extracted email address or null if not found
 */
export const extractEmailFromGmailUrl = (gmailUrl) => {
  try {
    // Check if the URL is a Gmail compose URL
    if (!gmailUrl.includes('mail.google.com/mail/?view=cm')) {
      return null;
    }

    // Create URL object to parse the URL
    const url = new URL(gmailUrl);
    
    // Get the 'to' parameter from the URL
    const toParam = url.searchParams.get('to');
    
    if (!toParam) {
      return null;
    }

    // Decode the URL-encoded email address
    const decodedEmail = decodeURIComponent(toParam);
    
    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(decodedEmail)) {
      return null;
    }

    return decodedEmail;
  } catch (error) {
    console.error('Error extracting email from Gmail URL:', error);
    return null;
  }
};

/**
 * Extracts additional information from a Gmail compose URL
 * @param {string} gmailUrl - The Gmail compose URL
 * @returns {Object} - Object containing extracted information
 */
export const extractGmailInfo = (gmailUrl) => {
  try {
    const url = new URL(gmailUrl);
    
    return {
      to: url.searchParams.get('to') ? decodeURIComponent(url.searchParams.get('to')) : null,
      subject: url.searchParams.get('su') ? decodeURIComponent(url.searchParams.get('su')) : null,
      body: url.searchParams.get('body') ? decodeURIComponent(url.searchParams.get('body')) : null,
      cc: url.searchParams.get('cc') ? decodeURIComponent(url.searchParams.get('cc')) : null,
      bcc: url.searchParams.get('bcc') ? decodeURIComponent(url.searchParams.get('bcc')) : null
    };
  } catch (error) {
    console.error('Error extracting Gmail info:', error);
    return null;
  }
}; 