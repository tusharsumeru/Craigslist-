import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import InfoCard from '../components/InfoCard'
import { toast } from 'react-hot-toast'
import { mailerService } from '../api/MailerApi'
import { gptMailService } from '../api/GPTmailApi'
import { emailLoggerService, setupDailyExport } from '../api/EmailLoggerService'

function Send() {
  const location = useLocation();
  const navigate = useNavigate();
  const [generatedMails, setGeneratedMails] = useState([]);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [isSending, setIsSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState({});
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    failed: 0
  });

  // Get today's email logs
  const [todayLogs, setTodayLogs] = useState([]);
  
  // Update logs when stats change
  useEffect(() => {
    setTodayLogs(emailLoggerService.getLogsByDate());
  }, [stats]);

  // Set up the daily email export schedule when component mounts
  useEffect(() => {
    setupDailyExport();
    // Clean up function not needed since the timer persists
  }, []);

  useEffect(() => {
    if (!location.state?.generatedMails) {
      toast.error('Please generate mail templates first');
      navigate('/generate');
      return;
    }
    setGeneratedMails(location.state.generatedMails);
    setStats(prev => ({ ...prev, total: location.state.generatedMails.length }));
  }, [location, navigate]);

  const handleSelectAll = () => {
    if (selectedCards.size === generatedMails.length) {
      setSelectedCards(new Set());
    } else {
      const allIds = generatedMails.map(mail => mail.id);
      setSelectedCards(new Set(allIds));
    }
  };

  const sendSingleMail = async (mail) => {
    try {
      setSendingStatus(prev => ({ ...prev, [mail.id]: { isSending: true } }));
      let sent = false;
      let emailLogData = {
        title: mail.Title,
        recipient: mail.email,
        subject: mail.subject,
        city: mail.City,
        link: mail.link,
        date: mail.date,
        success: false // Default to false, update if successful
      };

      // Skip the direct method for Craigslist emails - use only the mailer service
      if (mail.email && mail.email.includes('craigslist.org')) {
        console.log(`Sending Craigslist email to ${mail.email} using only the mailer service`);
        
        try {
          await mailerService.sendMail({
            email: mail.email,
            subject: mail.subject,
            mail_body: mail.MailTemplate
          });
          sent = true;
          emailLogData.success = true;
        } catch (mailerError) {
          console.error('Error using mailer service for Craigslist email:', mailerError);
          emailLogData.success = false;
          emailLogData.error = mailerError.message;
          throw mailerError; // Re-throw to be caught by the outer catch
        }
      } else {
        // For non-Craigslist emails, try both methods
        try {
          // Try the unified approach first using the MailGenrator service
          const result = await gptMailService.sendMail({
            title: mail.Title,
            description: mail.Description,
            date: mail.date,
            link: mail.link,
            city: mail.City,
            recipient: mail.email
          });
          
          if (result && result.success) {
            sent = true;
            emailLogData.success = true;
          } else {
            // If the result doesn't indicate success, try the fallback method
            await mailerService.sendMail({
              email: mail.email,
              subject: mail.subject,
              mail_body: mail.MailTemplate
            });
            sent = true;
            emailLogData.success = true;
          }
        } catch (error) {
          console.log("Direct method failed, trying fallback method");
          emailLogData.error = error.message;
          
          try {
            // Fallback to the original mailer service
            await mailerService.sendMail({
              email: mail.email,
              subject: mail.subject,
              mail_body: mail.MailTemplate
            });
            sent = true;
            emailLogData.success = true;
          } catch (fallbackError) {
            console.error('Error using fallback mailer service:', fallbackError);
            emailLogData.success = false;
            emailLogData.error = fallbackError.message;
            throw fallbackError; // Re-throw to be caught by the outer catch
          }
        }
      }

      // Log the email sending attempt
      emailLoggerService.logSentEmail(emailLogData);

      if (sent) {
        setSendingStatus(prev => ({ ...prev, [mail.id]: { isSending: false, isSent: true } }));
        setStats(prev => ({ ...prev, sent: prev.sent + 1 }));
        toast.success(`Mail sent successfully to ${mail.email}`);
      }
    } catch (error) {
      console.error('All mail sending methods failed:', error);
      setSendingStatus(prev => ({ ...prev, [mail.id]: { isSending: false, isSent: false } }));
      setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      toast.error(`Failed to send mail to ${mail.email}`);
    }
  };

  const handleSendMail = async () => {
    if (selectedCards.size === 0) {
      toast.warning('Please select at least one mail to send');
      return;
    }

    setIsSending(true);
    const selectedMails = generatedMails.filter(mail => selectedCards.has(mail.id));
    
    for (const mail of selectedMails) {
      await sendSingleMail(mail);
      // Wait for 3 seconds before sending the next mail
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    setIsSending(false);
  };

  const handleTemplateUpdate = (updatedTemplate) => {
    setGeneratedMails(prevMails => 
      prevMails.map(mail => {
        if (mail.id === updatedTemplate.id) {
          return {
            ...mail,
            MailTemplate: updatedTemplate.description
          };
        }
        return mail;
      })
    );
    toast.success('Template updated successfully');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-[90vh] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-purple-200 text-xl sm:text-2xl font-bold">Send</h1>
          <div className="text-sm text-gray-400 mt-1">
            Progress: {stats.sent} sent, {stats.failed} failed out of {stats.total} total
          </div>
          <div className="text-sm text-green-400 mt-1">
            Today's Count: {todayLogs.filter(log => log.status === 'Sent').length} emails sent today
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleSendMail}
            disabled={isSending || selectedCards.size === 0}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isSending || selectedCards.size === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isSending ? 'Sending...' : 'Send Mail'}
          </button>
          <button
            onClick={handleSelectAll}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {selectedCards.size === generatedMails.length ? 'Unselect All' : 'Select All'}
          </button>
          <button
            onClick={() => {
              const success = emailLoggerService.exportToCSV();
              if (success) {
                toast.success('Email report exported successfully');
              } else {
                toast.error('No emails to export for today');
              }
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Export Report
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto mb-6">
        {generatedMails.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-white text-lg sm:text-xl">No mail templates found</p>
              <p className="text-gray-400 text-sm mt-2">Please complete the generate process first</p>
            </div>
          </div>
        ) : (
          generatedMails.map((mail, index) => (
            <InfoCard
              key={mail.id || index}
              data={{
                id: mail.id || index,
                city: mail.City,
                title: mail.Title,
                description: mail.Description,
                email: mail.email,
                date: mail.date,
                selectedTemplate: mail.MailTemplate,
                subject: mail.subject
              }}
              isSelected={selectedCards.has(mail.id || index)}
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
              showMailTemplate={true}
              mailTemplates={[{
                id: mail.id || index,
                name: mail.Title,
                description: mail.MailTemplate,
                subject: mail.subject
              }]}
              onMailTemplateSelect={(template) => {
                console.log('Selected template:', template);
              }}
              onTemplateUpdate={handleTemplateUpdate}
              isSending={sendingStatus[mail.id]?.isSending}
              isSent={sendingStatus[mail.id]?.isSent}
            />
          ))
        )}
      </div>
      
      {/* Today's Email Log Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-purple-200 text-lg font-bold">Today's Email Activity</h2>
          
          {/* Summary Stats */}
          <div className="flex gap-6 text-sm">
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <span className="text-gray-300">Total Sent:</span> 
              <span className="text-green-400 ml-2 font-bold">
                {todayLogs.filter(log => log.status === 'Sent').length}
              </span>
            </div>
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <span className="text-gray-300">Failed:</span> 
              <span className="text-red-400 ml-2 font-bold">
                {todayLogs.filter(log => log.status === 'Failed').length}
              </span>
            </div>
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <span className="text-gray-300">Success Rate:</span> 
              <span className={`ml-2 font-bold ${todayLogs.length > 0 ? 
                (todayLogs.filter(log => log.status === 'Sent').length / todayLogs.length >= 0.8 ? 
                  'text-green-400' : 'text-yellow-400') : 
                'text-gray-400'}`}>
                {todayLogs.length > 0 ? 
                  `${Math.round(todayLogs.filter(log => log.status === 'Sent').length / todayLogs.length * 100)}%` : 
                  'N/A'}
              </span>
            </div>
          </div>
        </div>
        
        {todayLogs.length > 0 ? (
          <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs uppercase bg-gray-700">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">City</th>
                </tr>
              </thead>
              <tbody>
                {todayLogs.map((log, index) => (
                  <tr key={index} className={`border-b border-gray-700 ${log.status === 'Sent' ? 'bg-green-900 bg-opacity-20' : 'bg-red-900 bg-opacity-20'}`}>
                    <td className="px-4 py-2">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-2">{log.recipient || log.email || 'N/A'}</td>
                    <td className="px-4 py-2">{log.subject || 'N/A'}</td>
                    <td className="px-4 py-2">{log.status}</td>
                    <td className="px-4 py-2">{log.city || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No email activity recorded today</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Send
