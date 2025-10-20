import React from 'react';
import { CameraIcon } from './IconComponents';

type HeaderProps = {
  onRecord: (dimension: '3D' | '4D') => void;
};

const Header: React.FC<HeaderProps> = ({ onRecord }) => {
  return (
    <header className="bg-slate-900/40 backdrop-blur-sm border-b border-slate-700 shadow-lg sticky top-0 z-10 animate-slideInDown">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
           <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" />
           </svg>
           <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
             Spam Sentinel AI
           </h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onRecord('4D')} 
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800/60 transition-colors"
            aria-label="Start 4D screen recording"
          >
            <CameraIcon className="w-4 h-4" />
            4D Record
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;