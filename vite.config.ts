import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      // Configuração do servidor de desenvolvimento
      server: {
        port: 3000,
        host: '0.0.0.0',
        open: false, // Não abrir o navegador automaticamente
      },
      
      // Plugins
      plugins: [react()],
      
      // Variáveis de ambiente disponíveis no cliente
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      
      // Resolução de caminhos
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      
      // Configuração da pasta public (IMPORTANTE PARA PWA)
      publicDir: 'public',
      
      // Configuração de build
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false, // Desabilitar sourcemaps em produção
        // Garante que arquivos da pasta public sejam copiados
        copyPublicDir: true,
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'markdown-vendor': ['react-markdown', 'remark-gfm', 'rehype-raw'],
            }
          }
        },
        // Otimizações
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true, // Remove console.log em produção
          }
        }
      },
      
      // Otimização de dependências
      optimizeDeps: {
        include: ['react', 'react-dom', 'uuid'],
      }
    };
});