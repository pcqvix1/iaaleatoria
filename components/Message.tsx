
import React, { useState, memo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import RemarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { type Message, type Theme } from '../types';
import { FileIcon, CopyIcon, CheckIcon, EditIcon, RefreshIcon } from './Icons';

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
  theme?: Theme;
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
      <div className="mb-3 group relative inline-block">
        <img
            src={`data:${attachment.mimeType};base64,${attachment.data}`}
            alt={attachment.name || "Uploaded content"}
            className="rounded-lg max-w-xs max-h-64 object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
        />
      </div>
    );
  }

  return (
    <div className="mb-2 p-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-3 max-w-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer" onClick={handleDownload}>
        <div className="p-2 bg-white dark:bg-gray-600 rounded-md">
           <FileIcon />
        </div>
        <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{attachment.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{attachment.mimeType.split('/')[1]}</p>
        </div>
    </div>
  );
};

const CodeBlock: React.FC<any> = ({ node, inline, className, children, theme, ...props }) => {
    const [isCopied, setIsCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    const isDark = theme === 'dark';

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    if (inline) {
        return (
            <code className="px-1.5 py-0.5 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono text-sm" {...props}>
                {children}
            </code>
        );
    }

    return (
        <div className="relative my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono lowercase">{match ? match[1] : 'code'}</span>
                <button 
                    onClick={handleCopy} 
                    className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xs uppercase font-medium tracking-wider"
                    aria-label="Copiar código"
                >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                    {isCopied ? 'Copiado!' : 'Copiar'}
                </button>
            </div>
            <div className="bg-white dark:bg-[#1e1e1e]">
                <SyntaxHighlighter
                    style={isDark ? vscDarkPlus : oneLight}
                    language={match ? match[1] : 'text'}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent', fontSize: '0.9rem', lineHeight: '1.5' }}
                    codeTagProps={{ style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
                    {...props}
                >
                    {codeString}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};

// Using memo to prevent re-rendering of previous messages when new ones arrive
export const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, isLast, onEdit, onRegenerate, theme }) => {
  const [showSources, setShowSources] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isCopied, setIsCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const isUserModel = message.role === 'user';
  const showTyping = message.role === 'model' && message.content === '' && !message.attachment && !message.reasoning;
  const hasSources = message.groundingChunks && message.groundingChunks.length > 0;

  const bubbleContainerClasses = isUserModel ? 'justify-end' : 'justify-start';

  const bubbleClasses = isUserModel
    ? 'bg-[#e7f8ff] dark:bg-[#2f2f2f] text-gray-800 dark:text-gray-100 rounded-2xl rounded-tr-sm'
    : 'bg-transparent text-gray-800 dark:text-gray-100 px-0'; 

  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content && onEdit) {
        onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div 
        className={`w-full flex group ${bubbleContainerClasses} mb-2`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
    >
      <div className={`relative max-w-[95%] md:max-w-3xl px-4 py-3 shadow-none ${bubbleClasses} ${isUserModel ? 'shadow-sm border border-gray-200 dark:border-gray-700/50' : ''}`}>
        
        {/* Edit Button for User */}
        {isUserModel && isHovering && !isEditing && !message.attachment && onEdit && (
            <button 
                onClick={() => setIsEditing(true)}
                className="absolute -left-8 top-2 p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full shadow-sm transition-all"
                title="Editar mensagem"
            >
                <EditIcon />
            </button>
        )}

        {isEditing ? (
            <div className="w-full">
                <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => {
                        setEditContent(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-gpt-green focus:outline-none resize-none"
                    rows={1}
                />
                <div className="flex justify-end gap-2 mt-2">
                    <button 
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSaveEdit}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-gpt-green rounded-md hover:bg-opacity-90 transition-colors"
                    >
                        Salvar e Enviar
                    </button>
                </div>
            </div>
        ) : (
            <>
                {showTyping ? (
                  <div className="flex items-center gap-1.5 py-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                ) : (
                  <>
                    {message.attachment && <AttachmentDisplay attachment={message.attachment} />}
                    
                    {/* REASONING BLOCK (Collapsed by default) */}
                    {message.reasoning && (
                        <details className="mb-4 group">
                             <summary className="list-none flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                                <span className="p-1 rounded bg-gray-100 dark:bg-gray-800 group-open:bg-gray-200 dark:group-open:bg-gray-700 transition-colors">
                                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                       <circle cx="12" cy="12" r="10"></circle>
                                       <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                       <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                   </svg>
                                </span>
                                <span>Processo de Raciocínio</span>
                                <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                             </summary>
                             <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 italic">
                                 <ReactMarkdown 
                                    remarkPlugins={[RemarkGfm]}
                                    components={{
                                        code: ({node, inline, className, children, ...props}: any) => (
                                            <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                                {children}
                                            </code>
                                        )
                                    }}
                                 >
                                    {message.reasoning}
                                 </ReactMarkdown>
                             </div>
                        </details>
                    )}

                    {message.content && (
                      <div className="prose prose-sm dark:prose-invert max-w-none 
                        prose-p:leading-relaxed 
                        prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-gray-100
                        prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-gray-900 dark:prose-strong:text-white
                        prose-code:text-gray-800 dark:prose-code:text-gray-200
                        ">
                        <ReactMarkdown 
                          remarkPlugins={[RemarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            code: (props) => <CodeBlock {...props} theme={theme} />,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {hasSources && (
                      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700/50">
                        <button
                          onClick={() => setShowSources(!showSources)}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors focus:outline-none"
                          aria-expanded={showSources}
                        >
                          {message.groundingChunks?.length} Fontes encontradas
                          <SourceChevronIcon open={showSources} />
                        </button>
                        {showSources && (
                          <div className="grid grid-cols-1 gap-2 mt-2 animate-fade-in">
                            {message.groundingChunks?.map((chunk, index) => (
                              chunk.web && (
                                  <a 
                                    key={index}
                                    href={chunk.web.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block p-2 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                                  >
                                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">{chunk.web.title}</p>
                                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{chunk.web.uri}</p>
                                  </a>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Action Bar (Copy & Regenerate) */}
                    {!isUserModel && !showTyping && (
                        <div className="flex items-center gap-2 mt-2 pt-1 text-gray-400 select-none">
                            <button 
                                onClick={handleCopyMessage}
                                className="p-1 rounded-md hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                title="Copiar resposta"
                            >
                                {isCopied ? <CheckIcon /> : <CopyIcon />}
                            </button>
                            
                            {isLast && onRegenerate && (
                                <button 
                                    onClick={onRegenerate}
                                    className="p-1 rounded-md hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                    title="Regenerar resposta"
                                >
                                    <RefreshIcon />
                                </button>
                            )}
                        </div>
                    )}
                  </>
                )}
            </>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';
