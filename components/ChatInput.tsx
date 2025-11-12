import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { PaperAirplaneIcon, StopIcon, PaperclipIcon, CloseIcon, FileIcon } from './Icons';

declare const pdfjsLib: any;
declare const mammoth: any;
declare const XLSX: any;
declare const JSZip: any;

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

interface ChatInputProps {
  onSendMessage: (input: string, attachment?: { data: string; mimeType: string; name: string; }) => void;
  isGenerating: boolean;
  onStopGenerating: () => void;
}

export type ChatInputHandles = {
  setFile: (file: File) => void;
};

export const ChatInput = forwardRef<ChatInputHandles, ChatInputProps>(({ onSendMessage, isGenerating, onStopGenerating }, ref) => {
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    setFile: (file: File) => {
      processFile(file);
    },
  }));

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 192; // 12rem or max-h-48
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);
  
  const processFile = (file: File) => {
    if (attachedFile) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`O arquivo é muito grande. O tamanho máximo é de ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isText = file.type.startsWith('text/') || ['application/json', 'application/javascript', 'application/xml'].includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.csv');
    const isPdf = file.type === 'application/pdf';
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
    const isXlsx = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx');
    const isPptx = file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.name.endsWith('.pptx');

    if (!isImage && !isText && !isPdf && !isDocx && !isXlsx && !isPptx) {
      alert(`Tipo de arquivo não suportado: ${file.type || 'desconhecido'}.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAttachedFile(file);
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setFilePreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    } else {
        setFilePreviewUrl(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          return;
        }
      }
    }
  };

  const handleRemoveFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setAttachedFile(null);
    setFilePreviewUrl(null);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isGenerating) return;

    if (!attachedFile) {
      onSendMessage(input);
      setInput('');
      return;
    }

    const file = attachedFile;
    const cleanupAndSend = (attachmentData: { data: string; mimeType: string; name: string; }) => {
      onSendMessage(input, attachmentData);
      handleRemoveFile();
      setInput('');
    };

    const isImage = file.type.startsWith('image/');
    const isText = file.type.startsWith('text/') || ['application/json', 'application/javascript', 'application/xml'].includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.csv');
    const isPdf = file.type === 'application/pdf';
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
    const isXlsx = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx');
    const isPptx = file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.name.endsWith('.pptx');

    // Handle Images (Base64)
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          cleanupAndSend({ data: (reader.result as string).split(',')[1], mimeType: file.type, name: file.name });
        } else {
          console.error("Error reading image file:", reader.error);
          cleanupAndSend({ data: '', mimeType: file.type, name: file.name });
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    // Handle plain text files
    if (isText) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          cleanupAndSend({ data: reader.result, mimeType: file.type, name: file.name });
        } else {
          console.error("Error reading text file:", reader.error);
          cleanupAndSend({ data: '', mimeType: file.type, name: file.name });
        }
      };
      reader.readAsText(file);
      return;
    }
    
    // Handle complex files (PDF, DOCX, XLSX, PPTX)
    if (isPdf || isDocx || isXlsx || isPptx) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) {
          cleanupAndSend({ data: '', mimeType: file.type, name: file.name });
          return;
        }
        const arrayBuffer = event.target.result as ArrayBuffer;
        let fullText = '';
        try {
          if (isPdf && typeof pdfjsLib !== 'undefined') {
            const typedArray = new Uint8Array(arrayBuffer);
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              fullText += textContent.items.map((s: any) => s.str).join(' ') + '\n\n';
            }
          } else if (isDocx && typeof mammoth !== 'undefined') {
            const result = await mammoth.extractRawText({ arrayBuffer });
            fullText = result.value;
          } else if (isXlsx && typeof XLSX !== 'undefined') {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            workbook.SheetNames.forEach(sheetName => {
              fullText += `--- Folha: ${sheetName} ---\n`;
              const worksheet = workbook.Sheets[sheetName];
              const csvData = XLSX.utils.sheet_to_csv(worksheet);
              fullText += csvData + '\n\n';
            });
          } else if (isPptx && typeof JSZip !== 'undefined') {
            const zip = await JSZip.loadAsync(arrayBuffer);
            const parser = new DOMParser();
            const slidePromises: Promise<string>[] = [];
            const slideFileNames = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
            for (const fileName of slideFileNames) {
              slidePromises.push(zip.files[fileName].async('string'));
            }
            const slideXmls = await Promise.all(slidePromises);
            fullText = slideXmls.map(xml => {
              const doc = parser.parseFromString(xml, "application/xml");
              const textNodes = doc.getElementsByTagName("a:t");
              let slideText = '';
              for (let i = 0; i < textNodes.length; i++) {
                slideText += textNodes[i].textContent + ' ';
              }
              return slideText.trim();
            }).filter(Boolean).join('\n\n');
          }
          cleanupAndSend({ data: fullText.trim(), mimeType: file.type, name: file.name });
        } catch (error) {
          console.error(`Error parsing ${file.name}:`, error);
          cleanupAndSend({ data: '', mimeType: file.type, name: file.name });
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // Fallback for any other unsupported file type
    cleanupAndSend({ data: '', mimeType: file.type, name: file.name });
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const FilePreview = () => {
    if (!attachedFile) return null;

    return (
        <div className="mb-2 p-2 bg-gray-100 dark:bg-gpt-gray rounded-lg relative w-auto max-w-sm animate-fade-in">
            <div className="flex items-center gap-2">
                {filePreviewUrl ? (
                    <img src={filePreviewUrl} alt="Preview" className="w-16 h-16 object-cover rounded-md" />
                ) : (
                    <div className="w-16 h-16 flex items-center justify-center bg-gray-200 dark:bg-gpt-light-gray rounded-md">
                        <FileIcon />
                    </div>
                )}
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{attachedFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{Math.round(attachedFile.size / 1024)} KB</p>
                </div>
            </div>
             <button
                onClick={handleRemoveFile}
                className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-1 hover:bg-red-500 transition-colors shadow-md"
                aria-label="Remove file"
            >
                <CloseIcon />
            </button>
        </div>
    )
  }

  return (
    <div className="relative">
        <FilePreview />
      <div className="flex items-end bg-white dark:bg-gpt-light-gray rounded-xl shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 focus-within:ring-2 focus-within:ring-gpt-green dark:focus-within:ring-gpt-green transition-shadow duration-200">
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileInputChange} 
            className="hidden" 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar arquivo"
          className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green disabled:opacity-50"
          disabled={isGenerating || !!attachedFile}
        >
          <PaperclipIcon />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Digite uma mensagem..."
          rows={1}
          className="w-full resize-none bg-transparent py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none max-h-48"
          disabled={isGenerating}
          spellCheck="false"
          autoCorrect="off"
          autoCapitalize="off"
        />
        {isGenerating ? (
          <button
            onClick={onStopGenerating}
            aria-label="Parar geração"
            className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachedFile) || isGenerating}
            aria-label="Enviar mensagem"
            className="p-3 text-gray-500 hover:text-gpt-green dark:text-gray-400 dark:hover:text-gpt-green disabled:opacity-50 disabled:hover:text-gray-500"
          >
            <PaperAirplaneIcon />
          </button>
        )}
      </div>
    </div>
  );
});
