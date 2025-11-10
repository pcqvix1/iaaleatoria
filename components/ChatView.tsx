
import React, { useEffect, useRef, useState } from 'react';
import { type Conversation } from '../types';
import { MessageBubble } from './Message';
import { ChatInput, type ChatInputHandles } from './ChatInput';
import { UploadCloudIcon } from './Icons';

interface ChatViewProps {
  conversation: Conversation | undefined;
  onSendMessage: (input: string, attachment?: { data: string; mimeType: string; name: string; }) => void;
  isTyping: boolean;
  onStopGenerating: () => void;
  onFileDrop: (file: File) => void;
  onGoToCanvas: () => void;
  chatInputRef: React.RefObject<ChatInputHandles>;
}

export const ChatView: React.FC<ChatViewProps> = ({ conversation, onSendMessage, isTyping, onStopGenerating, onFileDrop, onGoToCanvas, chatInputRef }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  return (
    <div 
      className="flex-1 flex flex-col bg-transparent overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-20 pointer-events-none animate-fade-in">
          <UploadCloudIcon />
          <p className="text-white text-lg font-semibold mt-2">Solte o arquivo para anexar</p>
        </div>
      )}
      <header className="relative w-full p-2 text-center text-sm text-gray-600 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700/50 flex-shrink-0">
        feito por Pedro Campos Queiroz
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-2">
          {conversation?.messages && conversation.messages.length > 0 ? (
            conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          ) : (
            <WelcomeScreen />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="w-full p-4 md:p-6 bg-transparent flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <ChatInput 
            ref={chatInputRef}
            onSendMessage={onSendMessage} 
            isGenerating={isTyping} 
            onStopGenerating={onStopGenerating}
            onGoToCanvas={onGoToCanvas}
          />
        </div>
      </div>
    </div>
  );
};

const WelcomeScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 h-full pt-20">
    <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Como posso te ajudar hoje?</h1>
  </div>
);