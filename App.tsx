
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { LoginPage } from './components/LoginPage';
import { generateStream, generateConversationTitle } from './services/geminiService';
import { authService } from './services/authService';
import { useLocalStorage } from './hooks/useLocalStorage';
import { MenuIcon } from './components/Icons';
import { type Conversation, type Message, type Theme, type GroundingChunk, type ImagePart, type User } from './types';

const App: React.FC = () => {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'dark');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const stopGenerationRef = useRef(false);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      authService.getUserConversations(user.id).then(userConversations => {
        setConversations(userConversations);
        if (userConversations.length > 0) {
          setCurrentConversationId(userConversations[0].id);
        }
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

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

  const updateAndSaveConversations = (newConversations: Conversation[] | ((prevState: Conversation[]) => Conversation[])) => {
    setConversations(prevConversations => {
        const updated = typeof newConversations === 'function' ? newConversations(prevConversations) : newConversations;
        if (currentUser) {
            authService.saveUserConversations(currentUser.id, updated);
        }
        return updated;
    });
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const startNewConversation = () => {
    if (!currentUser) return;
    stopGenerationRef.current = true;
    const newId = uuidv4();
    const newConversation: Conversation = {
      id: newId,
      title: 'Nova Conversa',
      messages: [],
      createdAt: Date.now(),
      isTyping: false,
    };
    updateAndSaveConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newId);
  };

  const handleSendMessage = async (input: string, image?: ImagePart) => {
    if (!currentUser || (!input.trim() && !image)) return;

    let conversationIdToUpdate = currentConversationId;
    
    if (!conversationIdToUpdate) {
      const newId = uuidv4();
      const newConversation: Conversation = {
        id: newId,
        title: 'Nova Conversa',
        messages: [],
        createdAt: Date.now(),
        isTyping: false,
      };
      updateAndSaveConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newId);
      conversationIdToUpdate = newId;
    }


    const userMessage: Message = { id: uuidv4(), role: 'user', content: input, image };
    const aiMessage: Message = { id: uuidv4(), role: 'model', content: '', groundingChunks: [] };

    const conversationHistory = conversations.find(c => c.id === conversationIdToUpdate)?.messages ?? [];

    updateAndSaveConversations(prev => prev.map(c => 
      c.id === conversationIdToUpdate 
        ? { ...c, messages: [...c.messages, userMessage, aiMessage], isTyping: true }
        : c
    ));
    stopGenerationRef.current = false;

    try {
      const responseStream = await generateStream(conversationHistory, input, image);

      let fullResponse = '';
      const allChunks = [];
      for await (const chunk of responseStream) {
        if (stopGenerationRef.current || currentConversationId !== conversationIdToUpdate) {
          break;
        }
        allChunks.push(chunk);
        const chunkText = chunk.text;
        fullResponse += chunkText;
        updateAndSaveConversations(prev => prev.map(c => 
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
        updateAndSaveConversations(prev => prev.map(c => 
          c.id === conversationIdToUpdate 
            ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, groundingChunks: uniqueGroundingChunks } : m) }
            : c
        ));
      }
      
      if (stopGenerationRef.current && currentConversationId === conversationIdToUpdate) {
        if (fullResponse.length === 0) {
          updateAndSaveConversations(prev => prev.map(c => 
            c.id === conversationIdToUpdate 
              ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, content: 'Essa mensagem foi interrompida' } : m) }
              : c
          ));
        } else {
          const interruptionMessage: Message = { id: uuidv4(), role: 'model', content: 'Essa mensagem foi interrompida' };
          updateAndSaveConversations(prev => prev.map(c => 
            c.id === conversationIdToUpdate 
              ? { ...c, messages: [...c.messages, interruptionMessage] }
              : c
          ));
        }
      } else {
        const isFirstExchange = conversationHistory.length === 0;
        
        if (isFirstExchange && (fullResponse || image)) {
          const titleContextMessages: Message[] = [
            userMessage,
            { ...aiMessage, content: fullResponse }
          ];

          generateConversationTitle(titleContextMessages).then(newTitle => {
            if (newTitle) {
              updateAndSaveConversations(prev => prev.map(c =>
                c.id === conversationIdToUpdate ? { ...c, title: newTitle } : c
              ));
            }
          });
        }
      }

    } catch (error) {
      console.error("Gemini API error:", error);
      const errorMessage = 'Desculpe, encontrei um erro. Por favor, tente novamente.';
      updateAndSaveConversations(prev => prev.map(c => 
        c.id === conversationIdToUpdate 
          ? { ...c, messages: c.messages.map(m => m.id === aiMessage.id ? { ...m, content: errorMessage } : m) }
          : c
      ));
    } finally {
      updateAndSaveConversations(prev => prev.map(c => 
        c.id === conversationIdToUpdate ? { ...c, isTyping: false } : c
      ));
    }
  };
  
  const handleStopGenerating = () => {
    stopGenerationRef.current = true;
  };

  useEffect(() => {
    if (currentUser && !currentConversationId && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id);
    } else if (currentUser && conversations.length === 0 && !currentConversationId) {
       startNewConversation();
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, currentConversationId, currentUser]);


  const selectConversation = (id: string) => {
    if (currentConversation?.isTyping) {
        stopGenerationRef.current = false;
    } else {
        stopGenerationRef.current = true;
    }
    setCurrentConversationId(id);
  };
  
  const clearHistory = () => {
    if (!currentUser) return;
    stopGenerationRef.current = true;
    updateAndSaveConversations([]);
    setCurrentConversationId(null);
  };

  const handleLogin = async (email: string, password: string): Promise<string | null> => {
    const user = await authService.login(email, password);
    if (user) {
      setCurrentUser(user);
      const userConversations = await authService.getUserConversations(user.id);
      setConversations(userConversations);
      if (userConversations.length > 0) {
        setCurrentConversationId(userConversations[0].id);
      } else {
        setCurrentConversationId(null);
      }
      return null;
    }
    return 'E-mail ou senha inválidos.';
  };

  const handleRegister = async (name: string, email: string, password: string): Promise<string | null> => {
    try {
      const user = await authService.register(name, email, password);
      setCurrentUser(user);
      setConversations([]);
      setCurrentConversationId(null);
      return null;
    } catch (error) {
      if (error instanceof Error) {
        return error.message;
      }
      return 'Ocorreu um erro desconhecido.';
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setConversations([]);
    setCurrentConversationId(null);
  };
  
  if (isLoading) {
    return (
        <div className="flex-1 flex h-screen w-screen items-center justify-center bg-whatsapp-light-bg dark:bg-whatsapp-dark-bg">
            <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-whatsapp-light-bg dark:bg-whatsapp-dark-bg text-black dark:text-white overflow-hidden">
      {currentUser ? (
        <>
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
            currentUser={currentUser}
            onLogout={handleLogout}
          />
          <main className={`transition-all duration-300 ease-in-out absolute top-0 bottom-0 right-0 flex flex-col left-0 ${isSidebarOpen ? 'md:left-64' : ''}`}>
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
          </main>
        </>
      ) : (
        <LoginPage onLogin={handleLogin} onRegister={handleRegister} />
      )}
    </div>
  );
};

export default App;
