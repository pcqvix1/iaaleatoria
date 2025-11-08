
import React, { useState } from 'react';

interface LoginPageProps {
    onLogin: (email: string, password: string) => Promise<string | null>;
    onRegister: (name: string, email: string, password: string) => Promise<string | null>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onRegister }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        
        let result: string | null = null;
        try {
            if (isLoginView) {
                result = await onLogin(email, password);
            } else {
                result = await onRegister(name, email, password);
            }
        } catch (err) {
            result = err instanceof Error ? err.message : 'Ocorreu um erro inesperado.';
        }
        
        if (result) {
            setError(result);
        }
        
        setIsLoading(false);
    };

    const toggleView = () => {
        setIsLoginView(!isLoginView);
        setError(null);
        setName('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className="flex items-center justify-center h-screen w-screen bg-gray-100 dark:bg-gpt-gray">
            <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gpt-dark rounded-lg shadow-md animate-fade-in">
                <div>
                    <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
                        {isLoginView ? 'Bem-vindo de volta!' : 'Crie sua conta'}
                    </h2>
                    <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                        {isLoginView ? 'Faça login para continuar' : 'Preencha os campos para se registrar'}
                    </p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    {!isLoginView && (
                        <FormInput 
                            id="name"
                            label="Nome"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    )}
                    <FormInput 
                        id="email"
                        label="Endereço de e-mail"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    <FormInput 
                        id="password"
                        label="Senha"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />

                    {error && (
                        <p className="text-sm text-center text-red-500">{error}</p>
                    )}

                    <div>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full px-4 py-2 text-white bg-gpt-green rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gpt-green dark:focus:ring-offset-gpt-dark disabled:bg-opacity-50 transition-colors"
                        >
                            {isLoading ? 'Carregando...' : (isLoginView ? 'Entrar' : 'Registrar')}
                        </button>
                    </div>
                </form>

                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                    {isLoginView ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                    <button onClick={toggleView} className="ml-1 font-medium text-gpt-green hover:underline">
                        {isLoginView ? 'Crie uma aqui' : 'Faça login'}
                    </button>
                </p>
            </div>
        </div>
    );
};

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    id: string;
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
                className="w-full px-3 py-2 text-gray-800 bg-gray-50 dark:text-gray-100 dark:bg-gpt-light-gray border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gpt-green focus:border-gpt-green sm:text-sm"
            />
        </div>
    </div>
);
