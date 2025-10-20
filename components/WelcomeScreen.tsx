import React from 'react';

const WelcomeScreen: React.FC<{ onAnimationEnd: () => void }> = ({ onAnimationEnd }) => {
  return (
    <div 
      className="fixed inset-0 animated-gradient-bg flex items-center justify-center z-50 animate-fadeOut"
      onAnimationEnd={onAnimationEnd}
      aria-live="polite"
      aria-label="Spam Sentinel AI is loading"
    >
      <div className="text-center animate-fadeInScaleUp p-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 sm:w-24 sm:h-24 text-blue-400 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" />
        </svg>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 tracking-tight mt-6">
          Spam Sentinel AI
        </h1>
        <p className="text-slate-300 mt-2 text-lg">Securing your inbox.</p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
