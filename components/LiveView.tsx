
import React, { useEffect, useRef, useState, memo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { CloseIcon, MicIcon, MicOffIcon } from './Icons';
import { type Message, type VoiceName } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface LiveViewProps {
  onClose: () => void;
  voiceName: VoiceName;
  onSessionEnd: (messages: Message[]) => void;
}

export const LiveView: React.FC<LiveViewProps> = memo(({ onClose, voiceName, onSessionEnd }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0); 
  
  // Transcription States
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [transcriptSource, setTranscriptSource] = useState<'user' | 'model' | null>(null);

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  
  // History Management Refs
  const historyRef = useRef<Message[]>([]);
  const currentInputBuffer = useRef<string>('');
  const currentOutputBuffer = useRef<string>('');

  // Helper: Commit current buffers to history
  const commitToHistory = (role: 'user' | 'model', final: boolean = false) => {
      // Logic: If we are switching roles, the previous role's buffer is done.
      
      if (role === 'user' && currentOutputBuffer.current.trim()) {
          // Model finished speaking, user started
          historyRef.current.push({
              id: uuidv4(),
              role: 'model',
              content: currentOutputBuffer.current.trim()
          });
          currentOutputBuffer.current = '';
      }
      
      if (role === 'model' && currentInputBuffer.current.trim()) {
          // User finished speaking, model started
          historyRef.current.push({
              id: uuidv4(),
              role: 'user',
              content: currentInputBuffer.current.trim()
          });
          currentInputBuffer.current = '';
      }

      if (final) {
          if (currentInputBuffer.current.trim()) {
             historyRef.current.push({ id: uuidv4(), role: 'user', content: currentInputBuffer.current.trim() });
          }
          if (currentOutputBuffer.current.trim()) {
             historyRef.current.push({ id: uuidv4(), role: 'model', content: currentOutputBuffer.current.trim() });
          }
      }
  };
  
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
        const keyResponse = await fetch('/api/get-key');
        if (!keyResponse.ok) throw new Error('Falha ao conectar com o servidor.');
        const { apiKey } = await keyResponse.json();

        if (!apiKey) throw new Error('API Key não encontrada no servidor.');

        const ai = new GoogleGenAI({ apiKey: apiKey });
        
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        audioContextRef.current = outputCtx;
        inputContextRef.current = inputCtx;
        
        const outputNode = outputCtx.createGain();
        outputNode.connect(outputCtx.destination);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              setIsConnected(true);
              
              const source = inputCtx.createMediaStreamSource(stream);
              sourceRef.current = source;
              
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                setVolume(v => Math.max(v * 0.9, rms * 5)); 

                if (isMuted) return; 
                
                const pcmBlob = createBlob(inputData);
                sessionPromise.then(session => {
                   session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              
              source.connect(processor);
              processor.connect(inputCtx.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
               // --- 1. Audio Output ---
               const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
               if (base64Audio) {
                   const audioBuffer = await decodeAudioData(
                       decode(base64Audio),
                       outputCtx,
                       24000,
                       1
                   );
                   
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

               // --- 2. Transcription Handling (Real-time Captions) ---
               // Input (User)
               const inputTrans = message.serverContent?.inputTranscription;
               if (inputTrans) {
                   commitToHistory('user'); // Ensure previous model turn is saved
                   currentInputBuffer.current += inputTrans.text;
                   setTranscriptSource('user');
                   setCurrentTranscript(currentInputBuffer.current);
               }

               // Output (Model)
               const outputTrans = message.serverContent?.outputTranscription;
               if (outputTrans) {
                   commitToHistory('model'); // Ensure previous user turn is saved
                   currentOutputBuffer.current += outputTrans.text;
                   setTranscriptSource('model');
                   setCurrentTranscript(currentOutputBuffer.current);
               }
               
               // --- 3. Handle Interruption ---
               if (message.serverContent?.interrupted) {
                   nextStartTimeRef.current = 0;
                   // Model was interrupted, so we should cut off its buffer
                   // However, for the transcript, we usually want to keep what was said so far.
                   // The API stops sending outputTranscription after interruption.
               }
               
               // --- 4. Turn Complete ---
               if (message.serverContent?.turnComplete) {
                   // This usually signals the model is done responding.
                   // We don't necessarily clear buffers here because we might want to show the full text until the next person speaks.
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
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
              },
              inputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
              outputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
              systemInstruction: "Você é um assistente de voz útil e amigável. Responda de forma concisa e natural. Não use formatação markdown na fala, fale como um humano."
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
  }, [voiceName]); 

  const handleClose = () => {
      // Commit pending text
      commitToHistory('user', true); // Commit both
      
      const finalHistory = historyRef.current.filter(m => m.content.trim().length > 0);
      onSessionEnd(finalHistory);
      onClose();
  };

  // Toggle Mute
  const toggleMute = () => {
      setIsMuted(!isMuted);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#131314] text-white p-8 animate-fade-in transition-colors duration-500">
      {/* Header */}
      <div className="w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="font-semibold tracking-wide text-sm opacity-80">GEMINI LIVE • {voiceName}</span>
        </div>
        <button 
            onClick={handleClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md"
        >
            <CloseIcon />
        </button>
      </div>

      {/* Visualizer & Captions */}
      <div className="flex-1 flex flex-col items-center justify-center relative w-full">
         {error ? (
             <div className="text-center text-red-400 max-w-md animate-fade-in bg-black/50 p-6 rounded-2xl backdrop-blur-md border border-red-500/20">
                 <p className="mb-4 text-xl font-medium">Ops!</p>
                 <p>{error}</p>
                 <button onClick={handleClose} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">Fechar</button>
             </div>
         ) : (
            <>
                <div className="relative flex items-center justify-center flex-1 w-full">
                     {/* Connection Status Text */}
                     {!isConnected && (
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 animate-pulse text-xl font-light">
                             Conectando...
                         </div>
                     )}
                     
                     {/* Abstract Orb / Waveform */}
                     <div 
                        className="rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-red-500 blur-2xl opacity-50 transition-all duration-75 ease-out"
                        style={{
                            width: `${200 + volume * 300}px`,
                            height: `${200 + volume * 300}px`,
                            transform: 'scale(' + (1 + volume * 0.2) + ')'
                        }}
                     />
                     <div 
                        className="absolute rounded-full bg-white transition-all duration-75 ease-out shadow-[0_0_50px_rgba(255,255,255,0.3)]"
                        style={{
                            width: `${10 + volume * 60}px`,
                            height: `${10 + volume * 60}px`,
                            opacity: 0.9
                        }}
                     />
                     
                     {/* Orbiting particles (CSS decoration) */}
                     <div className="absolute w-[300px] h-[300px] border border-white/5 rounded-full animate-spin-slow"></div>
                     <div className="absolute w-[450px] h-[450px] border border-white/5 rounded-full animate-spin-reverse-slow opacity-50"></div>
                </div>

                {/* Real-time Captions */}
                <div className="w-full max-w-2xl min-h-[100px] mb-8 text-center px-4 z-10">
                    {currentTranscript && (
                        <div className={`transition-all duration-500 ${transcriptSource ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                                {transcriptSource === 'user' ? 'Você' : 'Gemini'}
                            </p>
                            <p className="text-xl md:text-2xl font-medium leading-relaxed text-white/90 drop-shadow-md">
                                "{currentTranscript}"
                            </p>
                        </div>
                    )}
                </div>
            </>
         )}
      </div>

      {/* Controls */}
      <div className="w-full flex justify-center items-center gap-8 mb-8 z-10">
          <button 
            onClick={toggleMute}
            className={`p-6 rounded-full transition-all duration-300 backdrop-blur-sm ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
          >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
          </button>
          
          <button 
            onClick={handleClose}
            className="p-6 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all transform hover:scale-105 shadow-lg shadow-red-900/20"
          >
              <CloseIcon />
          </button>
      </div>
      
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin-reverse-slow { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-spin-reverse-slow { animation: spin-reverse-slow 35s linear infinite; }
      `}</style>
    </div>
  );
});

LiveView.displayName = 'LiveView';
