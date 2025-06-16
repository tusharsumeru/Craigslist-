/**
 * Formats a job description into a structured and readable format
 * @param {string} description - The raw job description text
 * @returns {Object} - Structured description object
 */
export const formatDescription = (description) => {
  // Remove craigslist and map data copyright notices
  let cleanDesc = description.replace(/© craigslist.*?OpenStreetMap/g, '').trim();

  // Extract title if it exists
  const titleMatch = cleanDesc.match(/^([^\n]+)/);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract compensation if it exists
  const compensationMatch = cleanDesc.match(/compensation:\s*([^\n]+)/i);
  const compensation = compensationMatch ? compensationMatch[1].trim() : '';

  // Remove title and compensation from main description
  cleanDesc = cleanDesc
    .replace(/^[^\n]+/, '') // Remove title
    .replace(/compensation:.*?\n/i, '') // Remove compensation line
    .trim();

  // Split into paragraphs
  const paragraphs = cleanDesc
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Process bullet points and lists
  const processedParagraphs = paragraphs.map(paragraph => {
    // Check if paragraph contains bullet points or numbered lists
    if (paragraph.includes('•') || paragraph.includes('o ')) {
      const lines = paragraph.split('\n').map(line => line.trim());
      const items = lines
        .filter(line => line.startsWith('•') || line.startsWith('o '))
        .map(line => line.replace(/^[•o]\s*/, '').trim());
      
      return {
        type: 'list',
        items: items
      };
    }
    
    return {
      type: 'text',
      content: paragraph
    };
  });

  // Extract contact information
  const contactInfo = {
    phone: '',
    email: ''
  };

  const phoneMatch = cleanDesc.match(/\(?(\d{3}[-\s]?\d{3}[-\s]?\d{4})\)?/);
  const emailMatch = cleanDesc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

  if (phoneMatch) contactInfo.phone = phoneMatch[0];
  if (emailMatch) contactInfo.email = emailMatch[0];

  // Extract URLs
  const urls = cleanDesc.match(/https?:\/\/[^\s]+/g) || [];

  return {
    title,
    compensation,
    paragraphs: processedParagraphs,
    contactInfo,
    urls,
    original: description // Keep original for reference
  };
};

/**
 * Formats the structured description into HTML
 * @param {Object} formattedDesc - The structured description object
 * @returns {string} - HTML formatted description
 */
export const formatDescriptionToHTML = (formattedDesc) => {
  let html = '';

  // Add title if exists
  if (formattedDesc.title) {
    html += `<h2 class="text-xl font-bold mb-4">${formattedDesc.title}</h2>`;
  }

  // Add compensation if exists
  if (formattedDesc.compensation) {
    html += `<p class="text-green-600 font-medium mb-4">${formattedDesc.compensation}</p>`;
  }

  // Add paragraphs
  formattedDesc.paragraphs.forEach(paragraph => {
    if (paragraph.type === 'list') {
      html += '<ul class="list-disc pl-6 mb-4">';
      paragraph.items.forEach(item => {
        html += `<li class="mb-2">${item}</li>`;
      });
      html += '</ul>';
    } else {
      html += `<p class="mb-4">${paragraph.content}</p>`;
    }
  });

  // Add contact information if exists
  if (formattedDesc.contactInfo.phone || formattedDesc.contactInfo.email) {
    html += '<div class="mt-4 p-4 bg-gray-50 rounded-lg">';
    html += '<h3 class="font-bold mb-2">Contact Information:</h3>';
    if (formattedDesc.contactInfo.phone) {
      html += `<p>Phone: ${formattedDesc.contactInfo.phone}</p>`;
    }
    if (formattedDesc.contactInfo.email) {
      html += `<p>Email: ${formattedDesc.contactInfo.email}</p>`;
    }
    html += '</div>';
  }

  // Add URLs if exist
  if (formattedDesc.urls.length > 0) {
    html += '<div class="mt-4">';
    html += '<h3 class="font-bold mb-2">Links:</h3>';
    html += '<ul class="list-disc pl-6">';
    formattedDesc.urls.forEach(url => {
      html += `<li><a href="${url}" class="text-blue-600 hover:underline" target="_blank">${url}</a></li>`;
    });
    html += '</ul>';
    html += '</div>';
  }

  return html;
}; 