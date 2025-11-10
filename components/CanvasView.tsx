import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeftIcon, CodeIcon, LatexIcon, SparklesIcon, CopyIcon, CheckIcon, SendToChatIcon } from './Icons';
import { generateCanvasContent } from '../services/geminiService';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type ContentType = 'code' | 'latex';

interface CanvasViewProps {
  onBack: () => void;
  onSendToChat: (contentType: ContentType, generatedCode: string, lang: string) => void;
}

declare global {
  interface Window {
    MathJax?: any;
  }
}

const extractCode = (markdown: string): { lang: string, code: string } => {
  const match = /```(\w*)\n([\s\S]*?)```/.exec(markdown);
  if (match) {
    return { lang: match[1] || 'plaintext', code: match[2].trim() };
  }
  return { lang: 'plaintext', code: markdown.trim() };
};

export const CanvasView: React.FC<CanvasViewProps> = ({ onBack, onSendToChat }) => {
  const [contentType, setContentType] = useState<ContentType>('code');
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const { lang, code } = extractCode(generatedContent);

  useEffect(() => {
    if (contentType === 'latex' && code && window.MathJax && previewRef.current) {
      // Use block math delimiters for MathJax
      previewRef.current.innerHTML = `$$${code}$$`;
      window.MathJax.typesetPromise([previewRef.current]).catch((err: any) => {
        console.error('MathJax error:', err);
        if (previewRef.current) {
          previewRef.current.innerText = 'Erro ao renderizar LaTeX. Verifique a sintaxe no código-fonte.';
        }
      });
    }
  }, [code, contentType]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setGeneratedContent('');
    try {
      const result = await generateCanvasContent(prompt, contentType);
      setGeneratedContent(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Falha ao gerar conteúdo.';
      setGeneratedContent(`\`\`\`error\n${errorMessage}\n\`\`\``);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full">
      <header className="relative flex-shrink-0 px-4 py-2 border-b border-gray-300 dark:border-gray-700/50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50">
            <ArrowLeftIcon />
          </button>
          <h1 className="text-lg font-semibold flex items-center gap-2"><SparklesIcon /> Canvas IA</h1>
        </div>
        <div className="flex items-center gap-2">
          {(['code', 'latex'] as ContentType[]).map((type) => (
            <button
              key={type}
              onClick={() => setContentType(type)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                contentType === type
                  ? 'bg-gpt-green text-white'
                  : 'bg-gray-200 dark:bg-gpt-light-gray hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
            >
              {type === 'code' ? <CodeIcon /> : <LatexIcon />}
              <span className="capitalize">{type === 'code' ? 'Código' : 'LaTeX'}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-1/3 flex flex-col p-4 border-r border-gray-300 dark:border-gray-700/50 overflow-y-auto">
          <h2 className="text-md font-semibold mb-2">Seu Pedido</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Descreva o que você quer gerar...\n(Cmd/Ctrl + Enter para enviar)`}
            className="w-full flex-1 resize-none bg-gray-50 dark:bg-gpt-gray border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-gpt-green"
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-white bg-gpt-green rounded-md hover:bg-opacity-90 disabled:bg-opacity-50"
          >
            {isLoading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Gerando...</>
            ) : (
              <><SparklesIcon /> Gerar</>
            )}
          </button>
        </div>

        <div className="w-full md:w-2/3 flex flex-col overflow-hidden">
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-300 dark:bg-gray-700/50 overflow-hidden">
            <div className="flex flex-col bg-white dark:bg-gpt-dark overflow-hidden">
              <div className="flex-shrink-0 p-3 flex justify-between items-center border-b border-gray-300 dark:border-gray-700/50">
                <h3 className="text-md font-semibold">Fonte</h3>
                {generatedContent && (
                  <div className="flex items-center gap-4">
                     <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gpt-green">
                      {isCopied ? <CheckIcon /> : <CopyIcon />}
                      {isCopied ? 'Copiado!' : 'Copiar'}
                    </button>
                    <button onClick={() => onSendToChat(contentType, code, lang)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gpt-green">
                      <SendToChatIcon />
                      Enviar para Conversa
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto p-1">
                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">Gerando conteúdo...</div>
                ) : generatedContent ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={lang}
                    PreTag="div"
                    customStyle={{ margin: 0, background: 'transparent', height: '100%' }}
                  >
                    {code}
                  </SyntaxHighlighter>
                ) : (
                  <div className="p-4 text-center text-gray-500">O conteúdo gerado aparecerá aqui.</div>
                )}
              </div>
            </div>

            <div className="flex flex-col bg-white dark:bg-gpt-dark overflow-hidden">
              <h3 className="flex-shrink-0 p-3 text-md font-semibold border-b border-gray-300 dark:border-gray-700/50">
                Pré-visualização
              </h3>
              <div className="flex-1 overflow-auto p-4">
                {isLoading ? (
                  <div className="text-center text-gray-500">Aguardando geração...</div>
                ) : !generatedContent ? (
                  <div className="text-center text-gray-500">A pré-visualização aparecerá aqui.</div>
                ) : contentType === 'code' ? (
                   <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={lang}
                    PreTag="div"
                    customStyle={{ margin: 0, background: 'transparent' }}
                  >
                    {code}
                  </SyntaxHighlighter>
                ) : (
                  <div ref={previewRef} className="text-black dark:text-white bg-white p-2 rounded-md"></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
