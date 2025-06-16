export const base64ToCSV = (base64Data, filename) => {
  try {
    // If base64Data is already a string, use it directly
    let data = base64Data;
    
    // If it's an object with a data property, use that
    if (typeof base64Data === 'object' && base64Data.data) {
      data = base64Data.data;
    }

    // Ensure the data is a string
    if (typeof data !== 'string') {
      throw new Error('Invalid data format: expected string or object with data property');
    }

    // Add padding if needed
    while (data.length % 4) {
      data += '=';
    }

    // Decode base64 string
    const binaryString = window.atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob from bytes
    const blob = new Blob([bytes], { type: 'text/csv' });
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Error converting base64 to CSV:', error);
    return false;
  }
}; 