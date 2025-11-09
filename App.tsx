import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { LoginPage } from './components/LoginPage';
import { AccountPage } from './components/AccountPage';
import { generateStream, generateConversationTitle } from './services/geminiService';
import { authService } from './services/authService';
import { useLocalStorage } from './hooks/useLocalStorage';
import { MenuIcon } from './components/Icons';
import { type Conversation, type Message, type Theme, type GroundingChunk, type User } from './types';
import { type ChatInputHandles } from './components/ChatInput';

type View = 'chat' | 'account';

const App: React.FC = () => {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'dark');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<View>('chat');

  const stopGenerationRef = useRef(false);
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const chatInputRef = useRef<ChatInputHandles>(null);

  useEffect(() => {
    const initializeApp = async () => {
      // Check for logged-in user and fetch data
      const user = authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        try {
          const userConversations = await authService.getUserConversations(user.id);
          setConversations(userConversations);
          if (userConversations.length > 0) {
            setCurrentConversationId(userConversations[0].id);
          }
        } catch (error) {
          console.error("Failed to load user conversations:", error);
          setConversations([]);
        }
      }

      // Finish loading
      setIsLoading(false);
    };

    initializeApp();
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

  // Debounced effect for saving conversations
  useEffect(() => {
    if (isLoading || !currentUser) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      authService.saveUserConversations(currentUser.id, conversations);
    }, 1500); // Save after 1.5 seconds of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [conversations, currentUser, isLoading]);


  const updateAndSaveConversations = (updater: React.SetStateAction<Conversation[]>) => {
    setConversations(updater);
  };


  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const startNewConversation = () => {
    if (!currentUser) return;
    stopGenerationRef.current = true;
    setView('chat');
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

  const ensureConversationExists = (): string => {
    if (currentConversationId) {
      return currentConversationId;
    }
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
    return newId;
  };


  const handleSendMessage = async (input: string, attachment?: { data: string; mimeType: string; name: string; }) => {
    if (!currentUser || (!input.trim() && !attachment)) return;

    const conversationIdToUpdate = ensureConversationExists();
    setView('chat');

    const userMessage: Message = { 
        id: uuidv4(), 
        role: 'user', 
        content: input,
        ...(attachment && { attachment }),
    };
    const aiMessage: Message = { id: uuidv4(), role: 'model', content: '', groundingChunks: [] };

    const conversationHistory = conversations.find(c => c.id === conversationIdToUpdate)?.messages ?? [];

    updateAndSaveConversations(prev => prev.map(c => 
      c.id === conversationIdToUpdate 
        ? { ...c, messages: [...c.messages, userMessage, aiMessage], isTyping: true }
        : c
    ));
    stopGenerationRef.current = false;

    try {
      const responseStream = await generateStream(conversationHistory, input, attachment);

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
      
      // Title Generation for new conversations
      const isFirstExchange = conversationHistory.length === 0;
      
      if (isFirstExchange) {
        const titleContextMessages: Message[] = [userMessage, { ...aiMessage, content: fullResponse }];
        generateConversationTitle(titleContextMessages).then(newTitle => {
          if (newTitle) {
            updateAndSaveConversations(prev => prev.map(c =>
              c.id === conversationIdToUpdate ? { ...c, title: newTitle } : c
            ));
          }
        });
      }

    } catch (error) {
      console.error("Gemini API error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Desculpe, encontrei um erro. Por favor, tente novamente.';
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
    setView('chat');
  };
  
  const clearHistory = () => {
    if (!currentUser) return;
    stopGenerationRef.current = true;
    updateAndSaveConversations([]);
    setCurrentConversationId(null);
    setView('chat');
  };

  const handleLogin = async (email: string, password: string): Promise<string | null> => {
    try {
      const user = await authService.login(email, password);
      
      setCurrentUser(user);
      const userConversations = await authService.getUserConversations(user.id);
      setConversations(userConversations);
      
      if (userConversations.length > 0) {
        setCurrentConversationId(userConversations[0].id);
      } else {
        setCurrentConversationId(null);
      }
      setView('chat');
      return null;
    } catch (error) {
      console.error("Login process failed:", error);
      const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido durante o login.';
      return message;
    }
  };

  const handleRegister = async (name: string, email: string, password: string): Promise<string | null> => {
    try {
      const user = await authService.register(name, email, password);
      setCurrentUser(user);
      setConversations([]);
      setCurrentConversationId(null);
      setView('chat');
      return null;
    } catch (error) {
      if (error instanceof Error) {
        return error.message;
      }
      return 'Ocorreu um erro desconhecido.';
    }
  };

  const handleLoginWithGoogle = async (name: string, email: string): Promise<string | null> => {
    try {
      const user = await authService.loginWithGoogle(name, email);
      setCurrentUser(user);
      const userConversations = await authService.getUserConversations(user.id);
      setConversations(userConversations);

      if (userConversations.length > 0) {
        setCurrentConversationId(userConversations[0].id);
      } else {
        setCurrentConversationId(null);
      }
      setView('chat');
      return null;
    } catch (error) {
      console.error("Google Login process failed:", error);
      const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido durante o login com o Google.';
      return message;
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setConversations([]);
    setCurrentConversationId(null);
    setView('chat');
  };

  const handlePasswordUpdate = () => {
    if (currentUser) {
      const updatedUser = { ...currentUser, hasPassword: true };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
    }
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
            onGoToAccount={() => { setView('account'); setIsSidebarOpen(false); }}
          />
          {!isSidebarOpen && view === 'chat' && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-2 left-2 z-30 p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/50"
              aria-label="Abrir barra lateral"
            >
              <MenuIcon />
            </button>
          )}
          <main className={`transition-all duration-300 ease-in-out absolute top-0 bottom-0 right-0 flex flex-col left-0 ${isSidebarOpen ? 'md:left-64' : ''}`}>
            {view === 'chat' ? (
              <ChatView 
                conversation={currentConversation}
                onSendMessage={handleSendMessage}
                isTyping={currentConversation?.isTyping ?? false}
                onStopGenerating={handleStopGenerating}
                onFileDrop={(file) => chatInputRef.current?.setFile(file)}
                chatInputRef={chatInputRef}
              />
            ) : (
              <AccountPage
                currentUser={currentUser}
                onBack={() => setView('chat')}
                onPasswordUpdate={handlePasswordUpdate}
                onAccountDeleted={handleLogout}
              />
            )}
          </main>
        </>
      ) : (
        <LoginPage 
          onLogin={handleLogin} 
          onRegister={handleRegister} 
          onLoginWithGoogle={handleLoginWithGoogle}
        />
      )}
    </div>
  );
};

export default App;