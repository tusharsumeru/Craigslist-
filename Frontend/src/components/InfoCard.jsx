import React, { useState } from 'react';
import { FiCheck, FiX, FiLoader } from 'react-icons/fi';
import DescriptionPanel from './DescriptionPanel';
import MailTemplatePanel from './MailTemplatePanel';

function InfoCard({ 
  data, 
  isSelected, 
  onSelect, 
  showMailTemplate = false,
  mailTemplates = [],
  onMailTemplateSelect,
  isSending = false,
  isSent = false
}) {
  const [showDescription, setShowDescription] = useState(false);
  const [showMailTemplatePanel, setShowMailTemplatePanel] = useState(false);

  const handleSelect = () => {
    if (!isSending) {
      onSelect(data.id);
    }
  };

  return (
    <div className={`w-4/5 mx-auto bg-white rounded-lg shadow-lg p-6 mb-6 transition-colors duration-300 ${
      isSent ? 'bg-green-50' : ''
    }`}>
      {/* Main Content */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column - Main Info */}
        <div className="space-y-3">
          <div className="flex items-center">
            <span className="font-semibold text-gray-700 w-24">City:</span>
            <span className="text-gray-900">{data.city}</span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold text-gray-700 w-24">Title:</span>
            <span className="text-gray-900">{data.title}</span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold text-gray-700 w-24">Date:</span>
            <span className="text-gray-900">
              {data.date || (() => {
                const today = new Date();
                const day = today.getDate().toString().padStart(2, '0');
                const month = (today.getMonth() + 1).toString().padStart(2, '0');
                const year = today.getFullYear().toString().slice(-2);
                return `${day}-${month}-${year}`;
              })()}
            </span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold text-gray-700 w-24">Email:</span>
            <span className="text-gray-900">{data.email}</span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold text-gray-700 w-24">Link:</span>
            <a href={data.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              View Job Posting
            </a>
          </div>
        </div>

        {/* Right Column - Actions */}
        <div className="flex flex-col items-end space-y-4">
          {/* Description Button */}
          <button
            onClick={() => setShowDescription(true)}
            className="text-blue-600 hover:text-blue-800 font-medium"
            disabled={isSending}
          >
            Description
          </button>

          {/* Mail Template Button - Only shown in Send page */}
          {showMailTemplate && (
            <button
              onClick={() => setShowMailTemplatePanel(true)}
              className="text-green-600 hover:text-green-800 font-medium"
              disabled={isSending}
            >
              Mail Template
            </button>
          )}

          {/* Selection Checkbox */}
          <button
            onClick={handleSelect}
            className={`mt-auto p-2 rounded-full transition-colors ${
              isSending ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'
            }`}
            disabled={isSending}
          >
            {isSending ? (
              <FiLoader className="w-6 h-6 text-blue-500 animate-spin" />
            ) : isSelected ? (
              <FiCheck className="w-6 h-6 text-green-500" />
            ) : (
              <FiX className="w-6 h-6 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Description Panel */}
      <DescriptionPanel
        isOpen={showDescription}
        onClose={() => setShowDescription(false)}
        description={data.description}
      />

      {/* Mail Template Panel */}
      {showMailTemplate && (
        <MailTemplatePanel
          isOpen={showMailTemplatePanel}
          onClose={() => setShowMailTemplatePanel(false)}
          templates={mailTemplates}
          onSelect={onMailTemplateSelect}
          selectedTemplate={data.selectedTemplate}
        />
      )}
    </div>
  );
}

export default InfoCard; 