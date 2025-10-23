import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type Chat } from '@google/genai';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { sendMessageStream } from './services/geminiService';
import { useLocalStorage } from './hooks/useLocalStorage';
import { MenuIcon } from './components/Icons';
import { type Conversation, type Message, type Theme } from './types';

const App: React.FC = () => {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'dark');
  const [conversations, setConversations] = useLocalStorage<Conversation[]>('conversations', []);
  const [currentConversationId, setCurrentConversationId] = useLocalStorage<string | null>('currentConversationId', null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const chat = useRef<Chat | null>(null);

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
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const startNewConversation = () => {
    chat.current = null;
    const newId = uuidv4();
    const newConversation: Conversation = {
      id: newId,
      title: 'Nova Conversa',
      messages: [],
      createdAt: Date.now(),
    };
    setConversations([newConversation, ...conversations]);
    setCurrentConversationId(newId);
  };

  const handleSendMessage = async (input: string) => {
    if (!input.trim() || !currentConversationId) return;

    const userMessage: Message = { id: uuidv4(), role: 'user', content: input };
    const aiMessage: Message = { id: uuidv4(), role: 'model', content: '' };

    const conversationHistory = conversations.find(c => c.id === currentConversationId)?.messages ?? [];

    setConversations(prev => prev.map(c => 
      c.id === currentConversationId 
        ? { ...c, messages: [...c.messages, userMessage, aiMessage] }
        : c
    ));
    setIsTyping(true);

    try {
      if (!chat.current) {
        chat.current = await sendMessageStream(conversationHistory);
      }
      
      const responseStream = await chat.current.sendMessageStream({ message: input });

      let fullResponse = '';
      for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        fullResponse += chunkText;
        setConversations(prev => prev.map(c => 
          c.id === currentConversationId 
            ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, content: fullResponse } : m) }
            : c
        ));
      }

      setConversations(prev => prev.map(c => {
        if (c.id === currentConversationId) {
          let title = c.title;
          if (c.title === 'Nova Conversa' && c.messages.length > 0) {
            const firstUserMessage = c.messages.find(m => m.role === 'user' && m.content.length > 0);
            if (firstUserMessage) {
                title = firstUserMessage.content.substring(0, 30);
            }
          }
          return { ...c, title };
        }
        return c;
      }));


    } catch (error) {
      console.error("Gemini API error:", error);
      const errorMessage = 'Desculpe, encontrei um erro. Por favor, tente novamente.';
      setConversations(prev => prev.map(c => 
        c.id === currentConversationId 
          ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, content: errorMessage } : m) }
          : c
      ));
    } finally {
      setIsTyping(false);
    }
  };
  
  useEffect(() => {
    if (!currentConversationId && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id);
    } else if (conversations.length === 0) {
      startNewConversation();
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, currentConversationId]);


  const selectConversation = (id: string) => {
    chat.current = null;
    setCurrentConversationId(id);
  };
  
  const clearHistory = () => {
    setConversations([]);
    setCurrentConversationId(null);
    chat.current = null;
  };

  return (
    <div className="flex h-screen w-screen bg-whatsapp-light-bg dark:bg-whatsapp-dark-bg text-black dark:text-white overflow-hidden">
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
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-2 left-2 p-2 rounded-md md:hidden text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/50"
        >
          <MenuIcon />
        </button>
        <ChatView 
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
};

export default App;