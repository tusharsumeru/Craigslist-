import React from 'react';

const LoadingOverlay = ({ message = 'Processing...', status = null }) => {
  // Extract the progress percentage if present in the message
  let progressPercentage = null;
  let messageText = '';
  
  // Check if message is a React element or a string
  const isReactElement = React.isValidElement(message);
  
  if (!isReactElement) {
    messageText = message;
    const progressMatch = message.match(/Progress: (\d+)%/);
    if (progressMatch && progressMatch[1]) {
      progressPercentage = parseInt(progressMatch[1]);
    }
  }

  // Get phase information from status if available
  let phase = "";
  if (status) {
    phase = status.current_phase;
    progressPercentage = status.progress;
  } else if (isReactElement || !messageText) {
    // Don't try to parse phase from React elements
  } else if (messageText.includes('Phase 1:')) {
    phase = 'Finding Listings';
  } else if (messageText.includes('Phase 2: Cleaning')) {
    phase = 'Processing Listings';
  } else if (messageText.includes('Phase 2: Scraping details')) {
    phase = 'Extracting Details';
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          </div>
          
          {phase && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{phase}</h3>
            </div>
          )}

          {status?.last_completed && (
            <p className="text-sm text-gray-600 mb-2">{status.last_completed}</p>
          )}

          {progressPercentage !== null && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div 
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          )}

          <p className="text-gray-700">
            {isReactElement ? message : messageText || 'Processing...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay; 