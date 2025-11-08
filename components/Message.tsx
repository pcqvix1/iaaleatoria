
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import RemarkGfm from 'remark-gfm';
import { type Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const SourceChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`w-3 h-3 ml-1 transition-transform transform ${open ? 'rotate-180' : 'rotate-0'}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
  </svg>
);


export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [showSources, setShowSources] = useState(false);
  
  const isUserModel = message.role === 'user';
  const showTyping = message.role === 'model' && message.content === '';
  const hasSources = message.groundingChunks && message.groundingChunks.length > 0;

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
          <>
            {message.image && (
                <img
                    src={`data:${message.image.mimeType};base64,${message.image.base64}`}
                    alt="Conteúdo enviado"
                    className="mb-2 rounded-lg max-w-full h-auto max-h-80 object-contain"
                />
            )}
            {message.content && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[RemarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {hasSources && (
              <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-500">
                <button
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center text-xs font-bold text-gray-600 dark:text-gray-400 hover:underline focus:outline-none"
                  aria-expanded={showSources}
                >
                  Fontes
                  <SourceChevronIcon open={showSources} />
                </button>
                {showSources && (
                  <ul className="text-xs list-disc list-inside space-y-1 mt-2 animate-fade-in">
                    {message.groundingChunks.map((chunk, index) => (
                      chunk.web && (
                        <li key={index}>
                          <a 
                            href={chunk.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                            title={chunk.web.title}
                          >
                            {chunk.web.title}
                          </a>
                        </li>
                      )
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
