
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { type Conversation } from '../types';
import { MessageBubble } from './Message';
import { ChatInput, type ChatInputHandles } from './ChatInput';
import { UploadCloudIcon, TuneIcon } from './Icons';
import { SystemInstructionModal } from './SystemInstructionModal';

interface ChatViewProps {
  conversation: Conversation | undefined;
  onSendMessage: (input: string, attachment?: { data: string; mimeType: string; name: string; }) => void;
  isTyping: boolean;
  onStopGenerating: () => void;
  onFileDrop: (file: File) => void;
  chatInputRef: React.RefObject<ChatInputHandles>;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
  onUpdateSystemInstruction?: (instruction: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ 
    conversation, 
    onSendMessage, 
    isTyping, 
    onStopGenerating, 
    onFileDrop, 
    chatInputRef,
    onEditMessage,
    onRegenerate,
    onUpdateSystemInstruction
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Scroll logic
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowScrollButton(false);
    setAutoScrollEnabled(true);
  };

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    // If user scrolls up significantly, disable auto-scroll
    if (!isAtBottom) {
        setAutoScrollEnabled(false);
        setShowScrollButton(true);
    } else {
        setAutoScrollEnabled(true);
        setShowScrollButton(false);
    }
  }, []);

  // Effect to auto-scroll when new messages arrive, IF auto-scroll is enabled
  useEffect(() => {
    if (autoScrollEnabled) {
       scrollToBottom('smooth');
    }
  }, [conversation?.messages, autoScrollEnabled, isTyping]);
  
  // Initial scroll when loading a conversation
  useEffect(() => {
      scrollToBottom('auto');
  }, [conversation?.id]);

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
        <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-20 pointer-events-none animate-fade-in backdrop-blur-sm">
          <UploadCloudIcon />
          <p className="text-white text-lg font-semibold mt-2">Solte o arquivo para anexar</p>
        </div>
      )}
      
      {/* Header with Persona Settings */}
      <header 
        className="relative w-full p-2 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700/50 flex-shrink-0 bg-white/50 dark:bg-black/20 backdrop-blur-sm z-10"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="w-8"></div> {/* Spacer */}
        <span>{conversation?.title || 'Nova Conversa'}</span>
        <button 
            onClick={() => setIsSettingsOpen(true)}
            className={`p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors ${conversation?.systemInstruction ? 'text-gpt-green' : ''}`}
            title="Personalizar IA (System Instructions)"
        >
            <TuneIcon />
        </button>
      </header>

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {conversation?.messages && conversation.messages.length > 0 ? (
            conversation.messages.map((message, index) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onEdit={onEditMessage}
                isLast={index === conversation.messages.length - 1}
                onRegenerate={onRegenerate}
              />
            ))
          ) : (
            <WelcomeScreen />
          )}
          
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 right-1/2 translate-x-1/2 md:translate-x-0 md:right-8 z-20 bg-gray-600/80 hover:bg-gray-700 text-white rounded-full p-2 shadow-lg backdrop-blur-sm transition-all animate-bounce"
          aria-label="Rolar para o fim"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      )}

      <div className="w-full p-4 md:p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-gpt-dark dark:via-gpt-dark dark:to-transparent flex-shrink-0 z-10 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto">
          <ChatInput 
            ref={chatInputRef}
            onSendMessage={onSendMessage} 
            isGenerating={isTyping} 
            onStopGenerating={onStopGenerating}
          />
        </div>
      </div>

      {isSettingsOpen && (
        <SystemInstructionModal 
            onClose={() => setIsSettingsOpen(false)}
            onSave={(instruction) => onUpdateSystemInstruction?.(instruction)}
            currentInstruction={conversation?.systemInstruction}
        />
      )}
    </div>
  );
};

const WelcomeScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 h-full pt-20 animate-fade-in">
    <div className="mb-6 p-4 bg-gray-100 dark:bg-gpt-light-gray rounded-full">
         <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
    </div>
    <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Como posso te ajudar hoje?</h1>
    <p className="max-w-md text-sm opacity-80">
        Posso ajudar com escrita, análise, código e muito mais. Experimente enviar uma mensagem ou anexar um arquivo.
    </p>
  </div>
);
