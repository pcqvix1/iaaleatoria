
import React, { useEffect, useRef, useState, memo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { CloseIcon, MicIcon, MicOffIcon } from './Icons';

interface LiveViewProps {
  onClose: () => void;
}

export const LiveView: React.FC<LiveViewProps> = memo(({ onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0); // For visualization (0 to 1)
  
  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null); // Type 'Session' is not easily exported but we can use any
  
  // Helper: Decode Audio
  const decode = (base64: string) => {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };
  
  // Helper: Encode Audio for Upload
  const encode = (bytes: Uint8Array) => {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
  };
  
  const createBlob = (data: Float32Array): Blob => {
      const l = data.length;
      const int16 = new Int16Array(l);
      for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
      }
      return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
      };
  };

  useEffect(() => {
    let cleanupAudio = () => {};
    
    const startLiveSession = async () => {
      try {
        // 1. Obter API Key do servidor (Core Fix: O navegador não vê process.env)
        const keyResponse = await fetch('/api/get-key');
        if (!keyResponse.ok) throw new Error('Falha ao conectar com o servidor.');
        const { apiKey } = await keyResponse.json();

        if (!apiKey) throw new Error('API Key não encontrada no servidor.');

        // 2. Inicializar AI Client
        const ai = new GoogleGenAI({ apiKey: apiKey });
        
        // 3. Configurar Contexto de Áudio
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        audioContextRef.current = outputCtx;
        inputContextRef.current = inputCtx;
        
        // Output Node
        const outputNode = outputCtx.createGain();
        outputNode.connect(outputCtx.destination);

        // 4. Solicitar Microfone (Agora o erro de API Key não vai impedir isso)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // 5. Conectar ao Gemini Live
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              setIsConnected(true);
              
              // Input Processing (Mic -> Gemini)
              const source = inputCtx.createMediaStreamSource(stream);
              sourceRef.current = source;
              
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Calculate volume for visualizer
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                setVolume(v => Math.max(v * 0.9, rms * 5)); // Smoothing

                if (isMuted) return; // Don't send if muted locally
                
                const pcmBlob = createBlob(inputData);
                sessionPromise.then(session => {
                   session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              
              source.connect(processor);
              processor.connect(inputCtx.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
               // Handle Audio Output
               const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
               if (base64Audio) {
                   const audioBuffer = await decodeAudioData(
                       decode(base64Audio),
                       outputCtx,
                       24000,
                       1
                   );
                   
                   // Visualize output volume roughly based on existence of chunk
                   setVolume(0.5 + Math.random() * 0.3);
                   setTimeout(() => setVolume(0), audioBuffer.duration * 1000);
                   
                   const source = outputCtx.createBufferSource();
                   source.buffer = audioBuffer;
                   source.connect(outputNode);
                   
                   const currentTime = outputCtx.currentTime;
                   if (nextStartTimeRef.current < currentTime) {
                       nextStartTimeRef.current = currentTime;
                   }
                   
                   source.start(nextStartTimeRef.current);
                   nextStartTimeRef.current += audioBuffer.duration;
               }
               
               // Handle Interruption
               if (message.serverContent?.interrupted) {
                   nextStartTimeRef.current = 0;
               }
            },
            onclose: () => {
              setIsConnected(false);
            },
            onerror: (e) => {
              console.error("Gemini Live Error:", e);
              setError("Conexão interrompida.");
            }
          },
          config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
              },
              systemInstruction: "Você é um assistente de voz útil e amigável. Responda de forma concisa e natural."
          }
        });
        
        sessionRef.current = sessionPromise;

      } catch (err: any) {
        console.error("Failed to start live session:", err);
        if (err.name === 'NotAllowedError' || err.message.includes('permission')) {
            setError("Permissão de microfone negada.");
        } else {
            setError("Erro ao iniciar: " + (err.message || "Verifique a chave de API"));
        }
      }
    };

    startLiveSession();

    cleanupAudio = () => {
        if (sessionRef.current) {
            sessionRef.current.then((s: any) => s.close());
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current.onaudioprocess = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (inputContextRef.current) {
            inputContextRef.current.close();
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };

    return cleanupAudio;
  }, []); // Run once on mount

  // Toggle Mute
  const toggleMute = () => {
      setIsMuted(!isMuted);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#131314] text-white p-8 animate-fade-in">
      {/* Header */}
      <div className="w-full flex justify-between items-center">
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="font-semibold tracking-wide text-sm">LIVE</span>
        </div>
        <button 
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
            <CloseIcon />
        </button>
      </div>

      {/* Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center relative w-full">
         {error ? (
             <div className="text-center text-red-400 max-w-md animate-fade-in">
                 <p className="mb-4 text-xl font-medium">Ops!</p>
                 <p>{error}</p>
                 <button onClick={onClose} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">Fechar</button>
             </div>
         ) : (
            <div className="relative flex items-center justify-center">
                 {/* Connection Status Text */}
                 {!isConnected && (
                     <div className="absolute -top-20 text-white/50 animate-pulse">
                         Conectando...
                     </div>
                 )}
                 
                 {/* Abstract Orb / Waveform */}
                 <div 
                    className="rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-red-500 blur-xl opacity-60 transition-all duration-100 ease-linear"
                    style={{
                        width: `${200 + volume * 300}px`,
                        height: `${200 + volume * 300}px`,
                    }}
                 />
                 <div 
                    className="absolute rounded-full bg-white transition-all duration-100 ease-linear"
                    style={{
                        width: `${10 + volume * 50}px`,
                        height: `${10 + volume * 50}px`,
                        opacity: 0.8
                    }}
                 />
                 
                 {/* Orbiting particles (CSS decoration) */}
                 <div className="absolute w-[300px] h-[300px] border border-white/5 rounded-full animate-spin-slow"></div>
                 <div className="absolute w-[400px] h-[400px] border border-white/5 rounded-full animate-spin-reverse-slow"></div>
            </div>
         )}
      </div>

      {/* Controls */}
      <div className="w-full flex justify-center items-center gap-8 mb-8">
          <button 
            onClick={toggleMute}
            className={`p-6 rounded-full transition-all duration-300 ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
          </button>
          
          <button 
            onClick={onClose}
            className="p-6 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all transform hover:scale-105"
          >
              <CloseIcon />
          </button>
      </div>
      
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin-reverse-slow { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-spin-reverse-slow { animation: spin-reverse-slow 25s linear infinite; }
      `}</style>
    </div>
  );
});

LiveView.displayName = 'LiveView';
