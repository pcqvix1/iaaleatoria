
import React, { useState } from 'react';
import { CloseIcon, TuneIcon } from './Icons';

interface SystemInstructionModalProps {
  onClose: () => void;
  onSave: (instruction: string) => void;
  currentInstruction?: string;
}

export const SystemInstructionModal: React.FC<SystemInstructionModalProps> = ({ onClose, onSave, currentInstruction }) => {
  const [instruction, setInstruction] = useState(currentInstruction || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(instruction);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gpt-dark rounded-lg shadow-2xl w-full max-w-lg m-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TuneIcon />
            Personalizar IA (System Instructions)
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gpt-light-gray"
            aria-label="Fechar modal"
          >
            <CloseIcon />
          </button>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400">
            Defina como a IA deve se comportar nesta conversa.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="instruction" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Instrução
            </label>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ex: Você é um professor de física experiente que explica conceitos complexos de forma simples..."
              rows={6}
              className="w-full px-3 py-2 text-gray-800 bg-gray-50 dark:text-gray-100 dark:bg-gpt-light-gray border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gpt-green focus:border-gpt-green sm:text-sm"
            />
          </div>
          
          <div className="flex justify-end pt-2 gap-2">
             <button
              type="button"
              onClick={() => { setInstruction(''); }}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              Limpar
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-white bg-gpt-green rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gpt-green dark:focus:ring-offset-gpt-dark transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
