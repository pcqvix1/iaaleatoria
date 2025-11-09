import React, { useState } from 'react';
import { type User } from '../types';
import { authService } from '../services/authService';
import { ArrowLeftIcon, AlertTriangleIcon, UserCircleIcon, CloseIcon } from './Icons';

interface AccountPageProps {
  currentUser: User;
  onBack: () => void;
  onPasswordUpdate: () => void;
  onAccountDeleted: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ currentUser, onBack, onPasswordUpdate, onAccountDeleted }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('As novas senhas não correspondem.');
      return;
    }
    if (newPassword.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    setIsLoading(true);
    try {
      await authService.updatePassword(currentUser.id, newPassword, currentUser.hasPassword ? currentPassword : undefined);
      setSuccess('Senha atualizada com sucesso!');
      onPasswordUpdate(); // Notifies App.tsx to refresh user data
      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== currentUser.email) {
        setError('O e-mail de confirmação está incorreto.');
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        await authService.deleteAccount(currentUser.id);
        onAccountDeleted(); // This will trigger logout and redirect
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao excluir a conta.');
        setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-y-auto">
       <header className="relative flex-shrink-0 px-4 py-2 border-b border-gray-300 dark:border-gray-700/50 flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50">
                <ArrowLeftIcon />
            </button>
            <h1 className="text-lg font-semibold">Minha Conta</h1>
       </header>

       <main className="flex-1 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* User Info Section */}
                <div className="p-6 bg-white dark:bg-gpt-light-gray rounded-lg shadow-sm">
                    <div className="flex items-center gap-4">
                        <UserCircleIcon />
                        <div>
                            <h2 className="text-xl font-bold">{currentUser.name}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                        </div>
                    </div>
                </div>

                {/* Password Section */}
                <div className="p-6 bg-white dark:bg-gpt-light-gray rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">{currentUser.hasPassword ? 'Alterar Senha' : 'Criar Senha'}</h3>
                    { !currentUser.hasPassword && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Você se cadastrou usando um provedor social. Crie uma senha para poder fazer login com seu e-mail e senha também.
                        </p>
                    )}
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        {currentUser.hasPassword && (
                             <FormInput label="Senha Atual" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                        )}
                        <FormInput label="Nova Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                        <FormInput label="Confirmar Nova Senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                        
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {success && <p className="text-sm text-green-500">{success}</p>}
                        
                        <div className="flex justify-end">
                            <button type="submit" disabled={isLoading} className="px-4 py-2 text-white bg-gpt-green rounded-md hover:bg-opacity-90 disabled:bg-opacity-50">
                                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </form>
                </div>
                
                {/* Danger Zone */}
                <div className="p-6 bg-white dark:bg-gpt-light-gray rounded-lg shadow-sm border border-red-500/50">
                    <h3 className="text-lg font-semibold text-red-600 dark:text-red-500 mb-2">Zona de Perigo</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        A exclusão da sua conta é uma ação irreversível. Todos os seus dados, incluindo as conversas, serão permanentemente apagados.
                    </p>
                    <button onClick={() => setIsDeleteModalOpen(true)} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700">
                        Excluir minha conta
                    </button>
                </div>
            </div>
       </main>
       
       {isDeleteModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center animate-fade-in" onClick={() => setIsDeleteModalOpen(false)}>
                <div className="bg-white dark:bg-gpt-dark rounded-lg shadow-2xl w-full max-w-md m-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
                     <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                           <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400"><AlertTriangleIcon /></div>
                           <h2 className="text-xl font-bold text-gray-900 dark:text-white">Excluir Conta</h2>
                        </div>
                        <button onClick={() => setIsDeleteModalOpen(false)} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gpt-light-gray"><CloseIcon /></button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Esta ação não pode ser desfeita. Para confirmar, digite seu e-mail (<strong className="select-all">{currentUser.email}</strong>) no campo abaixo.
                    </p>
                     <FormInput label="Confirmar E-mail" type="email" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} required />
                     {error && <p className="text-sm text-red-500">{error}</p>}
                     <div className="flex justify-end gap-4 pt-2">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gpt-light-gray rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        <button onClick={handleDeleteAccount} disabled={isLoading || deleteConfirmation !== currentUser.email} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400/50 disabled:cursor-not-allowed">
                            {isLoading ? 'Excluindo...' : 'Excluir Permanentemente'}
                        </button>
                     </div>
                </div>
            </div>
       )}
    </div>
  );
};

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}
const FormInput: React.FC<FormInputProps> = ({ label, id, ...props }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
        </label>
        <div className="mt-1">
            <input
                id={id}
                name={id}
                {...props}
                className="w-full px-3 py-2 text-gray-800 bg-gray-50 dark:text-gray-100 dark:bg-gpt-gray border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gpt-green focus:border-gpt-green sm:text-sm"
            />
        </div>
    </div>
);