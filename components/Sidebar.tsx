import React from 'react';
import { type Conversation, type Theme } from '../types';
import { PlusIcon, ChatIcon, TrashIcon, SunIcon, MoonIcon, UserIcon, SettingsIcon, CloseIcon } from './Icons';

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
}) => {
  return (
    <>
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      <aside className={`absolute md:relative flex flex-col h-full w-64 bg-gray-50 dark:bg-gpt-dark text-gray-800 dark:text-gray-200 z-40 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
        <div className="p-2 flex-shrink-0">
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
            {conversations.map(convo => (
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

        <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
          <SidebarButton icon={<TrashIcon />} text="Limpar conversas" onClick={onClearHistory} />
          <SidebarButton 
            icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />} 
            text={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'} 
            onClick={onToggleTheme} 
          />
        </div>
        <button onClick={onClose} className="absolute top-2 right-2 md:hidden p-1 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
          <CloseIcon />
        </button>
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