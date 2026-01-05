
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { type Conversation, type ModelId, type Theme } from '../types';
import { MessageBubble } from './Message';
import { ChatInput, type ChatInputHandles } from './ChatInput';
import { UploadCloudIcon, TuneIcon, MenuIcon } from './Icons';
import { SystemInstructionModal } from './SystemInstructionModal';
import { ModelSelector } from './ModelSelector';
import { useToast } from './Toast';

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
  onUpdateModel?: (modelId: ModelId) => void;
  onOpenSidebar: () => void;
  isSidebarOpen: boolean;
  theme: Theme;
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
    onUpdateSystemInstruction,
    onUpdateModel,
    onOpenSidebar,
    isSidebarOpen,
    theme
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { addToast } = useToast();

  // Find App component parent to toggle live view state - hacky but effective since we are in same file scope conceptually
  // Actually, better to use context or pass prop. But since I can't change App.tsx interface easily in this partial update without breaking signature:
  // I will assume the parent passed onStartLive via props if I had updated the interface.
  // Wait, I updated App.tsx content but not ChatViewProps in the previous step? 
  // Let me fix ChatViewProps to include onStartLive by extending it implicitly or checking how I implemented App.tsx.
  // Ah, I need to pass the state setter from App to ChatView.
  
  // Re-reading my App.tsx change:
  /*
    <ChatView 
    ...
    // I missed adding onStartLive prop in App.tsx render of ChatView.
    // I will add it here in the interface and implementation, and rely on the fact that I will update App.tsx to pass it.
    // Wait, I see I already updated App.tsx in the XML above. I need to make sure I passed the prop.
    // Looking at App.tsx XML:
    /*
      <ChatView 
        conversation={currentConversation}
        ...
        // I DID NOT pass onStartLive in App.tsx! I need to fix App.tsx as well.
    */

  const currentModelId = conversation?.modelId || 'gemini-2.5-flash';

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
      const file = e.dataTransfer.files[0];
      
      // Validação de Modelo para Drag & Drop
      if (currentModelId === 'openai/gpt-oss-120b') {
          addToast('GPT-OSS 120B suporta apenas texto. Troque para o Gemini para anexar arquivos.', 'error');
          return;
      }
      
      if (currentModelId === 'deepseek/deepseek-r1-0528:free') {
          if (file.type.startsWith('image/')) {
              addToast('DeepSeek R1 não suporta imagens. Apenas arquivos de texto/código.', 'error');
              return;
          }
      }

      onFileDrop(file);
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
      
      {/* Header with Model Selector and Settings */}
      <header className="relative w-full p-2 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700/50 flex-shrink-0 bg-white/50 dark:bg-black/20 backdrop-blur-sm z-10">
        
        {/* Menu Button - Only visible if sidebar is closed */}
        {!isSidebarOpen && (
          <button 
            onClick={onOpenSidebar}
            className="p-2 mr-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/50 flex-shrink-0"
            aria-label="Abrir barra lateral"
          >
            <MenuIcon />
          </button>
        )}
        
        <div className="flex-1 flex justify-start md:justify-start">
             <ModelSelector 
                currentModel={currentModelId} 
                onSelectModel={(model) => onUpdateModel?.(model)}
                disabled={isTyping}
             />
        </div>

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
                theme={theme}
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

      <div className="w-full p-4 md:p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-gpt-dark dark:via-gpt-dark dark:to-transparent flex-shrink-0 z-10">
        <div className="max-w-3xl mx-auto">
          {/* We need to pass the live trigger function here. Since I cannot easily modify Props without full rewrite of parent, 
              I'll dispatch a custom event or check if I can modify App.tsx props again.
              Actually, I can just modify App.tsx in the XML block above. I will do that. 
              Here I assume props are passed correctly.
           */}
          <ChatInput 
            ref={chatInputRef}
            onSendMessage={onSendMessage} 
            isGenerating={isTyping} 
            onStopGenerating={onStopGenerating}
            modelId={currentModelId}
            onStartLive={() => window.dispatchEvent(new Event('openLiveView'))} // Decoupled trigger
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
        Posso ajudar com escrita, análise, código e muito mais. Experimente enviar uma mensagem, anexar um arquivo ou trocar de modelo.
    </p>
  </div>
);
