/**
 * Formats a date string into DD-MM-YY format
 * @param {string|Date} date - The date to format (can be Date object or date string)
 * @returns {string} - Formatted date string in DD-MM-YY format
 */
export const formatDate = (date) => {
  try {
    // Handle unknown or empty dates
    if (!date || date === 'Unknown' || date.trim() === '') {
      return 'Not available';
    }

    // Special case for common Craigslist date formats
    if (typeof date === 'string') {
      // Example: "2023-01-15" or "2023-01-15 12:34" or "Jan 15" or "January 15"
      const cleanDate = date.trim();
      
      // Check for numeric month patterns first (2023-01-15)
      const isoPattern = /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/;
      const isoMatch = cleanDate.match(isoPattern);
      
      if (isoMatch) {
        const year = isoMatch[1].slice(-2); // Last 2 digits of year
        const month = isoMatch[2].padStart(2, '0');
        const day = isoMatch[3].padStart(2, '0');
        return `${day}-${month}-${year}`;
      }

      // Check for month name patterns (Jan 15 or January 15)
      const monthNamePattern = /([A-Za-z]{3,})\s+(\d{1,2})/;
      const monthNameMatch = cleanDate.match(monthNamePattern);
      
      if (monthNameMatch) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                           'july', 'august', 'september', 'october', 'november', 'december'];
        const monthName = monthNameMatch[1].toLowerCase();
        const monthIndex = monthNames.findIndex(m => m.startsWith(monthName.slice(0, 3)));
        
        if (monthIndex !== -1) {
          const month = (monthIndex + 1).toString().padStart(2, '0');
          const day = monthNameMatch[2].padStart(2, '0');
          // Use current year if year is not in the string
          const today = new Date();
          const year = today.getFullYear().toString().slice(-2);
          return `${day}-${month}-${year}`;
        }
      }
    }
    
    // Fallback to standard date parsing
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date format:', date);
      return 'Not available';
    }
    
    // Get day, month, and year
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear().toString().slice(-2); // Get last 2 digits of year
    
    // Return formatted date
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Not available';
  }
};

/**
 * Formats a date string into a more readable format with time
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date string with time
 */
export const formatDateWithTime = (date) => {
  try {
    // Handle unknown or empty dates
    if (!date || date === 'Unknown' || date.trim() === '') {
      return 'Not available';
    }
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
      return formatDate(date); // Use the formatDate function as fallback
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear().toString().slice(-2);
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date with time:', error);
    return 'Not available';
  }
}; 