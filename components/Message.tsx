
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import RemarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { type Message } from '../types';
import { FileIcon, CopyIcon, CheckIcon } from './Icons';

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

const CodeBlock: React.FC<any> = ({ node, inline, className, children, ...props }) => {
    const [isCopied, setIsCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    if (inline) {
        // Let prose handle inline code styling for consistency
        return (
            <code className={className} {...props}>
                {children}
            </code>
        );
    }

    return match ? (
        <div className="relative my-2 rounded-md text-sm bg-[#1E1E1E] font-sans">
            <div className="flex items-center justify-between px-4 py-1.5 bg-black bg-opacity-30 rounded-t-md">
                <span className="text-gray-400 lowercase">{match[1]}</span>
                <button 
                    onClick={handleCopy} 
                    className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-xs"
                    aria-label="Copiar código"
                >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                    {isCopied ? 'Copiado!' : 'Copiar'}
                </button>
            </div>
            <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                customStyle={{ margin: 0, padding: '1rem', background: 'transparent', overflow: 'auto' }}
                codeTagProps={{ style: { fontFamily: 'inherit' } }}
                {...props}
            >
                {codeString}
            </SyntaxHighlighter>
        </div>
    ) : (
        // For code blocks without a language, provide a simple, clean block
        <pre className="my-2 p-4 bg-gray-100 dark:bg-gray-800 text-black dark:text-white rounded-md overflow-x-auto text-sm" {...props}>
            <code>{children}</code>
        </pre>
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
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-blockquote:my-2 prose-table:my-2">
                <ReactMarkdown 
                  remarkPlugins={[RemarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    code: CodeBlock,
                  }}
                >
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