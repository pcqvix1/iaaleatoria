
import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, StopIcon, PaperclipIcon, XCircleIcon } from './Icons';
import { type ImagePart } from '../types';

interface ChatInputProps {
  onSendMessage: (input: string, image?: ImagePart) => void;
  isGenerating: boolean;
  onStopGenerating: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isGenerating, onStopGenerating }) => {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<{ url: string; base64: string; mimeType: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Clean up object URL when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (image?.url) {
        URL.revokeObjectURL(image.url);
      }
    };
  }, [image]);

  const handleSend = () => {
    if ((input.trim() || image) && !isGenerating) {
      onSendMessage(input, image ? { base64: image.base64, mimeType: image.mimeType } : undefined);
      setInput('');
      if (image?.url) URL.revokeObjectURL(image.url);
      setImage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
    // Reset file input to allow selecting the same file again
    if(event.target) {
      event.target.value = '';
    }
  };
  
  // FIX: Iterate through clipboard files to find an image. This is more robust
  // than using Array.from which can have type inference issues with FileList in
  // some TypeScript configurations.
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    for (let i = 0; i < event.clipboardData.files.length; i++) {
      const file = event.clipboardData.files[i];
      if (file && file.type.startsWith('image/')) {
        event.preventDefault();
        processFile(file);
        // Process only the first image found
        break;
      }
    }
  };
  
  const processFile = (file: File) => {
    if (image?.url) {
      URL.revokeObjectURL(image.url);
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setImage({
        url: URL.createObjectURL(file),
        base64: base64String,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    if (image?.url) {
      URL.revokeObjectURL(image.url);
    }
    setImage(null);
  };


  return (
    <div className="relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        aria-hidden="true"
      />
      {image && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gpt-light-gray rounded-lg shadow-md border border-gray-200 dark:border-gray-600 animate-fade-in">
            <div className="relative">
                <img src={image.url} alt="Preview" className="h-20 w-20 object-cover rounded-md" />
                <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors"
                    aria-label="Remover imagem"
                >
                    <XCircleIcon />
                </button>
            </div>
        </div>
      )}
      <div className="flex items-center bg-white dark:bg-gpt-light-gray rounded-xl shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 focus-within:ring-2 focus-within:ring-gpt-green dark:focus-within:ring-gpt-green transition-shadow duration-200">
        <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Anexar imagem"
            className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green"
            disabled={isGenerating}
        >
            <PaperclipIcon />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Envie uma mensagem ou anexe uma imagem..."
          rows={1}
          className="w-full resize-none bg-transparent py-2 pr-2 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none max-h-48"
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
            disabled={(!input.trim() && !image) || isGenerating}
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
