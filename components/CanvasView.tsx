
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeftIcon, SendToChatIcon } from './Icons';

interface CanvasViewProps {
  onBack: () => void;
  onSendToChat: (code: string, lang: string) => void;
}

const initialHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Olá, Mundo!</title>
  <style>
    body { 
      font-family: sans-serif; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      height: 100vh;
      margin: 0;
      background-color: #f0f0f0;
      color: #333;
    }
    h1 {
      color: #007BFF;
      border: 2px solid #007BFF;
      padding: 20px;
      border-radius: 10px;
    }
  </style>
</head>
<body>
  <h1>Olá, Canvas!</h1>
</body>
</html>`;


export const CanvasView: React.FC<CanvasViewProps> = ({ onBack, onSendToChat }) => {
  const [code, setCode] = useState(initialHtml);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.srcdoc = code;
    }
  }, [code]);

  const handleSend = () => {
    if (code.trim()) {
      onSendToChat(code, 'html');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full">
      <header className="relative flex-shrink-0 px-4 py-2 border-b border-gray-300 dark:border-gray-700/50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50">
            <ArrowLeftIcon />
          </button>
          <h1 className="text-lg font-semibold">Canvas - Editor de Código</h1>
        </div>
        <button 
          onClick={handleSend}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors bg-gpt-green text-white hover:bg-opacity-90 disabled:bg-opacity-50"
          disabled={!code.trim()}
        >
          <SendToChatIcon />
          Enviar para Conversa
        </button>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-300 dark:bg-gray-700/50">
        {/* Editor Column */}
        <div className="flex flex-col w-full md:w-1/2 bg-white dark:bg-gpt-dark overflow-hidden">
            <h3 className="flex-shrink-0 p-3 text-md font-semibold border-b border-gray-300 dark:border-gray-700/50">
                Editor (HTML, CSS, JS)
            </h3>
            <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Digite seu código aqui..."
                className="w-full h-full flex-1 resize-none bg-gray-50 dark:bg-gpt-gray p-4 text-sm font-mono focus:outline-none text-black dark:text-white"
                spellCheck="false"
            />
        </div>

        {/* Preview Column */}
        <div className="flex flex-col w-full md:w-1/2 bg-white dark:bg-gpt-dark overflow-hidden border-t md:border-t-0 md:border-l border-gray-300 dark:border-gray-700/50">
             <h3 className="flex-shrink-0 p-3 text-md font-semibold border-b border-gray-300 dark:border-gray-700/50">
                Pré-visualização
            </h3>
            <iframe
                ref={iframeRef}
                title="Preview"
                className="w-full h-full border-0"
                sandbox="allow-scripts"
            />
        </div>
      </main>
    </div>
  );
};
