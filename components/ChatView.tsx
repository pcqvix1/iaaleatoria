
import React, { useEffect, useRef } from 'react';
import { type Conversation, type ImagePart } from '../types';
import { MessageBubble } from './Message';
import { ChatInput } from './ChatInput';

interface ChatViewProps {
  conversation: Conversation | undefined;
  onSendMessage: (input: string, image?: ImagePart) => void;
  isTyping: boolean;
  onStopGenerating: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ conversation, onSendMessage, isTyping, onStopGenerating }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
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
          <ChatInput onSendMessage={onSendMessage} isGenerating={isTyping} onStopGenerating={onStopGenerating} />
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
