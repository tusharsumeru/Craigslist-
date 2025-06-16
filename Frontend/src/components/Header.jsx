import React from 'react'
import { useNavigate } from 'react-router-dom'

function Header({ currentPath }) {
  const navigate = useNavigate();

  const getButtonStyle = (path) => {
    const isActive = currentPath === path;
    return `px-3 sm:px-4 py-2 rounded-lg cursor-pointer transition-all duration-300 text-white text-sm sm:text-base font-medium ${
      isActive ? 'bg-blue-800 shadow-md' : 'bg-blue-600 hover:bg-blue-700 hover:shadow'
    }`;
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-700 shadow-md py-3 px-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
        <div>
          <h1 className="text-white text-xl sm:text-2xl font-bold">Craigslist Mailing Service</h1>
        </div>
        
        <div className="flex gap-2 sm:gap-4">
          <div 
            className={getButtonStyle('/')}
            onClick={() => navigate('/')}
          >
            Create
          </div>
          <div 
            className={getButtonStyle('/generate')}
            onClick={() => navigate('/generate')}
          >
            Generate
          </div>
          <div 
            className={getButtonStyle('/send')}
            onClick={() => navigate('/send')}
          >
            Send
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header