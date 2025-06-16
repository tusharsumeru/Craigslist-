import axios from 'axios';
import { API_BASE_URLS } from '../config/api';

const scraperApi = axios.create({
    baseURL: API_BASE_URLS.scraper,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
});

// Create and export the scraperService object
export const scraperService = {
    cleanFrontendFiles: async() => {
        try {
            // This uses the DELETE /api/clean-frontend-files endpoint to clean all files in the frontend output folder
            const response = await scraperApi.delete('/clean-frontend-files');
            console.log('Frontend files cleanup response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error cleaning frontend files:', error);
            throw error;
        }
    },

    updateConfig: async(configData) => {
        try {
            const response = await scraperApi.post('/update-config', configData);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    startScraping: async(options = {}) => {
        try {
            // Calculate timeout based on the number of cities if provided
            const numberOfCities = options.numberOfCities || 1;
            // Base: 30 seconds per city with a minimum of 3 minutes, maximum of 10 minutes
            const dynamicTimeout = Math.min(
                Math.max(numberOfCities * 30000, 180000), // Min 3 minutes
                600000 // Max 10 minutes
            );

            // Use a longer timeout for scraping as it can take a while
            const response = await axios({
                method: 'post',
                url: `${API_BASE_URLS.scraper}/start-scraping`,
                timeout: options.timeout || dynamicTimeout, // Use provided timeout or calculate based on cities
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                }
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    checkScrapingStatus: async() => {
        try {
            const response = await scraperApi.get('/scraping-status');
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    getResults: async() => {
        try {
            // Always use the enhanced save_to_frontend=true parameter 
            // This ensures the file is saved to the frontend public directory
            const response = await scraperApi.get('/download-results', {
                params: { save_to_frontend: true }
            });

            // Return enhanced response with file URL information
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // Check if results file exists in the frontend public directory
    checkResultsFileExists: async() => {
        try {
            // Use the files endpoint to check if results.csv exists
            const response = await scraperApi.get('/files');

            if (response.data.success && response.data.files) {
                // Check if results.csv is in the list of files
                const resultsFile = response.data.files.find(file => file.name === 'results.csv');

                if (resultsFile) {
                    return {
                        exists: true,
                        fileInfo: resultsFile
                    };
                }
            }

            return { exists: false };
        } catch (error) {
            console.warn('Error checking if results file exists:', error);
            return { exists: false, error };
        }
    },

    listFiles: async() => {
        try {
            const response = await scraperApi.get('/files');
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    deleteFile: async(filename) => {
        try {
            const response = await scraperApi.delete(`/files/${filename}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    cleanup: async() => {
        try {
            const response = await scraperApi.post('/cleanup');
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // Force reset of scraper to ensure proper cleanup between sessions
    resetScraper: async() => {
        try {
            // First, attempt to cleanup the backend
            try {
                await scraperApi.post('/cleanup');
            } catch (error) {
                console.warn('Cleanup error during reset:', error);
                // Continue with reset even if cleanup fails
            }

            // Clean frontend files to ensure a fresh start
            try {
                await scraperApi.delete('/clean-frontend-files');
            } catch (error) {
                console.warn('Frontend files cleanup error during reset:', error);
                // Continue with reset even if file cleanup fails
            }

            // Reset scraping status
            try {
                // We don't have a direct endpoint for this, but we can check status 
                // to ensure we're in sync with backend
                await scraperApi.get('/scraping-status');
            } catch (error) {
                console.warn('Status check error during reset:', error);
            }

            return { success: true, message: 'Scraper reset complete' };
        } catch (error) {
            console.error('Complete failure during scraper reset:', error);
            return { success: false, error: error.message };
        }
    }
};