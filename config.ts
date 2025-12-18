
// CONFIGURAÇÃO DA API
// Se estiver rodando localmente (desenvolvimento web), usa caminho relativo.
// Se estiver no celular (Capacitor), usa a URL completa da Vercel.

const IS_CAPACITOR = window.location.protocol !== 'http:' && window.location.protocol !== 'https:';

// SUBSTITUA "https://seu-projeto.vercel.app" PELA URL REAL DO SEU DEPLOY NA VERCEL
const PROD_URL = 'https://iaaleatoria.vercel.app/'; 

export const API_BASE_URL = IS_CAPACITOR 
  ? `${PROD_URL}/api` 
  : '/api';
