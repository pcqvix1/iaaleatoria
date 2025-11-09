import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { PaperAirplaneIcon, StopIcon, PaperclipIcon, CloseIcon, FileIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (input: string, attachment?: { data: string; mimeType: string; name: string; }) => void;
  isGenerating: boolean;
  onStopGenerating: () => void;
}

export type ChatInputHandles = {
  setFile: (file: File) => void;
};

export const ChatInput = forwardRef<ChatInputHandles, ChatInputProps>(({ onSendMessage, isGenerating, onStopGenerating }, ref) => {
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    setFile: (file: File) => {
      processFile(file);
    },
  }));

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 192; // 12rem or max-h-48
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);
  
  const processFile = (file: File) => {
    if (attachedFile) return;

    setAttachedFile(file);
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setFilePreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    } else {
        setFilePreviewUrl(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          return;
        }
      }
    }
  };

  const handleRemoveFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setAttachedFile(null);
    setFilePreviewUrl(null);
  };

  const handleSend = () => {
    if ((!input.trim() && !attachedFile) || isGenerating) return;

    if (attachedFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            onSendMessage(input, { data: base64Data, mimeType: attachedFile.type, name: attachedFile.name });
            handleRemoveFile();
            setInput('');
        };
        reader.readAsDataURL(attachedFile);
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
  
  const FilePreview = () => {
    if (!attachedFile) return null;

    return (
        <div className="mb-2 p-2 bg-gray-100 dark:bg-gpt-gray rounded-lg relative w-auto max-w-sm animate-fade-in">
            <div className="flex items-center gap-2">
                {filePreviewUrl ? (
                    <img src={filePreviewUrl} alt="Preview" className="w-16 h-16 object-cover rounded-md" />
                ) : (
                    <div className="w-16 h-16 flex items-center justify-center bg-gray-200 dark:bg-gpt-light-gray rounded-md">
                        <FileIcon />
                    </div>
                )}
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{attachedFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{Math.round(attachedFile.size / 1024)} KB</p>
                </div>
            </div>
             <button
                onClick={handleRemoveFile}
                className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-1 hover:bg-red-500 transition-colors shadow-md"
                aria-label="Remove file"
            >
                <CloseIcon />
            </button>
        </div>
    )
  }

  return (
    <div className="relative">
        <FilePreview />
      <div className="flex items-end bg-white dark:bg-gpt-light-gray rounded-xl shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 focus-within:ring-2 focus-within:ring-gpt-green dark:focus-within:ring-gpt-green transition-shadow duration-200">
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileInputChange} 
            className="hidden" 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar arquivo"
          className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green disabled:opacity-50"
          disabled={isGenerating || !!attachedFile}
        >
          <PaperclipIcon />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
            disabled={(!input.trim() && !attachedFile) || isGenerating}
            aria-label="Enviar mensagem"
            className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green disabled:opacity-50 disabled:hover:text-gray-500"
          >
            <PaperAirplaneIcon />
          </button>
        )}
      </div>
    </div>
  );
});
