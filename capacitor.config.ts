import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geminigpt.app',
  appName: 'Gemini GPT',
  webDir: 'dist', // Certifique-se que esta é a pasta onde seu build é gerado (pode ser 'build' se usar CRA)
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;