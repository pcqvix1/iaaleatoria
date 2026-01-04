
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
import { type Conversation, type Message, type Theme, type GroundingChunk, type User, type ModelId } from './types';
import { type ChatInputHandles } from './components/ChatInput';
import { ToastProvider, useToast } from './components/Toast';

type View = 'chat' | 'account';

// Wrapper component to use the hook
const AppContent: React.FC = () => {
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
  const animationFrameRef = useRef<number | undefined>(undefined);
  
  const { addToast } = useToast();

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
          addToast("Falha ao carregar conversas antigas.", 'error');
          setConversations([]);
        }
      }

      // Finish loading
      setIsLoading(false);
    };

    initializeApp();
  }, [addToast]);

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

    // Check if there is already an empty conversation
    const existingEmptyConversation = conversations.find(c => c.messages.length === 0);

    if (existingEmptyConversation) {
      setCurrentConversationId(existingEmptyConversation.id);
      setView('chat');
      stopGenerationRef.current = true;
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
      return;
    }

    stopGenerationRef.current = true;
    setView('chat');
    const newId = uuidv4();
    const newConversation: Conversation = {
      id: newId,
      title: 'Nova Conversa',
      messages: [],
      createdAt: Date.now(),
      isTyping: false,
      modelId: 'gemini-2.5-flash', // Default model
    };
    updateAndSaveConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newId);
    
    if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
    }
  };

  const ensureConversationExists = (): string => {
    if (currentConversationId) {
      return currentConversationId;
    }
    
    // Check reuse here as well just in case
    const existingEmptyConversation = conversations.find(c => c.messages.length === 0);
    if (existingEmptyConversation) {
        setCurrentConversationId(existingEmptyConversation.id);
        return existingEmptyConversation.id;
    }

    const newId = uuidv4();
    const newConversation: Conversation = {
      id: newId,
      title: 'Nova Conversa',
      messages: [],
      createdAt: Date.now(),
      isTyping: false,
      modelId: 'gemini-2.5-flash',
    };
    updateAndSaveConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newId);
    return newId;
  };
  
  // Shared logic for processing stream
  const processStream = async (conversationId: string, history: Message[], prompt: string, attachment?: any) => {
      const convo = conversations.find(c => c.id === conversationId);
      const aiMessageId = uuidv4();
      const aiMessage: Message = { id: aiMessageId, role: 'model', content: '', reasoning: '', groundingChunks: [] };
      const systemInstruction = convo?.systemInstruction;
      const modelId = convo?.modelId || 'gemini-2.5-flash';

      updateAndSaveConversations(prev => prev.map(c => 
          c.id === conversationId 
          ? { ...c, messages: [...c.messages, aiMessage], isTyping: true }
          : c
      ));

      try {
        const responseStream = await generateStream(history, prompt, modelId, attachment, systemInstruction);
        let fullResponseText = '';
        let fullReasoningText = '';
        const allChunks: any[] = [];
        let updateScheduled = false;
        let bufferText = '';
        let bufferReasoning = '';

        for await (const chunk of responseStream) {
            if (stopGenerationRef.current || currentConversationId !== conversationId) {
                break;
            }
            allChunks.push(chunk);
            
            if (chunk.reasoning) {
                bufferReasoning += chunk.reasoning;
            }

            if (typeof chunk.text === 'string') {
                bufferText += chunk.text;
            }

            if (!updateScheduled) {
                updateScheduled = true;
                animationFrameRef.current = requestAnimationFrame(() => {
                    fullResponseText += bufferText;
                    fullReasoningText += bufferReasoning;
                    bufferText = '';
                    bufferReasoning = '';
                    
                    updateAndSaveConversations(prev => prev.map(c => 
                        c.id === conversationId 
                        ? { 
                            ...c, 
                            messages: c.messages.map(m => m.id === aiMessageId 
                                ? { ...m, content: fullResponseText, reasoning: fullReasoningText } 
                                : m
                            ) 
                          }
                        : c
                    ));
                    updateScheduled = false;
                });
            }
        }
        
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        fullResponseText += bufferText;
        fullReasoningText += bufferReasoning;

        const lastChunk = allChunks[allChunks.length - 1];
        const finishReason = lastChunk?.candidates?.[0]?.finishReason;
        let interruptionMessage = '';

        // Check for Stop, considering backend now normalizes to 'STOP'
        if (finishReason && finishReason !== 'STOP') {
            switch (finishReason) {
                case 'SAFETY': interruptionMessage = '\n\n---\n**Interrompido por segurança.**'; break;
                case 'MAX_TOKENS': interruptionMessage = '\n\n---\n**Limite de tamanho atingido.**'; break;
                // Add explicit ignore for stop/eos if normalization fails for some reason
                case 'stop': 
                case 'eos':
                    interruptionMessage = ''; 
                    break;
                default: if (finishReason !== 'STOP' && finishReason !== undefined) interruptionMessage = `\n\n---\n**Interrompido.**`; break;
            }
        }

        const finalContent = fullResponseText + interruptionMessage;
        const groundingChunks = allChunks
            .flatMap(chunk => chunk.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
            .filter((chunk): chunk is GroundingChunk => !!(chunk.web && chunk.web.uri && chunk.web.title));
        
        const uniqueGroundingChunks = Array.from(new Map(groundingChunks.map(item => [item.web.uri, item])).values());

        updateAndSaveConversations(prev => prev.map(c => {
            if (c.id === conversationId) {
                return { 
                    ...c, 
                    messages: c.messages.map(m => m.id === aiMessageId ? { ...m, content: finalContent, reasoning: fullReasoningText, groundingChunks: uniqueGroundingChunks.length > 0 ? uniqueGroundingChunks : m.groundingChunks } : m), 
                    isTyping: false 
                };
            }
            return c;
        }));

        if (!interruptionMessage && history.length === 0) {
             generateConversationTitle(
                 [...history, { role: 'user', content: prompt, id: 'temp' } as Message, { ...aiMessage, content: finalContent }], 
                 modelId
             ).then(newTitle => {
                if (newTitle) {
                    updateAndSaveConversations(prev => prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c));
                }
            });
        }

      } catch (error) {
          console.error("API error:", error);
          let errorMessage = 'Erro ao processar.';
          if (error instanceof Error) errorMessage = `Erro: ${error.message}`;
          addToast("Erro na geração da resposta", "error");

          updateAndSaveConversations(prev => prev.map(c => 
              c.id === conversationId 
              ? { ...c, messages: c.messages.map(m => m.id === aiMessageId ? { ...m, content: `**${errorMessage}**` } : m), isTyping: false }
              : c
          ));
      }
  };


  const handleSendMessage = async (input: string, attachment?: { data: string; mimeType: string; name: string; }) => {
    if (!currentUser || (!input.trim() && !attachment)) return;
  
    const conversationIdToUpdate = ensureConversationExists();
    setView('chat');
    stopGenerationRef.current = false;

    const userMessage: Message = { 
        id: uuidv4(), 
        role: 'user', 
        content: input,
        ...(attachment && { attachment }),
    };
    
    updateAndSaveConversations(prev => prev.map(c => 
      c.id === conversationIdToUpdate 
        ? { ...c, messages: [...c.messages, userMessage] }
        : c
    ));

    const conversationHistory = conversations.find(c => c.id === conversationIdToUpdate)?.messages ?? [];
    
    await processStream(conversationIdToUpdate, conversationHistory, input, attachment);
  };
  
  const handleEditMessage = async (messageId: string, newContent: string) => {
      if (!currentConversationId) return;
      const convo = conversations.find(c => c.id === currentConversationId);
      if (!convo) return;

      const messageIndex = convo.messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return;

      // Truncate history up to this message
      const truncatedMessages = convo.messages.slice(0, messageIndex);
      
      // Update state to remove everything after and including the edited message
      updateAndSaveConversations(prev => prev.map(c => 
          c.id === currentConversationId 
          ? { ...c, messages: truncatedMessages } 
          : c
      ));

      stopGenerationRef.current = false;
      const updatedUserMessage: Message = { 
          id: uuidv4(),
          role: 'user', 
          content: newContent,
          attachment: convo.messages[messageIndex].attachment 
      };

      updateAndSaveConversations(prev => prev.map(c => 
          c.id === currentConversationId 
          ? { ...c, messages: [...truncatedMessages, updatedUserMessage] }
          : c
      ));

      await processStream(currentConversationId, truncatedMessages, newContent, updatedUserMessage.attachment);
  };

  const handleRegenerate = async () => {
      if (!currentConversationId) return;
      const convo = conversations.find(c => c.id === currentConversationId);
      if (!convo || convo.messages.length === 0) return;

      const lastMessage = convo.messages[convo.messages.length - 1];
      if (lastMessage.role !== 'model') return; 

      const messagesWithoutLast = convo.messages.slice(0, -1);
      const lastUserMessage = messagesWithoutLast[messagesWithoutLast.length - 1];
      
      if (!lastUserMessage) return;

      updateAndSaveConversations(prev => prev.map(c => 
          c.id === currentConversationId 
          ? { ...c, messages: messagesWithoutLast }
          : c
      ));

      stopGenerationRef.current = false;
      
      const historyForStream = messagesWithoutLast.slice(0, -1);
      
      await processStream(currentConversationId, historyForStream, lastUserMessage.content, lastUserMessage.attachment);
  };

  const handleUpdateSystemInstruction = (instruction: string) => {
      if (!currentConversationId) return;
      updateAndSaveConversations(prev => prev.map(c => 
          c.id === currentConversationId ? { ...c, systemInstruction: instruction } : c
      ));
      addToast("Instruções atualizadas", "success");
  };

  const handleUpdateModel = (modelId: ModelId) => {
    if (!currentConversationId) return;
    updateAndSaveConversations(prev => prev.map(c => 
        c.id === currentConversationId ? { ...c, modelId: modelId } : c
    ));
    addToast(`Modelo alterado para ${modelId}`, "info");
  };

  const handleStopGenerating = () => {
    stopGenerationRef.current = true;
    updateAndSaveConversations(prev => prev.map(c => 
        c.id === currentConversationId ? { ...c, isTyping: false } : c
    ));
    addToast("Geração interrompida", "info");
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
    if (confirm("Tem certeza que deseja apagar todo o histórico de conversas deste dispositivo?")) {
        stopGenerationRef.current = true;
        updateAndSaveConversations([]);
        setCurrentConversationId(null);
        setView('chat');
        addToast("Histórico limpo com sucesso", "success");
    }
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
      addToast(`Bem-vindo, ${user.name}!`, "success");
      return null;
    } catch (error) {
      console.error("Login process failed:", error);
      const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido durante o login.';
      addToast(message, "error");
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
      addToast("Conta criada com sucesso!", "success");
      return null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao registrar.';
      addToast(msg, "error");
      return msg;
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
      addToast(`Bem-vindo, ${user.name}!`, "success");
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro login Google.';
      addToast(message, "error");
      return message;
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setConversations([]);
    setCurrentConversationId(null);
    setView('chat');
    addToast("Você saiu da conta.", "info");
  };

  const handlePasswordUpdate = () => {
    setCurrentUser(prevUser => {
      if (!prevUser) return prevUser;
      const updatedUser = { ...prevUser, hasPassword: true };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      return updatedUser;
    });
    addToast("Senha atualizada.", "success");
  };
  
  if (isLoading) {
    return (
        <div className="flex-1 flex h-screen w-screen items-center justify-center bg-whatsapp-light-bg dark:bg-whatsapp-dark-bg">
            <div className="flex flex-col items-center gap-2">
                 <div className="w-8 h-8 border-4 border-gpt-green border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-gray-600 dark:text-gray-400 font-medium">Carregando...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-whatsapp-light-bg dark:bg-whatsapp-dark-bg text-black dark:text-white overflow-hidden font-sans">
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
              className="absolute top-2 left-2 z-30 p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/50 shadow-sm bg-white/50 dark:bg-black/20 backdrop-blur-sm md:hidden"
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
                onEditMessage={handleEditMessage}
                onRegenerate={handleRegenerate}
                onUpdateSystemInstruction={handleUpdateSystemInstruction}
                onUpdateModel={handleUpdateModel}
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

const App: React.FC = () => {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    )
}

export default App;
