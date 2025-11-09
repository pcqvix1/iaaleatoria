
import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, StopIcon, PaperclipIcon, CloseIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (input: string, image?: { data: string; mimeType: string; }) => void;
  isGenerating: boolean;
  onStopGenerating: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isGenerating, onStopGenerating }) => {
  const [input, setInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 192; // 12rem or max-h-48
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSend = () => {
    if ((!input.trim() && !imageFile) || isGenerating) return;

    if (imageFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            onSendMessage(input, { data: base64Data, mimeType: imageFile.type });
            handleRemoveImage();
            setInput('');
        };
        reader.readAsDataURL(imageFile);
    } else {
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
      {imagePreview && (
        <div className="mb-2 p-2 bg-gray-100 dark:bg-gpt-gray rounded-lg relative w-24 h-24 animate-fade-in">
          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-md" />
          <button
            onClick={handleRemoveImage}
            className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors"
            aria-label="Remove image"
          >
            <CloseIcon />
          </button>
        </div>
      )}
      <div className="flex items-end bg-white dark:bg-gpt-light-gray rounded-xl shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 focus-within:ring-2 focus-within:ring-gpt-green dark:focus-within:ring-gpt-green transition-shadow duration-200">
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageChange} 
            accept="image/*" 
            className="hidden" 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar imagem"
          className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green disabled:opacity-50"
          disabled={isGenerating}
        >
          <PaperclipIcon />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
          className="w-full resize-none bg-transparent py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none max-h-48"
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
            disabled={(!input.trim() && !imageFile) || isGenerating}
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
