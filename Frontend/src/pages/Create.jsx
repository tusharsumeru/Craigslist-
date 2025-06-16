import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { FiInfo } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import LoadingOverlay from '../components/LoadingOverlay'
import { base64ToCSV } from '../utils/base64ToCSV'
import { scraperService } from '../api/scrapperApi'
import ReactDOM from 'react-dom'

// Add retry logic
const retryRequest = async (fn, retries = 3, delay = 2000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryRequest(fn, retries - 1, delay);
  }
};

function Create() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    urls: '',
    jobs: ''
  })
  const [selectedUrls, setSelectedUrls] = useState([])
  const [showKeywordsTooltip, setShowKeywordsTooltip] = useState(false)
  const keywordsRef = useRef(null)
  const urlDropdownRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const scrapingTimeoutRef = useRef(null)
  const downloadIntervalRef = useRef(null)
  const [scrapingStartTime, setScrapingStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerIntervalRef = useRef(null)
  const [currentUrl, setCurrentUrl] = useState(null)
  const [showUrlDropdown, setShowUrlDropdown] = useState(false)
  const [availableUrls, setAvailableUrls] = useState([])

  // Default keywords array
  const defaultKeywords = [
    "website development", "wordpress", "mobile app", "php", "laravel",
    "mern", "mean", "next.js", "react", "node.js", "full stack",
    "devops", "blockchain", "ethereum", "solidity", "nft", "3d artist",
    "digital marketing", "seo", "social media", "shopify", "wix", "e-commerce",
    "python", "django", "javascript", "typescript", "vue.js", "angular",
    "aws", "cloud", "database", "sql", "nosql", "mongodb", "postgresql",
    "ui/ux", "web design", "graphic design", "data science", "machine learning",
    "ai", "automation", "qa testing", "software testing", "system admin",
    "network", "cyber security", "flutter", "swift", "ios development",
    "android development", "game development"
  ]
  
  // Initialize selectedKeywords with default keywords
  const [selectedKeywords, setSelectedKeywords] = useState([...defaultKeywords])

  // Keyword categories for organization
  const keywordCategories = {
    "Web Development": ["website development", "wordpress", "php", "laravel", "mern", "mean", "next.js", "react", "node.js", "full stack", "javascript", "typescript", "vue.js", "angular"],
    "Mobile Development": ["mobile app", "flutter", "swift", "ios development", "android development"],
    "Design": ["ui/ux", "web design", "graphic design"],
    "Data & AI": ["data science", "machine learning", "ai", "database", "sql", "nosql", "mongodb", "postgresql"],
    "Blockchain": ["blockchain", "ethereum", "solidity", "nft"],
    "DevOps & Cloud": ["devops", "aws", "cloud"],
    "Digital Marketing": ["digital marketing", "seo", "social media", "e-commerce", "shopify", "wix"],
    "Other": ["3d artist", "automation", "qa testing", "software testing", "system admin", "network", "cyber security", "python", "django", "game development"]
  }
  
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchKeyword, setSearchKeyword] = useState('')

  const filteredKeywords = selectedCategory === 'All' 
    ? defaultKeywords 
    : keywordCategories[selectedCategory] || []

  const displayKeywords = searchKeyword
    ? filteredKeywords.filter(keyword => keyword.toLowerCase().includes(searchKeyword.toLowerCase()))
    : filteredKeywords

  useEffect(() => {
    // Load URLs data
    fetch('/cities/usa_cities_by_state.json')
      .then(response => response.json())
      .then(data => {
        // Extract all URLs from the urls array
        const allUrls = data.urls || [];
        
        // Set the URLs in the form
        if (allUrls.length > 0) {
          setSelectedUrls(allUrls.map(urlObj => urlObj.url));
          setFormData(prev => ({
            ...prev,
            urls: allUrls.map(urlObj => urlObj.url).join(', ')
          }));
          setAvailableUrls(allUrls);
        }
      })
      .catch(error => {
        console.error('Error loading URLs data:', error);
      });
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (keywordsRef.current && !keywordsRef.current.contains(event.target)) {
        setShowKeywordsTooltip(false);
      }
      if (urlDropdownRef.current && !urlDropdownRef.current.contains(event.target)) {
        setShowUrlDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set initial jobs field value with default keywords on component mount
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      jobs: defaultKeywords.join(', ')
    }));
  }, []);

  useEffect(() => {
    // Update URLs input field when URLs are selected
    setFormData(prev => ({
      ...prev,
      urls: selectedUrls.join(', ')
    }))
  }, [selectedUrls])

  useEffect(() => {
    // Update jobs input field when keywords are selected
    setFormData(prev => ({
      ...prev,
      jobs: selectedKeywords.join(', ')
    }))
  }, [selectedKeywords])

  const handleChange = (e) => {
    const { name, value } = e.target
    
    if (name === 'urls') {
      // Handle URLs field to manage whole URLs
      const previousLength = formData.urls.length;
      const newLength = value.length;
      const wasDeleting = newLength < previousLength;
      
      if (wasDeleting) {
        const urls = value.split(',').map(u => u.trim()).filter(u => u);
        if (urls.length < selectedUrls.length) {
          setSelectedUrls(urls);
          setFormData(prev => ({
            ...prev,
            [name]: urls.join(', ')
          }));
          return;
        } else if (value.endsWith(', ') || value.endsWith(',')) {
          setFormData(prev => ({
            ...prev,
            [name]: value
          }));
          return;
        } else {
          const lastCommaIndex = value.lastIndexOf(',');
          if (lastCommaIndex >= 0) {
            const urlsExceptLast = value.substring(0, lastCommaIndex).split(',')
              .map(u => u.trim()).filter(u => u);
            
            setSelectedUrls(urlsExceptLast);
            setFormData(prev => ({
              ...prev,
              [name]: value
            }));
          } else {
            setSelectedUrls([]);
            setFormData(prev => ({
              ...prev,
              [name]: value
            }));
          }
          return;
        }
      } else {
        if (value.endsWith(', ') || value.endsWith(',')) {
          const urls = value.split(',').map(u => u.trim()).filter(u => u);
          setSelectedUrls(urls);
        }
        
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
        return;
      }
    } else if (name === 'jobs') {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));

      const inputKeywords = value.split(',').map(k => k.trim()).filter(k => k);
      const uniqueKeywords = inputKeywords.filter(keyword => 
        !defaultKeywords.includes(keyword)
      );
      
      setSelectedKeywords([...defaultKeywords, ...uniqueKeywords]);
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const updateConfig = async () => {
    try {
      setLoadingMessage('Updating configuration...');
      const configData = {
        urls: selectedUrls,
        keywords: selectedKeywords,
        use_headless: false,
        batch_size: Math.min(5, Math.max(1, Math.ceil(selectedUrls.length / 5))), // Dynamic batch size: 1-5 URLs per batch
        max_retries: 3,
        timeout_per_url: 0, // 0 means no timeout - let each URL take as long as needed
        save_partial_results: true, // Save results even if process is interrupted
        infinite_mode: true // New flag to indicate there should be no timeout
      };

      await scraperService.updateConfig(configData);
      return true;
    } catch (error) {
      console.error('Error updating config:', error);
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
        toast.error('Cannot connect to server. Please check if the server is running.');
      } else {
        toast.error('Failed to update configuration: ' + (error.response?.data?.message || error.message));
      }
      return false;
    }
  };

  const startScraping = async () => {
    try {
      const numberOfUrls = selectedUrls.length;
      // Maximum possible timeout - essentially infinite (24 hours)
      const estimatedTimeoutMs = 86400000; // 24 hours in milliseconds
      
      setLoadingMessage(`Starting scraping process for ${numberOfUrls} URLs (may take a long time)...`);
      
      try {
        // Log that we're making the request
        console.log(`Making start-scraping request with unlimited timeout`);
        
        // First check if there's an existing scraping job
        const status = await checkScrapingStatus();
        if (status && status.is_running) {
          console.log('A scraping job is already running:', status);
          setLoadingMessage(`Resuming existing scraping job (${status.progress || 0}% complete)...`);
          return { success: true, data: status, resumed: true };
        }
        
        // Make a single attempt to start scraping
        const response = await scraperService.startScraping({
          numberOfUrls: numberOfUrls,
          timeout: estimatedTimeoutMs,
          resume: true, // Add flag to tell backend to resume from where it left off if possible
          infinite_mode: true // Tell backend not to time out
        });
        
        // If we reach here, the scraping process was successfully started
        console.log('Scraping started successfully. Server response:', response);
        
        // Update the loading message to indicate success
        setLoadingMessage(`Scraping started successfully! Monitoring progress...`);
        
        return { success: true, data: response };
      } catch (error) {
        console.error('Error starting scraping:', error);
        
        // Handle timeout errors - continue with status checking
        if (error.code === 'ECONNABORTED') {
          console.error('Timeout error when starting scraping - this is normal for multiple URLs');
          console.error('The server is likely still processing the request, continuing with status monitoring');
          
          // Update message to indicate timeout but continued processing
          setLoadingMessage(`Timeout reached while starting scraper. Continuing with monitoring...`);
          
          return { success: true, timedOut: true }; // Continue with status monitoring even with timeout
        }
        
        // For other errors that aren't network-related, we should still check status
        if (error.code === 'ERR_NETWORK') {
          toast.error('Cannot connect to server. Please check if the server is running.');
          return { success: false, error };
        }
        
        // For any other error, assume scraping might have started and continue with status checks
        console.warn('Error in start scraping call, but continuing with status checks:', error.message);
        setLoadingMessage(`Error starting scraper, but checking if processing started anyway...`);
        return { success: true, timedOut: true, error };
      }
    } catch (error) {
      console.error('Unhandled error in startScraping:', error);
      toast.error('An unexpected error occurred when starting the scraping process');
      return { success: false, error };
    }
  };

  const checkScrapingStatus = async () => {
    try {
      const status = await retryRequest(async () => {
        return await scraperService.checkScrapingStatus();
      }, 3, 2000);
      
      if (status) {
        // Update current URL if available
        if (status.current_url) {
          setCurrentUrl(status.current_url);
        }
        
        // Handle different status cases
        if (status.is_running) {
          const progressPercent = status.progress || 0;
          const phaseMessage = status.current_phase || 'Scraping in progress';
          setLoadingMessage(`${phaseMessage} (Progress: ${progressPercent}%)`);
        } else if (status.completed) {
          setCurrentUrl(null);
          setLoadingMessage('Scraping completed! Getting results...');
        } else if (status.error) {
          setLoadingMessage(`Error: ${status.error}`);
        }
      }
      
      return status;
    } catch (error) {
      console.error('Error checking scraping status:', error);
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
        console.warn('Network error when checking status - will retry next cycle');
      }
      return null;
    }
  };

  const downloadResults = async () => {
    try {
      setLoadingMessage('Preparing results file...');
      
      // Step 1: Check if results file already exists in public directory
      const fileCheck = await scraperService.checkResultsFileExists();
      
      if (fileCheck.exists) {
        console.log('Results file already exists in frontend directory:', fileCheck.fileInfo);
        toast.success('Results file is ready to use!');
        return true;
      }
      
      // Step 2: If file doesn't exist, save it to frontend using the enhanced API
      console.log('Results file not found, requesting server to save it...');
      
      try {
        const resultsData = await scraperService.getResults();
        console.log('Server response for file save:', resultsData);
        
        if (resultsData.success) {
          // File was successfully saved to frontend directory
          toast.success('Results file has been saved successfully!');
          return true;
        } else if (resultsData.content) {
          // Fallback for older server versions - handle base64 content
          console.log('Server returned base64 content instead of saving file directly');
          const filename = resultsData.filename || 'results.csv';
          const success = base64ToCSV(resultsData.content, filename);
          
          if (success) {
            toast.success(`Results downloaded as ${filename}`);
            return true;
          } else {
            toast.error('Failed to process the downloaded file');
            return false;
          }
        } else {
          toast.error('Failed to save or download results file');
          return false;
        }
      } catch (error) {
        console.error('Error getting results:', error);
        
        // Final attempt: Check again if the file exists (it might have been saved despite the error)
        const finalCheck = await scraperService.checkResultsFileExists();
        if (finalCheck.exists) {
          console.log('Results file found after error:', finalCheck.fileInfo);
          toast.success('Results file is available despite errors!');
          return true;
        }
        
        toast.error('Failed to save or download results');
        return false;
      }
    } catch (error) {
      console.error('Error in download process:', error);
      toast.error('Failed to process results');
      return false;
    }
  };

  // Timer function to track elapsed time
  const startScrapingTimer = () => {
    setScrapingStartTime(Date.now())
    setElapsedTime(0)
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }
    
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - scrapingStartTime) / 1000)
      setElapsedTime(elapsed)
    }, 1000)
  }
  
  const stopScrapingTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }
  
  // Format elapsed time in HH:MM:SS format
  const formatElapsedTime = (seconds) => {
    if (!seconds) return '00:00:00'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Pass current city info to loading overlay
  const getLoadingOverlayMessage = () => {
    if (currentUrl) {
      return (
        <div>
          {loadingMessage}
          <div className="mt-2 text-teal-300 font-medium">
            Currently processing: <span className="text-white">{currentUrl}</span>
          </div>
        </div>
      )
    }
    return loadingMessage
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset any existing state from previous scraping jobs
    if (downloadIntervalRef.current) {
      clearInterval(downloadIntervalRef.current);
      downloadIntervalRef.current = null;
    }
    if (scrapingTimeoutRef.current) {
      clearTimeout(scrapingTimeoutRef.current);
      scrapingTimeoutRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setCurrentUrl(null);
    
    setIsLoading(true);
    setLoadingMessage('Initializing process...');
    
    // Force cleanup before starting a new scraping job to ensure fresh state
    try {
      setLoadingMessage('Resetting previous scraping sessions...');
      await scraperService.resetScraper();
    } catch (error) {
      console.warn('Error during pre-scraping reset:', error);
      // Continue anyway as this is just a precaution
    }
    
    // Start the timer
    startScrapingTimer();
    
    // Recovery variables
    let retryCount = 0;
    const maxRetries = 3;
    let recoveryMode = false;
    
    // Status check settings
    const initialStatusCheckDelay = 10000; // 10 seconds initially

    try {
      // Calculate monitoring attempts - but don't use this as a hard timeout
      // We'll just use this to determine how often to check for status changes
      const numberOfUrls = selectedUrls.length;
      
      // We still calculate this for status update frequency, but we won't enforce it as a timeout
      const baseAttemptsPerUrl = 40;
      const minAttemptsLimit = 120;
      const calculatedMaxAttempts = Math.max(numberOfUrls * baseAttemptsPerUrl, minAttemptsLimit);
      
      console.log(`Status will be checked approximately every ${initialStatusCheckDelay/1000} seconds`);
      console.log(`Will check more frequently after ${calculatedMaxAttempts} checks`);
      
      // STEP 0: Clean frontend output directory first
      try {
        setLoadingMessage('Cleaning frontend output files...');
        const frontendCleanup = await scraperService.cleanFrontendFiles();
        console.log('Frontend output cleanup completed:', frontendCleanup);
        if (!frontendCleanup.success) {
          console.warn('Frontend cleanup may not have completed successfully:', frontendCleanup);
          // Continue anyway, as this is not critical
        } else {
          console.log(`Deleted ${frontendCleanup.deleted_count} files from frontend output directory`);
        }
      } catch (error) {
        console.error('Error cleaning frontend output files:', error);
        // Continue with the process, this error is not critical
      }

      // Step 1: Backend cleanup
      try {
        setLoadingMessage('Cleaning up server files...');
        const cleanupSuccess = await scraperService.cleanup();
        if (!cleanupSuccess) {
          throw new Error('Failed to clean up server files');
        }
        console.log('Server cleanup completed successfully');
      } catch (error) {
        console.error('Server cleanup error:', error);
        toast.error('Failed to clean up server files. Process stopped.');
        setIsLoading(false);
        return;
      }

      // Step 2: Update config
      setLoadingMessage('Updating configuration...');
      const configUpdated = await updateConfig();
      if (!configUpdated) {
        setIsLoading(false);
        return;
      }

      // Step 3: Start scraping
      const startScrapingWithRetries = async () => {
        let scrapingResult = { success: false };
        
        try {
          setLoadingMessage(`${recoveryMode ? 'Restarting' : 'Starting'} scraping process for ${numberOfUrls} URLs (est. max: ${formatElapsedTime(elapsedTime)})...`);
          scrapingResult = await startScraping();
          
          if (!scrapingResult.success && !scrapingResult.timedOut) {
            // If we've tried before, see if we can recover
            if (retryCount < maxRetries) {
              retryCount++;
              recoveryMode = true;
              toast.warning(`Scraping failed. Attempting recovery (Try ${retryCount}/${maxRetries})...`);
              
              // Wait 10 seconds before retrying
              await new Promise(resolve => setTimeout(resolve, 10000));
              return await startScrapingWithRetries();
            } else {
              setIsLoading(false);
              stopScrapingTimer();
              toast.error('Failed to start scraping after multiple attempts');
              return { success: false };
            }
          }
          
          // If we had a timeout, update the message but continue
          if (scrapingResult.timedOut) {
            toast.warning(`Scraping request is taking longer than expected. We'll monitor progress...`);
            setLoadingMessage(`Waiting for scraping status...`);
          } else {
            // Successful start
            setLoadingMessage(`Scraping started successfully. Monitoring progress...`);
          }
          
          return scrapingResult;
        } catch (error) {
          // Even if start scraping completely fails, we'll still try to check status
          console.error('Complete failure in start scraping, but will try status check:', error);
          
          // If we've tried before, see if we can recover
          if (retryCount < maxRetries) {
            retryCount++;
            recoveryMode = true;
            toast.warning(`Scraping failed. Attempting recovery (Try ${retryCount}/${maxRetries})...`);
            
            // Wait 10 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 10000));
            return await startScrapingWithRetries();
          }
          
          return { timedOut: true, error };
        }
      };
      
      const scrapingResult = await startScrapingWithRetries();
      
      if (!scrapingResult.success && !scrapingResult.timedOut && !recoveryMode) {
        setIsLoading(false);
        stopScrapingTimer();
        return;
      }

      // Custom function to update loading message with elapsed time
      const updateLoadingMessageWithTime = (msg) => {
        setLoadingMessage(`${msg} (Running: ${formatElapsedTime(elapsedTime)})`);
      }
      
      // Step 4: Monitor scraping status - no fixed timeout
      let attempts = 0;
      let lastStatus = null;
      let consecutiveErrorCount = 0;
      let statusCheckDelay = initialStatusCheckDelay; // Start with 10 seconds
      const maxStatusCheckDelay = 30000; // Maximum 30 seconds between checks
      
      // After this many checks, we'll reduce the check frequency to avoid overloading the server
      const frequencyReductionThreshold = calculatedMaxAttempts;
      let hasReducedFrequency = false;
      
      // Function to perform status check
      const performStatusCheck = async () => {
        attempts++;
        
        try {
          const status = await checkScrapingStatus();
          
          if (status) {
            // Reset error counter and back-off delay on successful status check
            if (consecutiveErrorCount > 0) {
              consecutiveErrorCount = 0;
              // Only reset delay if we haven't passed the frequency reduction threshold
              if (!hasReducedFrequency) {
                statusCheckDelay = 10000;
              }
            }
            
            // After many attempts, reduce the frequency of status checks to avoid server load
            if (attempts >= frequencyReductionThreshold && !hasReducedFrequency) {
              console.log(`Reducing status check frequency after ${attempts} checks`);
              clearInterval(downloadIntervalRef.current);
              statusCheckDelay = 30000; // Check every 30 seconds after the threshold
              downloadIntervalRef.current = setInterval(performStatusCheck, statusCheckDelay);
              hasReducedFrequency = true;
              
              // Notify the user that we're still working but checking less frequently
              toast.info("Scraping is taking longer than usual. Status will now update less frequently.");
            }
            
            // Log status every 10 attempts to avoid console spam
            if (attempts % 10 === 0) {
              console.log(`Current scraping status (check #${attempts}):`, status);
            }
            
            // Only update if status has changed
            if (JSON.stringify(status) !== JSON.stringify(lastStatus)) {
              lastStatus = status;
              
              // Handle different status cases
              if (status.is_running) {
                // Format the message based on the current phase
                const progressPercent = status.progress || 0;
                const phaseMessage = status.current_phase || 'Scraping in progress';
                const progressMessage = `Progress: ${progressPercent}%`;
                
                // Update current URL if available
                if (status.current_url) {
                  setCurrentUrl(status.current_url);
                }
                
                updateLoadingMessageWithTime(`${phaseMessage} (${progressMessage})`);
                
                // If progress is 0% for a long time, provide reassurance
                if (progressPercent === 0 && attempts > 30) {
                  toast.info("Scraping is taking longer than usual to start. This is normal for many URLs.");
                }
              } else if (status.completed) {
                clearInterval(downloadIntervalRef.current);
                stopScrapingTimer();
                setCurrentUrl(null);
                setLoadingMessage('Scraping completed! Getting results...');
                
                const downloaded = await downloadResults();
                if (downloaded) {
                  setIsLoading(false);
                  toast.success('Data found and ready to use!');
                  navigate('/generate');
                }
              } else if (status.no_results || (status.current_phase === null && status.last_completed === null)) {
                clearInterval(downloadIntervalRef.current);
                stopScrapingTimer();
                setIsLoading(false);
                toast.error('No results found for the specified criteria');
              } else if (status.error) {
                clearInterval(downloadIntervalRef.current);
                stopScrapingTimer();
                setIsLoading(false);
                toast.error(`Scraping error: ${status.last_completed || 'Unknown error'}`);
              }
            } else {
              // Status hasn't changed, but update the message periodically
              if (attempts % 5 === 0 && status.is_running) {
                // Update the progress without changing the whole message
                const progressPercent = status.progress || 0;
                const phaseMessage = status.current_phase || 'Scraping in progress';
                const progressMessage = `Progress: ${progressPercent}%`;
                
                // Update current URL if available
                if (status.current_url && status.current_url !== currentUrl) {
                  setCurrentUrl(status.current_url);
                }
                
                updateLoadingMessageWithTime(`${phaseMessage} (${progressMessage})`);
              }
            }
          } else {
            // No status received, implement backoff strategy
            consecutiveErrorCount++;
            console.warn(`No status received (attempt ${attempts}, error #${consecutiveErrorCount})`);
            
            // Increase delay between checks (exponential backoff)
            if (consecutiveErrorCount >= 3) {
              // Modify interval timing only after repeated failures
              const oldDelay = statusCheckDelay;
              statusCheckDelay = Math.min(statusCheckDelay * 1.5, maxStatusCheckDelay);
              
              if (oldDelay !== statusCheckDelay) {
                console.log(`Increasing status check delay to ${statusCheckDelay}ms`);
                
                // Reset interval with new delay
                clearInterval(downloadIntervalRef.current);
                downloadIntervalRef.current = setInterval(performStatusCheck, statusCheckDelay);
              }
              
              setLoadingMessage(`Waiting for status update... Server may be busy (Attempt ${attempts})`);
            }
          }
        } catch (error) {
          // Error in status check
          consecutiveErrorCount++;
          console.error(`Error checking status (attempt ${attempts}, error #${consecutiveErrorCount}):`, error);
          
          // Increase delay between checks (exponential backoff)
          if (consecutiveErrorCount >= 3) {
            const oldDelay = statusCheckDelay;
            statusCheckDelay = Math.min(statusCheckDelay * 1.5, maxStatusCheckDelay);
            
            if (oldDelay !== statusCheckDelay) {
              console.log(`Increasing status check delay to ${statusCheckDelay}ms`);
              
              // Reset interval with new delay
              clearInterval(downloadIntervalRef.current);
              downloadIntervalRef.current = setInterval(performStatusCheck, statusCheckDelay);
            }
            
            setLoadingMessage(`Retrying status check... Server may be busy (Attempt ${attempts})`);
          }
        }
      };
      
      console.log('Beginning status monitoring...');
      
      // Initial delay if needed
      if (scrapingResult?.timedOut) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Check status immediately to see if scraping is running
      try {
        console.log('Making initial status check...');
        const initialStatus = await checkScrapingStatus();
        console.log('Initial status check result:', initialStatus);
        
        if (initialStatus) {
          lastStatus = initialStatus;
          
          if (initialStatus.error) {
            setIsLoading(false);
            toast.error(`Scraping error: ${initialStatus.last_completed || 'Unknown error'}`);
            return;
          } else if (initialStatus.no_results) {
            setIsLoading(false);
            toast.warning('No results found for the specified criteria');
            return;
          } else if (initialStatus.completed) {
            // If already completed, download results immediately
            setLoadingMessage('Scraping already completed! Getting results...');
            const downloaded = await downloadResults();
            if (downloaded) {
              setIsLoading(false);
              toast.success('Data found and ready to use!');
              navigate('/generate');
              return;
            }
          } else if (initialStatus.is_running) {
            // Scraping is running, update message with current phase
            const progressPercent = initialStatus.progress || 0;
            const phaseMessage = initialStatus.current_phase || 'Scraping in progress';
            setLoadingMessage(`${phaseMessage} (Progress: ${progressPercent}%)`);
            
            console.log(`Scraping already in progress: ${phaseMessage}, ${progressPercent}%`);
          } else {
            // Status exists but doesn't indicate running or completion - keep monitoring
            setLoadingMessage('Waiting for scraping to begin...');
          }
        } else {
          // No status available yet, keep monitoring
          setLoadingMessage('Waiting for status update...');
        }
      } catch (error) {
        console.warn('Error on initial status check, will retry:', error);
        setLoadingMessage('Unable to get initial status, will continue monitoring...');
      }
      
      // Begin regular status polling
      const downloadInterval = setInterval(performStatusCheck, statusCheckDelay);
      downloadIntervalRef.current = downloadInterval;

    } catch (error) {
      console.error('Error in scraping process:', error);
      toast.error('An unexpected error occurred during the scraping process');
      setIsLoading(false);
    }
  };

  // Cleanup on component unmount and reset of state
  useEffect(() => {
    // Function to reset states when returning to the page
    const resetStates = async () => {
      if (downloadIntervalRef.current) {
        clearInterval(downloadIntervalRef.current);
        downloadIntervalRef.current = null;
      }
      if (scrapingTimeoutRef.current) {
        clearTimeout(scrapingTimeoutRef.current);
        scrapingTimeoutRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setIsLoading(false);
      setLoadingMessage('');
      setCurrentUrl(null);

      // Reset the backend scraper to ensure fresh state
      try {
        await scraperService.resetScraper();
      } catch (error) {
        console.warn('Failed to reset scraper:', error);
      }
    };

    // Add event listener for when the page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetStates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Reset when component mounts
    resetStates();

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (downloadIntervalRef.current) {
        clearInterval(downloadIntervalRef.current);
      }
      if (scrapingTimeoutRef.current) {
        clearTimeout(scrapingTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const removeCity = (cityToRemove) => {
    setSelectedUrls(prev => prev.filter(url => url !== cityToRemove));
  }

  const isFormValid = formData.urls.trim() !== '' && formData.jobs.trim() !== ''

  return (
    <div className="min-h-[calc(100vh-76px)] bg-gradient-to-br from-gray-900 to-purple-900 p-4 sm:p-6 lg:p-8">
      {isLoading && <LoadingOverlay message={getLoadingOverlayMessage()} />}
      <h1 className="text-purple-200 text-2xl sm:text-3xl font-bold mb-6 md:mb-8 text-center">Create New Scraping Request</h1>
      
      <div className="flex items-center justify-center">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 sm:gap-8 w-full max-w-4xl bg-gray-800/50 backdrop-blur-sm p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700">
          
          {/* URL Selection Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label htmlFor="urls" className="text-purple-200 font-medium text-lg flex items-center gap-2">
                URLs
                <span className="bg-purple-600/30 text-purple-200 text-xs px-2 py-1 rounded-full">
                  {selectedUrls.length} selected
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowUrlDropdown(!showUrlDropdown)}
                className="flex items-center gap-2 bg-purple-600/80 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add URL
              </button>
            </div>

            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <input 
                    type="text" 
                    id="urls"
                    name="urls"
                    value={formData.urls}
                    onChange={handleChange}
                    placeholder="Your selected URLs will appear here..." 
                    className="px-4 py-3 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full shadow-inner backdrop-blur-sm"
                    readOnly
                  />
                </div>
              </div>
              
              {/* Enhanced URL Dropdown */}
              {showUrlDropdown && (
                <div 
                  ref={urlDropdownRef} 
                  className="absolute top-full left-0 mt-2 w-full bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl z-20 border border-gray-700 transform transition-all duration-300 ease-out"
                >
                  <div className="p-4">
                    <h3 className="text-purple-200 font-medium mb-3 flex items-center justify-between">
                      Available URLs
                      <span className="text-xs text-gray-400">Click to add to selection</span>
                    </h3>
                    <div className="grid gap-3">
                      {availableUrls.map((urlObj, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg transition-all duration-300 cursor-pointer
                            ${selectedUrls.includes(urlObj.url) 
                              ? 'bg-purple-600/20 border border-purple-500/30' 
                              : 'bg-gray-700/50 hover:bg-gray-700 border border-gray-600/30'}`}
                          onClick={() => {
                            const newUrl = urlObj.url;
                            if (!selectedUrls.includes(newUrl)) {
                              setSelectedUrls([...selectedUrls, newUrl]);
                              setFormData(prev => ({
                                ...prev,
                                urls: prev.urls ? `${prev.urls}, ${newUrl}` : newUrl
                              }));
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center
                                ${selectedUrls.includes(urlObj.url) 
                                  ? 'bg-purple-500' 
                                  : 'border-2 border-gray-500'}`}
                              >
                                {selectedUrls.includes(urlObj.url) && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <h4 className="text-white font-medium">{urlObj.name}</h4>
                                <p className="text-xs text-gray-400 mt-1 truncate max-w-lg">{urlObj.url}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Selected URLs Display */}
            {selectedUrls.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-purple-200 font-medium">Selected URLs</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUrls([]);
                      setFormData(prev => ({ ...prev, urls: '' }));
                    }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUrls.map((url, idx) => {
                    const urlObj = availableUrls.find(u => u.url === url);
                    return (
                      <div 
                        key={idx} 
                        className="group bg-purple-900/30 rounded-lg px-3 py-2 border border-purple-700/30 flex items-center gap-2"
                      >
                        <span className="text-purple-200 text-sm">{urlObj?.name || 'URL'}</span>
                        <button 
                          type="button" 
                          className="text-purple-400 hover:text-white transition-colors"
                          onClick={() => removeCity(url)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2 mt-2 sm:mt-4">
            <div className="flex items-center justify-between">
              <label htmlFor="jobs" className="text-purple-200 font-medium text-lg flex items-center gap-2">
                Job Keywords
                <span className="bg-purple-600/30 text-purple-200 text-xs px-2 py-1 rounded-full">
                  {selectedKeywords.length} selected
                </span>
              </label>
              <button 
                type="button"
                onClick={() => setShowKeywordsTooltip(!showKeywordsTooltip)}
                className="flex items-center gap-2 bg-purple-600/80 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Keywords
              </button>
            </div>

            <div className="relative flex gap-2" ref={keywordsRef}>
              <div className="relative flex-grow">
                <input 
                  type="text" 
                  id="jobs"
                  name="jobs"
                  value={formData.jobs}
                  onChange={handleChange}
                  placeholder="Your selected keywords will appear here..." 
                  className="px-4 py-3 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full shadow-inner backdrop-blur-sm"
                />
                {selectedKeywords.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKeywords([]);
                      setFormData(prev => ({ ...prev, jobs: '' }));
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Keywords Modal */}
            {showKeywordsTooltip && ReactDOM.createPortal(
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowKeywordsTooltip(false);
                  }
                }}
              >
                <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
                <div 
                  className="relative bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden border border-gray-700"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-white text-lg font-medium">Select Keywords</h3>
                    <button 
                      type="button"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setShowKeywordsTooltip(false);
                      }}
                      className="text-gray-400 hover:text-white text-xl font-bold h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-700/50"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="p-4">
                    {/* Search and category filters */}
                    <div className="flex gap-3 mb-4">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Search keywords..."
                          value={searchKeyword}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          className="w-full px-3 py-2 pl-9 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <select 
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm min-w-[150px]"
                        value={selectedCategory}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="All">All Categories</option>
                        {Object.keys(keywordCategories).map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Keywords Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[calc(80vh-200px)] overflow-y-auto pr-2">
                      {(selectedCategory === 'All' ? Object.entries(keywordCategories) : [[selectedCategory, keywordCategories[selectedCategory]]]).map(([category, keywords]) => {
                        const filteredKeywords = searchKeyword
                          ? keywords.filter(k => k.toLowerCase().includes(searchKeyword.toLowerCase()))
                          : keywords;
                          
                        if (filteredKeywords.length === 0) return null;
                        
                        const categorySelectedCount = filteredKeywords.filter(k => selectedKeywords.includes(k)).length;
                        const isPartiallySelected = categorySelectedCount > 0 && categorySelectedCount < filteredKeywords.length;
                        const isFullySelected = categorySelectedCount === filteredKeywords.length;
                        
                        return (
                          <div key={category} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                <h4 className="text-purple-200 font-medium">{category}</h4>
                                <span className="text-xs bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded-full">
                                  {categorySelectedCount} / {filteredKeywords.length}
                                </span>
                              </div>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  if (isFullySelected) {
                                    setSelectedKeywords(prev => prev.filter(k => !filteredKeywords.includes(k)));
                                  } else {
                                    setSelectedKeywords(prev => [...new Set([...prev, ...filteredKeywords])]);
                                  }
                                }}
                                className={`text-xs px-3 py-1.5 rounded transition-colors ${
                                  isFullySelected
                                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                                    : isPartiallySelected
                                    ? 'bg-purple-900/50 text-purple-200 hover:bg-purple-700'
                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                }`}
                              >
                                {isFullySelected ? 'Deselect All' : 'Select All'}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {filteredKeywords.map((keyword, idx) => {
                                const isSelected = selectedKeywords.includes(keyword);
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      if (isSelected) {
                                        setSelectedKeywords(prev => prev.filter(k => k !== keyword));
                                      } else {
                                        setSelectedKeywords(prev => [...prev, keyword]);
                                      }
                                    }}
                                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                                      isSelected 
                                        ? 'bg-purple-600 text-white hover:bg-purple-700' 
                                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                    }`}
                                  >
                                    <span>{keyword}</span>
                                    <span className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                                      isSelected ? 'text-white/70' : 'text-gray-400'
                                    }`}>
                                      {isSelected ? '×' : '+'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="border-t border-gray-700 p-4 bg-gray-800">
                    <div className="flex justify-between items-center">
                      <div className="text-gray-400">
                        <span className="text-purple-300 font-medium">{selectedKeywords.length}</span> keywords selected
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedKeywords([]);
                          }}
                          className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors text-sm"
                        >
                          Clear All
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setShowKeywordsTooltip(false);
                          }}
                          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
          
          <div className="mt-6">
            <button 
              type="submit" 
              disabled={!isFormValid}
              className={`relative py-3 px-6 rounded-lg font-medium text-white text-base w-full transform transition-all duration-300 ${
                isFormValid 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' 
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>Start Scraping</span>
                {isFormValid && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
            <p className="text-gray-400 text-sm mt-3 text-center">Please ensure all required fields are filled</p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Create