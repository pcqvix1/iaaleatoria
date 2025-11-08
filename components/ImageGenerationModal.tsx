
import React, { useState } from 'react';
import { type AspectRatio } from '../types';
import { CloseIcon, SparklesIcon } from './Icons';

interface ImageGenerationModalProps {
  onClose: () => void;
  onGenerate: (prompt: string, aspectRatio: AspectRatio) => void;
}

const aspectRatios: { label: string; value: AspectRatio }[] = [
  { label: 'Quadrado', value: '1:1' },
  { label: 'Paisagem', value: '16:9' },
  { label: 'Retrato', value: '9:16' },
  { label: 'Largo', value: '4:3' },
  { label: 'Alto', value: '3:4' },
];

export const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({ onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      setIsLoading(true);
      onGenerate(prompt, selectedAspectRatio);
      // No need to set loading to false here, as the component will be unmounted.
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gpt-dark rounded-lg shadow-2xl w-full max-w-lg m-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon />
            Gerar Imagem com IA
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gpt-light-gray"
            aria-label="Fechar modal"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descreva a imagem que você quer criar
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Um gato astronauta flutuando no espaço, estilo cartoon..."
              rows={4}
              required
              className="w-full px-3 py-2 text-gray-800 bg-gray-50 dark:text-gray-100 dark:bg-gpt-light-gray border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gpt-green focus:border-gpt-green sm:text-sm"
            />
          </div>
          
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Proporção da Imagem
            </span>
            <div className="flex flex-wrap gap-2">
              {aspectRatios.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedAspectRatio(value)}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    selectedAspectRatio === value
                      ? 'bg-gpt-green text-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gpt-dark ring-gpt-green'
                      : 'bg-gray-200 dark:bg-gpt-light-gray text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="w-full sm:w-auto px-6 py-2 text-white bg-gpt-green rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gpt-green dark:focus:ring-offset-gpt-dark disabled:bg-opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Gerando...
                </>
              ) : (
                'Gerar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
