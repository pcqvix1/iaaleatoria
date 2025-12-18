
import React, { useState } from 'react';
import { type Conversation, type Theme, type User } from '../types';
import { PlusIcon, ChatIcon, TrashIcon, SunIcon, MoonIcon, MenuIcon, SearchIcon, LogOutIcon, UserCircleIcon } from './Icons';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  currentConversationId: string | null;
  onClearHistory: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  currentUser: User | null;
  onLogout: () => void;
  onGoToAccount: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  onNewChat,
  onSelectConversation,
  currentConversationId,
  onClearHistory,
  theme,
  onToggleTheme,
  currentUser,
  onLogout,
  onGoToAccount,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter(convo => {
    const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowercasedSearchTerm) {
      return true;
    }
    const titleMatch = convo.title.toLowerCase().includes(lowercasedSearchTerm);
    const messageMatch = convo.messages.some(message =>
      message.content.toLowerCase().includes(lowercasedSearchTerm)
    );
    return titleMatch || messageMatch;
  });

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      <aside 
        className={`absolute flex flex-col h-full w-64 bg-gray-50 dark:bg-gpt-dark text-gray-800 dark:text-gray-200 z-40 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="p-2 flex items-center gap-2 flex-shrink-0">
          <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gpt-light-gray"
              aria-label="Fechar barra lateral"
          >
              <MenuIcon />
          </button>
          <div className="relative text-gray-500 dark:text-gray-400 flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon />
              </div>
              <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-200 dark:bg-gpt-light-gray border border-transparent rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
                  aria-label="Pesquisar conversas"
              />
          </div>
        </div>
        
        <div className="p-2 flex-shrink-0 border-b border-gray-200 dark:border-gray-700/50 mb-2">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gpt-light-gray transition-colors duration-200"
          >
            <PlusIcon />
            Nova Conversa
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-1">
            {filteredConversations.map(convo => (
              <li key={convo.id}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectConversation(convo.id);
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm truncate ${
                    currentConversationId === convo.id ? 'bg-gray-200 dark:bg-gpt-light-gray' : 'hover:bg-gray-200 dark:hover:bg-gpt-light-gray'
                  }`}
                >
                  <ChatIcon />
                  <span className="flex-1 truncate">{convo.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1 pb-[env(safe-area-inset-bottom)]">
          <SidebarButton icon={<TrashIcon />} text="Limpar conversas" onClick={onClearHistory} />
          <SidebarButton 
            icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />} 
            text={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'} 
            onClick={onToggleTheme} 
          />
          <div className="border-t border-gray-200 dark:border-gray-700/50 my-1" />
          {currentUser && (
            <div className="px-2 py-2">
              <button onClick={onGoToAccount} className="w-full flex items-center gap-2 mb-2 p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gpt-light-gray transition-colors">
                <UserCircleIcon />
                <span className="font-semibold text-sm">{currentUser.name}</span>
              </button>
              <SidebarButton icon={<LogOutIcon />} text="Sair" onClick={onLogout} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

const SidebarButton: React.FC<{ icon: React.ReactNode; text: string; onClick: () => void }> = ({ icon, text, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gpt-light-gray transition-colors duration-200"
  >
    {icon}
    {text}
  </button>
);
