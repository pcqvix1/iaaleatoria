import React from 'react';
import ReactMarkdown from 'react-markdown';
import RemarkGfm from 'remark-gfm';
import { type Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUserModel = message.role === 'user';
  
  const showTyping = message.role === 'model' && message.content === '';

  const bubbleContainerClasses = isUserModel ? 'justify-end' : 'justify-start';

  const bubbleClasses = isUserModel
    ? 'bg-whatsapp-light-bubble-user dark:bg-whatsapp-dark-bubble-user text-black'
    : 'bg-whatsapp-light-bubble-ai dark:bg-whatsapp-dark-bubble-ai text-gray-800 dark:text-gray-100';

  return (
    <div className={`w-full flex animate-fade-in ${bubbleContainerClasses}`}>
      <div className={`max-w-2xl px-4 py-2 rounded-lg shadow-sm ${bubbleClasses}`}>
        {showTyping ? (
          <div className="flex items-center gap-1 py-1">
            <span className="italic text-gray-500 dark:text-gray-400">Digitando...</span>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[RemarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};