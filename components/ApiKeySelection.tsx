
import React from 'react';

interface ApiKeySelectionProps {
  onSelectKey: () => void;
}

export const ApiKeySelection: React.FC<ApiKeySelectionProps> = ({ onSelectKey }) => {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-gray-100 dark:bg-gpt-gray">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gpt-dark rounded-lg shadow-md text-center animate-fade-in">
        <div className="flex justify-center text-gpt-green">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
            <path d="M12 3L9.27 9.27L3 12l6.27 2.73L12 21l2.73-6.27L21 12l-6.27-2.73L12 3z" />
            <path d="M4 4h.01" />
            <path d="M20 20h.01" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          API Key Necessária
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Para usar recursos avançados como a geração de imagens, você precisa selecionar uma chave de API do Google AI Studio.
          <br />
          Certifique-se de que o <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="font-medium text-gpt-green hover:underline">faturamento</a> esteja ativado para o seu projeto.
        </p>
        <div>
          <button
            onClick={onSelectKey}
            className="w-full px-4 py-2 text-white bg-gpt-green rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gpt-green dark:focus:ring-offset-gpt-dark transition-colors"
          >
            Selecionar Chave de API
          </button>
        </div>
      </div>
    </div>
  );
};
