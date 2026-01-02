
import React, { useState, useRef, useEffect } from 'react';
import { type ModelId } from '../types';
import { SparklesIcon } from './Icons';

interface ModelSelectorProps {
  currentModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  disabled?: boolean;
}

const models: { id: ModelId; name: string; description: string; provider: string }[] = [
  { 
    id: 'gemini-2.5-flash', 
    name: 'Gemini 2.5 Flash', 
    description: 'Rápido, multimodal e atualizado (Google).',
    provider: 'Google'
  },
  { 
    id: 'deepseek/deepseek-r1-0528:free', 
    name: 'DeepSeek R1 (Free)', 
    description: 'Raciocínio avançado via OpenRouter.',
    provider: 'OpenRouter'
  },
  { 
    id: 'openai/gpt-oss-20b', 
    name: 'GPT-OSS 20B', 
    description: 'Modelo O1-like via Groq.',
    provider: 'Groq'
  }
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onSelectModel, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find(m => m.id === currentModel) || models[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200 font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <span>{selectedModel.name}</span>
        <svg 
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gpt-gray border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="p-2 space-y-1">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelectModel(model.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
                  currentModel === model.id 
                    ? 'bg-gray-100 dark:bg-gray-700/50' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                }`}
              >
                <div className={`mt-1 p-1.5 rounded-md ${
                    model.id.includes('gemini') ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                    model.id.includes('deepseek') ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                    'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                }`}>
                    <SparklesIcon />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{model.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                        {model.provider}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {model.description}
                  </p>
                </div>
                {currentModel === model.id && (
                  <div className="ml-auto mt-1">
                     <svg className="w-4 h-4 text-gpt-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
