import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, StopIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (input: string) => void;
  isGenerating: boolean;
  onStopGenerating: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isGenerating, onStopGenerating }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !isGenerating) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center bg-white dark:bg-gpt-light-gray rounded-xl shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 focus-within:ring-2 focus-within:ring-gpt-green dark:focus-within:ring-gpt-green transition-shadow duration-200">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Envie uma mensagem..."
          rows={1}
          className="w-full resize-none bg-transparent py-2 pl-4 pr-2 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none max-h-48"
          disabled={isGenerating}
        />
        {isGenerating ? (
          <button
            onClick={onStopGenerating}
            aria-label="Parar geração"
            className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="Enviar mensagem"
            className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green disabled:opacity-50 disabled:hover:text-gray-500"
          >
            <PaperAirplaneIcon />
          </button>
        )}
      </div>
    </div>
  );
};
