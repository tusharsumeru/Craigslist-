import React, { useState, useEffect } from 'react';
import { FiX, FiEdit2, FiSave } from 'react-icons/fi';

function MailTemplatePanel({ isOpen, onClose, templates, onSelect, selectedTemplate, onTemplateUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // Update editedContent when selectedTemplate changes
  useEffect(() => {
    if (selectedTemplate?.description) {
      setEditedContent(selectedTemplate.description);
    }
  }, [selectedTemplate]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (onTemplateUpdate && selectedTemplate) {
      onTemplateUpdate({
        ...selectedTemplate,
        description: editedContent
      });
      setIsEditing(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Mail Templates</h2>
          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={handleEdit}
                className="text-blue-600 hover:text-blue-800 p-2"
                title="Edit Template"
              >
                <FiEdit2 className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="text-green-600 hover:text-green-800 p-2"
                title="Save Changes"
              >
                <FiSave className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`p-4 rounded-lg border ${
                  selectedTemplate?.id === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                } ${!isEditing ? 'cursor-pointer' : ''}`}
                onClick={() => !isEditing && onSelect(template)}
              >
                <h3 className="font-medium text-gray-800">{template.name}</h3>
                {isEditing && selectedTemplate?.id === template.id ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-48 mt-2 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Enter your mail template..."
                    autoFocus
                  />
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{template.description}</p>
                    {template.link && (
                      <div className="mt-2 text-sm text-gray-500">
                        Job Reference: <a href={template.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{template.link}</a>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MailTemplatePanel; 