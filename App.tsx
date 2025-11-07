
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { generateStream, generateConversationTitle } from './services/geminiService';
import { useLocalStorage } from './hooks/useLocalStorage';
import { MenuIcon } from './components/Icons';
import { type Conversation, type Message, type Theme, GroundingChunk } from './types';

const App: React.FC = () => {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'dark');
  const [conversations, setConversations] = useLocalStorage<Conversation[]>('conversations', []);
  const [currentConversationId, setCurrentConversationId] = useLocalStorage<string | null>('currentConversationId', null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const stopGenerationRef = useRef(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };
  
  useEffect(() => {
    if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
    }
    const handleResize = () => {
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const startNewConversation = () => {
    stopGenerationRef.current = true;
    const newId = uuidv4();
    const newConversation: Conversation = {
      id: newId,
      title: 'Nova Conversa',
      messages: [],
      createdAt: Date.now(),
      isTyping: false,
    };
    setConversations([newConversation, ...conversations]);
    setCurrentConversationId(newId);
  };

  const handleSendMessage = async (input: string) => {
    if (!input.trim()) return;

    let conversationIdToUpdate = currentConversationId;
    
    // If there's no current conversation, start a new one
    if (!conversationIdToUpdate) {
      const newId = uuidv4();
      const newConversation: Conversation = {
        id: newId,
        title: 'Nova Conversa',
        messages: [],
        createdAt: Date.now(),
        isTyping: false,
      };
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newId);
      conversationIdToUpdate = newId;
    }


    const userMessage: Message = { id: uuidv4(), role: 'user', content: input };
    const aiMessage: Message = { id: uuidv4(), role: 'model', content: '', groundingChunks: [] };

    const conversationHistory = conversations.find(c => c.id === conversationIdToUpdate)?.messages ?? [];

    setConversations(prev => prev.map(c => 
      c.id === conversationIdToUpdate 
        ? { ...c, messages: [...c.messages, userMessage, aiMessage], isTyping: true }
        : c
    ));
    stopGenerationRef.current = false;

    try {
      const responseStream = await generateStream(conversationHistory, input);

      let fullResponse = '';
      const allChunks = [];
      for await (const chunk of responseStream) {
        if (stopGenerationRef.current || currentConversationId !== conversationIdToUpdate) {
          break;
        }
        allChunks.push(chunk);
        const chunkText = chunk.text;
        fullResponse += chunkText;
        setConversations(prev => prev.map(c => 
          c.id === conversationIdToUpdate 
            ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, content: fullResponse } : m) }
            : c
        ));
      }
      
      const groundingChunks = allChunks
        .flatMap(chunk => chunk.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
        .filter((chunk): chunk is GroundingChunk => !!(chunk.web && chunk.web.uri && chunk.web.title));
      
      const uniqueGroundingChunks = Array.from(new Map(groundingChunks.map(item => [item.web.uri, item])).values());
      
      if (uniqueGroundingChunks.length > 0) {
        setConversations(prev => prev.map(c => 
          c.id === conversationIdToUpdate 
            ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, groundingChunks: uniqueGroundingChunks } : m) }
            : c
        ));
      }
      
      if (stopGenerationRef.current && currentConversationId === conversationIdToUpdate) {
        if (fullResponse.length === 0) {
          setConversations(prev => prev.map(c => 
            c.id === conversationIdToUpdate 
              ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, content: 'Essa mensagem foi interrompida' } : m) }
              : c
          ));
        } else {
          const interruptionMessage: Message = { id: uuidv4(), role: 'model', content: 'Essa mensagem foi interrompida' };
          setConversations(prev => prev.map(c => 
            c.id === conversationIdToUpdate 
              ? { ...c, messages: [...c.messages, interruptionMessage] }
              : c
          ));
        }
      } else {
        const isFirstExchange = conversationHistory.length === 0;
        
        if (isFirstExchange && fullResponse) {
          const titleContextMessages: Message[] = [
            userMessage,
            { ...aiMessage, content: fullResponse }
          ];

          generateConversationTitle(titleContextMessages).then(newTitle => {
            if (newTitle) {
              setConversations(prev => prev.map(c =>
                c.id === conversationIdToUpdate ? { ...c, title: newTitle } : c
              ));
            }
          });
        }
      }

    } catch (error) {
      console.error("Gemini API error:", error);
      const errorMessage = 'Desculpe, encontrei um erro. Por favor, tente novamente.';
      setConversations(prev => prev.map(c => 
        c.id === conversationIdToUpdate 
          ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, content: errorMessage } : m) }
          : c
      ));
    } finally {
      setConversations(prev => prev.map(c => 
        c.id === conversationIdToUpdate ? { ...c, isTyping: false } : c
      ));
    }
  };
  
  const handleStopGenerating = () => {
    stopGenerationRef.current = true;
  };

  useEffect(() => {
    if (!currentConversationId && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id);
    } else if (conversations.length === 0 && !currentConversationId) {
       startNewConversation();
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, currentConversationId]);


  const selectConversation = (id: string) => {
    if (currentConversation?.isTyping) {
        stopGenerationRef.current = false; // Allow generation to continue in background
    } else {
        stopGenerationRef.current = true;
    }
    setCurrentConversationId(id);
  };
  
  const clearHistory = () => {
    stopGenerationRef.current = true;
    setConversations([]);
    setCurrentConversationId(null);
  };

  return (
    <div className="flex h-screen w-full bg-whatsapp-light-bg dark:bg-whatsapp-dark-bg text-black dark:text-white overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        onNewChat={startNewConversation}
        onSelectConversation={selectConversation}
        currentConversationId={currentConversationId}
        onClearHistory={clearHistory}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div className="flex-1 flex flex-col relative">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-2 left-2 z-20 p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/50"
            aria-label="Abrir barra lateral"
          >
            <MenuIcon />
          </button>
        )}
        <ChatView 
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
          isTyping={currentConversation?.isTyping ?? false}
          onStopGenerating={handleStopGenerating}
        />
      </div>
    </div>
  );
};

export default App;
