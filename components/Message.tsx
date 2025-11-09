
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import RemarkGfm from 'remark-gfm';
import { type Message } from '../types';
import { FileIcon } from './Icons';

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

const AttachmentDisplay: React.FC<{ attachment: NonNullable<Message['attachment']> }> = ({ attachment }) => {
  const isImage = attachment.mimeType.startsWith('image/');

  const handleDownload = () => {
    const byteCharacters = atob(attachment.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: attachment.mimeType});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  if (isImage) {
    return (
      <img
          src={`data:${attachment.mimeType};base64,${attachment.data}`}
          alt={attachment.name || "Uploaded content"}
          className="rounded-lg mb-2 max-w-xs max-h-64 object-contain"
      />
    );
  }

  return (
    <div className="mb-2 p-2 bg-gray-200 dark:bg-gpt-gray rounded-md flex items-center gap-3">
        <FileIcon />
        <div className="flex-1 truncate">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{attachment.name}</p>
        </div>
        <button onClick={handleDownload} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Baixar</button>
    </div>
  );
};


export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [showSources, setShowSources] = useState(false);
  
  const isUserModel = message.role === 'user';
  const showTyping = message.role === 'model' && message.content === '' && !message.attachment;
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
            {message.attachment && <AttachmentDisplay attachment={message.attachment} />}
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