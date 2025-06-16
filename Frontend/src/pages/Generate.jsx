import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import InfoCard from '../components/InfoCard';
import { toast } from 'react-hot-toast';
import { formatDate } from '../utils/formatDate';
import { extractEmailFromGmailUrl } from '../utils/formatEmail';
import { gptMailService } from '../api/GPTmailApi';
import { scraperService } from '../api/scrapperApi';
import { useNavigate } from 'react-router-dom';
import { templateLoggerService, setupDailyTemplateExport } from '../api/TemplateLoggerService';

function Generate() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMails, setGeneratedMails] = useState([]);
  
  // Template tracking
  const [todayTemplates, setTodayTemplates] = useState([]);
  
  // Set up daily export and load today's templates
  useEffect(() => {
    setupDailyTemplateExport();
    setTodayTemplates(templateLoggerService.getLogsByDate());
  }, []);

  useEffect(() => {
    const processCSVData = async () => {
      try {
        setIsLoading(true);
        console.log('=== STARTING CSV PROCESSING ===');
        console.log('1. Fetching CSV file...');

        // First check if the file exists using the API
        try {
          const fileCheck = await scraperService.checkResultsFileExists();
          if (!fileCheck.exists) {
            console.warn('Results file not found via API check - will try direct fetch');
          } else {
            console.log('Results file confirmed to exist:', fileCheck.fileInfo);
          }
        } catch (error) {
          console.warn('Error checking file existence via API:', error);
        }

        // Attempt to fetch the file
        const response =  await fetch('/output/results.csv')
        
        if (!response.ok) {
          // Try alternative filename just in case
          const alternativeResponse = await fetch('/output/scraped_results.csv');
          if (!alternativeResponse.ok) {
            throw new Error(`Failed to fetch CSV file: ${response.status} ${response.statusText}`);
          }
          console.log('Using alternative filename: scraped_results.csv');
          return await processCSVResponse(alternativeResponse);
        }
        
        return await processCSVResponse(response);
      } catch (error) {
        console.error('CSV Processing Error:', error);
        toast.error('Failed to load job listings');
      } finally {
        setIsLoading(false);
      }
    };

    // Helper function to process CSV response
    const processCSVResponse = async (response) => {
      try {
        const csvText = await response.text();
        console.log('2. CSV File Content:', csvText);
        
        return new Promise((resolve, reject) => {
          Papa.parse(csvText, {
            complete: (result) => {
              console.log('3. Parsed CSV Result:', result);
              
              // Get column names from first row
              const columnNames = result.data[0];
              console.log('4. Column Names:', columnNames);
  
              // Get data rows (excluding header)
              const dataRows = result.data.slice(1);
              console.log('5. Data Rows:', dataRows);
  
              const processedCards = dataRows
                .filter(row => {
                  console.log('6. Filtering Row:', row);
                  return row && row.length >= columnNames.length;
                })
                .map((row, index) => {
                  try {
                    console.log(`7. Processing Row ${index + 1}:`, row);
  
                    // Create an object using column names as keys
                    const rowData = {};
                    columnNames.forEach((name, index) => {
                      rowData[name] = row[index];
                    });
  
                    console.log('8. Row Data Object:', rowData);
  
                    // Format date
                    console.log('9. Sending date to formatDate utility:', rowData['Post Date']);
                    let formattedDate = '';
                    try {
                      // Check if date is empty or undefined
                      if (!rowData['Post Date'] || rowData['Post Date'].trim() === '') {
                        // Use today's date as fallback
                        const today = new Date();
                        const day = today.getDate().toString().padStart(2, '0');
                        const month = (today.getMonth() + 1).toString().padStart(2, '0');
                        const year = today.getFullYear().toString().slice(-2);
                        formattedDate = `${day}-${month}-${year}`;
                        console.log('10. Using today as fallback date:', formattedDate);
                      } else {
                        formattedDate = formatDate(rowData['Post Date']);
                        console.log('10. Formatted Date Result:', formattedDate);
                      }
                    } catch (error) {
                      console.warn('Date formatting error:', error);
                      // Use today's date as fallback on error
                      const today = new Date();
                      const day = today.getDate().toString().padStart(2, '0');
                      const month = (today.getMonth() + 1).toString().padStart(2, '0');
                      const year = today.getFullYear().toString().slice(-2);
                      formattedDate = `${day}-${month}-${year}`;
                      console.log('10. Using today as error fallback date:', formattedDate);
                    }
  
                    // Extract email
                    console.log('11. Processing Email:', {
                      originalEmail: rowData['Email'],
                      gmailUrl: rowData['Gmail']
                    });
                    
                    let extractedEmail = rowData['Email'].replace(/\n/g, '');
                    if (!extractedEmail && rowData['Gmail']) {
                      console.log('12. Attempting to extract email from Gmail URL');
                      extractedEmail = extractEmailFromGmailUrl(rowData['Gmail']);
                      console.log('13. Extracted Email Result:', extractedEmail);
                    }
  
                    // Create card object with fallback date
                    const card = {
                      id: Math.random().toString(36).substr(2, 9),
                      city: rowData['City'],
                      title: rowData['Title'],
                      date: formattedDate !== 'Not available' ? formattedDate : (() => {
                        const today = new Date();
                        const day = today.getDate().toString().padStart(2, '0');
                        const month = (today.getMonth() + 1).toString().padStart(2, '0');
                        const year = today.getFullYear().toString().slice(-2);
                        return `${day}-${month}-${year}`;
                      })(),
                      email: extractedEmail,
                      description: rowData['Description'].replace(/\\n/g, '\n'),
                      link: rowData['Link']
                    };
  
                    console.log('14. Created Card Object:', card);
                    return card;
                  } catch (error) {
                    console.warn('Error processing row:', error);
                    return null;
                  }
                })
                .filter(card => {
                  const isValid = card !== null && card.title && card.email;
                  console.log('15. Card Validation:', { card, isValid });
                  return isValid;
                });
  
              console.log('16. Final Processed Cards:', processedCards);
              setCards(processedCards);
              
              if (processedCards.length > 0) {
                console.log('17. Success: Cards loaded into state');
                toast.success(`Loaded ${processedCards.length} job listings`);
                resolve(processedCards);
              } else {
                console.log('18. Warning: No valid cards found');
                toast.error('No valid job listings found in the CSV file');
                resolve([]);
              }
            },
            header: false,
            skipEmptyLines: true,
            error: (error) => {
              console.error('Papa Parse Error:', error);
              toast.error('Error parsing CSV file');
              reject(error);
            }
          });
        });
      } catch (error) {
        console.error('Error processing CSV response:', error);
        throw error;
      }
    };

    processCSVData();
  }, []);

  // Log when cards state changes
  useEffect(() => {
    console.log('19. Cards State Updated:', cards);
  }, [cards]);

  const handleGenerate = async () => {
    if (selectedCards.size === 0) {
      toast.error('Please select at least one job to generate templates');
      return;
    }

    setIsGenerating(true);
    const selectedJobsCount = selectedCards.size;
    
    try {
      // Filter cards to only process selected ones
      const selectedJobCards = cards.filter(card => selectedCards.has(card.id));
      const processedMails = [];
      
      // Show a notification about potential wait time with Llama 3 70B
      toast.success(`Using Llama 3 70B model - generation may take 1-2 minutes per email`);

      // Process each selected card
      for (let i = 0; i < selectedJobCards.length; i++) {
        const card = selectedJobCards[i];
        try {
          // Show progress
          toast.success(`Generating email ${i+1}/${selectedJobCards.length}: ${card.title}`);
          
          // Format the date to YYYY-MM-DD
          let formattedDate;
          try {
            if (!card.date || card.date === 'Not available') {
              // Use current date if no date available
              const today = new Date();
              formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
            } else {
              const dateParts = card.date.split('-');
              formattedDate = `20${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }
          } catch (error) {
            console.warn('Error formatting date for API call:', error);
            // Use current date as fallback
            const today = new Date();
            formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
          }

          // Generate mail using gptMailService
          console.log(`Starting generation for ${card.title} - this may take 1-2 minutes with Llama 3 70B`);
          const startTime = Date.now();
          
          const response = await gptMailService.generateMail({
            title: card.title,
            description: card.description,
            date: formattedDate,
            link: card.link,
            city: card.city,
            persona: "Abj"
          });
          
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`Email generation completed in ${elapsedTime} seconds`);
          
          // Parse the response
          const { subject, content } = gptMailService.parseMailResponse(response);

          // Store the processed mail with proper separation
          processedMails.push({
            id: card.id,
            Title: card.title,
            City: card.city,
            Description: card.description, // Original job description
            Content: card.description, // Original content/description
            subject: subject,
            MailTemplate: content, // Generated mail template from GPT
            email: card.email, // Add the email address
            date: card.date, // Ensure date is properly passed to the Send page
            link: card.link // Include the link
          });
          
          // Log the template generation
          templateLoggerService.logGeneratedTemplate({
            title: card.title,
            city: card.city,
            email: card.email,
            subject: subject,
            link: card.link,
            success: true
          });
          
          // Update the today's templates count
          setTodayTemplates(templateLoggerService.getLogsByDate());

          // Success notification
          toast.success(`Generated email ${i+1}/${selectedJobCards.length} in ${elapsedTime}s`);
          
          // Wait for 2 seconds before processing the next card
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log('Successfully generated mail for:', card.title);
        } catch (error) {
          console.error('Error generating mail for card:', card.title, error);
          
          // Log the failed template generation
          templateLoggerService.logGeneratedTemplate({
            title: card.title,
            city: card.city,
            email: card.email,
            link: card.link,
            success: false,
            error: error.message
          });
          
          // Update the today's templates count
          setTodayTemplates(templateLoggerService.getLogsByDate());
          
          toast.error(`Failed to generate mail for ${card.title}`);
        }
      }

      if (processedMails.length > 0) {
        setGeneratedMails(processedMails);
        toast.success(`Successfully generated ${processedMails.length} mail templates`);
        navigate('/send', { state: { generatedMails: processedMails } });
      } else {
        toast.error('Failed to generate any mail templates');
      }
    } catch (error) {
      console.error('Error generating mails:', error);
      toast.error('Failed to generate mail templates');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-[90vh] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-purple-200 text-xl sm:text-2xl font-bold">Generate</h1>
          <div className="text-sm text-green-400 mt-1">
            Today's Count: {todayTemplates.filter(template => template.status === 'Generated').length} templates generated today
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => {
              const success = templateLoggerService.exportToCSV();
              if (success) {
                toast.success('Template report exported successfully');
              } else {
                toast.error('No templates to export for today');
              }
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Export Report
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedCards.size === 0}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isGenerating || selectedCards.size === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isGenerating ? 'Generating...' : 'Generate Templates'}
          </button>
          <button
            onClick={() => {
              const newSelection = new Set(cards.map(card => card.id));
              setSelectedCards(newSelection);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Select All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-white text-lg sm:text-xl">No job listings found</p>
              <p className="text-gray-400 text-sm mt-2">Please check the console for more details</p>
            </div>
          </div>
        ) : (
          cards.map(card => {
            console.log('20. Rendering Card:', card);
            return (
              <InfoCard
                key={card.id}
                data={card}
                isSelected={selectedCards.has(card.id)}
                onSelect={(cardId) => {
                  setSelectedCards(prev => {
                    const newSelection = new Set(prev);
                    if (newSelection.has(cardId)) {
                      newSelection.delete(cardId);
                    } else {
                      newSelection.add(cardId);
                    }
                    return newSelection;
                  });
                }}
              />
            );
          })
        )}
      </div>
      
      {/* Today's Template Activity Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-purple-200 text-lg font-bold">Today's Template Activity</h2>
          
          {/* Summary Stats */}
          <div className="flex gap-6 text-sm">
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <span className="text-gray-300">Total Generated:</span> 
              <span className="text-green-400 ml-2 font-bold">
                {todayTemplates.filter(template => template.status === 'Generated').length}
              </span>
            </div>
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <span className="text-gray-300">Failed:</span> 
              <span className="text-red-400 ml-2 font-bold">
                {todayTemplates.filter(template => template.status === 'Failed').length}
              </span>
            </div>
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <span className="text-gray-300">Success Rate:</span> 
              <span className={`ml-2 font-bold ${todayTemplates.length > 0 ? 
                (todayTemplates.filter(template => template.status === 'Generated').length / todayTemplates.length >= 0.8 ? 
                  'text-green-400' : 'text-yellow-400') : 
                'text-gray-400'}`}>
                {todayTemplates.length > 0 ? 
                  `${Math.round(todayTemplates.filter(template => template.status === 'Generated').length / todayTemplates.length * 100)}%` : 
                  'N/A'}
              </span>
            </div>
          </div>
        </div>
        
        {todayTemplates.length > 0 ? (
          <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs uppercase bg-gray-700">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">City</th>
                </tr>
              </thead>
              <tbody>
                {todayTemplates.map((template, index) => (
                  <tr key={index} className={`border-b border-gray-700 ${template.status === 'Generated' ? 'bg-green-900 bg-opacity-20' : 'bg-red-900 bg-opacity-20'}`}>
                    <td className="px-4 py-2">{new Date(template.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-2">{template.title || 'N/A'}</td>
                    <td className="px-4 py-2">{template.email || 'N/A'}</td>
                    <td className="px-4 py-2">{template.subject || 'N/A'}</td>
                    <td className="px-4 py-2">{template.status}</td>
                    <td className="px-4 py-2">{template.city || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No template activity recorded today</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Generate;