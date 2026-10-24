import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  X,
  ChevronDown,
  AlertCircle,
  Wrench,
  Box,
  QrCode,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Trash2,
  HelpCircle,
  Clock,
  ShieldCheck,
  User,
  RotateCcw,
  Volume1,
  Bot,
  MessageSquare,
  Play
} from 'lucide-react';
import { PageId } from './Sidebar';
import { AIAvatar } from './AIAvatar';

export type RobotState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
export type AICharacter = 'male' | 'female';
export type AssistantViewMode = 'robot' | 'text';

interface ResultCard {
  id?: number;
  asset_id?: string;
  name?: string;
  category?: string;
  lab_id?: number;
  lab_name?: string;
  location?: string;
  location_in_lab?: string;
  status?: string;
  serial_number?: string;
  action?: string;
  action_label?: string;
  navigate_to?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  spoken_text?: string;
  state?: RobotState;
  sql_intent?: string;
  lab_context?: string;
  record_count?: number;
  results?: ResultCard[];
  timestamp: string;
  disclaimer?: string;
  character?: AICharacter;
  isAiDiagnostic?: boolean;
  diagnosticData?: {
    category: string;
    priority: string;
    technician: string;
    confidence: number;
  };
}

interface AIRobotAssistantProps {
  onNavigate: (page: PageId) => void;
  onOpenQRScanner: () => void;
  initialOpen?: boolean;
}

export const AIRobotAssistant: React.FC<AIRobotAssistantProps> = ({
  onNavigate,
  onOpenQRScanner,
  initialOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [character, setCharacter] = useState<AICharacter>(() => {
    return (localStorage.getItem('smvitm_ai_character') as AICharacter) || 'male';
  });
  const [viewMode, setViewMode] = useState<AssistantViewMode>(() => {
    return (localStorage.getItem('smvitm_ai_view_mode') as AssistantViewMode) || 'robot';
  });
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const characterName = character === 'male' ? 'Arya' : 'Ananya';
  const characterTitle =
    character === 'male' ? 'Lead Systems Specialist' : 'Quantum Inventory Specialist';
  const isMale = character === 'male';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Namaste! I am **${characterName}**, your **SMVITM AI Inventory Intelligence & Assistant**.\n\nI can analyze real-time lab equipment records, verify computer availability, track pending repairs, and help diagnose equipment faults!`,
      spoken_text: `Namaste! I am ${characterName}, your SMVITM AI Inventory Intelligence Assistant. Ask me about equipment availability, repairs, or laboratory assets.`,
      timestamp: 'Just now',
      character: character
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Suggested dynamic inquiries matching actual supported database workflows and website guidance
  const suggestedQuestions = [
    'How do I use this website?',
    'How many working computers are in the AI & Deep Learning Laboratory?',
    'How do I add a new inventory item?',
    'How can I report faulty equipment?',
    'Which equipment is working, damaged, missing, or under repair?',
    'How can I find an asset using its ID?',
    'How do I generate or scan an asset\'s QR code?',
    'How do I check which items are under repair?',
    'How do I view low-stock alerts?',
    'How do I manage suppliers or departments?',
    'How do I generate inventory reports?',
    'Why can\'t I see a particular option?',
    'What are the pending repair and replacement requests?',
    'Where is asset SMVITM-AI-PC-001?'
  ];

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, robotState]);

  // Clean pronunciation formatter for TTS speech
  const formatSpokenPronunciation = (rawText: string): string => {
    if (!rawText) return '';
    let text = rawText;
    // Strip markdown bold, italics, headers, bullets, links
    text = text.replace(/#{1,6}\s*/g, '');
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/•\s*/g, '');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Currency conversion
    text = text.replace(/₹/g, ' rupees ');
    // Natural phonetic spacing for asset IDs so speech engine articulates clearly
    text = text.replace(/\b(SMVITM)-([A-Za-z0-9]+)-([A-Za-z0-9]+)-([A-Za-z0-9]+)\b/g, '$1 $2 $3 $4');
    text = text.replace(/\b(AIDS)-([A-Za-z0-9]+)-([A-Za-z0-9]+)\b/g, '$1 $2 $3');
    text = text.replace(/\b(REQ)-([A-Za-z0-9]+)-([A-Za-z0-9]+)\b/g, 'Requisition $2 $3');
    text = text.replace(/\b(FLT)-([A-Za-z0-9]+)-([A-Za-z0-9]+)\b/g, 'Fault ticket $2 $3');
    text = text.replace(/\s+/g, ' ').trim();
    // Return first 2 concise sentences up to 280 characters
    const sentences = text.split(/(?<=[.!?])\s+/);
    let result = '';
    for (const s of sentences) {
      if ((result + ' ' + s).length < 280) {
        result += (result ? ' ' : '') + s;
      } else {
        if (!result) result = s.slice(0, 270) + '...';
        break;
      }
    }
    return result.trim();
  };

  // Initialize Speech Recognition & Synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setRecognitionSupported(true);
      }

      if ('speechSynthesis' in window) {
        setSpeechSupported(true);
        synthRef.current = window.speechSynthesis;

        const populateVoices = () => {
          if (!synthRef.current) return;
          const voices = synthRef.current.getVoices();
          setAvailableVoices(voices);
          // Pick best initial voice matching the persona
          autoSelectBestVoice(character, voices);
        };

        populateVoices();
        if (synthRef.current.onvoiceschanged !== undefined) {
          synthRef.current.onvoiceschanged = populateVoices;
        }
      }
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const autoSelectBestVoice = (char: AICharacter, voices: SpeechSynthesisVoice[]) => {
    if (!voices || voices.length === 0) return;
    let match: SpeechSynthesisVoice | undefined;

    if (char === 'female') {
      match = voices.find(
        (v) =>
          (v.name.includes('Zira') ||
            v.name.includes('Heera') ||
            v.name.includes('Samantha') ||
            v.name.includes('Female') ||
            v.name.includes('Google UK English Female')) &&
          (v.lang.includes('en-IN') || v.lang.includes('en'))
      );
      if (!match) {
        match = voices.find((v) => v.lang.includes('en-IN') || v.lang.includes('en-US'));
      }
    } else {
      match = voices.find(
        (v) =>
          (v.name.includes('David') ||
            v.name.includes('Ravi') ||
            v.name.includes('Male') ||
            v.name.includes('Google UK English Male')) &&
          (v.lang.includes('en-IN') || v.lang.includes('en'))
      );
      if (!match) {
        match = voices.find((v) => v.lang.includes('en-IN') || v.lang.includes('en-GB') || v.lang.includes('en'));
      }
    }

    if (match) {
      setSelectedVoiceURI(match.voiceURI);
    }
  };

  // Synchronize Voice and persona change
  useEffect(() => {
    localStorage.setItem('smvitm_ai_character', character);
    if (availableVoices.length > 0) {
      autoSelectBestVoice(character, availableVoices);
    }
  }, [character]);

  useEffect(() => {
    localStorage.setItem('smvitm_ai_view_mode', viewMode);
  }, [viewMode]);

  const speakText = (text: string, forceCharacter?: AICharacter, preformattedSpoken?: string) => {
    if (isVoiceMuted || !speechSupported || !synthRef.current) return;

    synthRef.current.cancel();

    const charToUse = forceCharacter || character;
    const cleanSpoken = preformattedSpoken || formatSpokenPronunciation(text);
    if (!cleanSpoken) return;

    const utterance = new SpeechSynthesisUtterance(cleanSpoken);

    // Apply selected or matched voice
    let matchedVoice = availableVoices.find((v) => v.voiceURI === selectedVoiceURI);
    if (!matchedVoice && availableVoices.length > 0) {
      matchedVoice = availableVoices[0];
    }
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    // Persona pitch and speed optimization
    if (charToUse === 'female') {
      utterance.pitch = 1.15;
      utterance.rate = 1.0;
    } else {
      utterance.pitch = 0.95;
      utterance.rate = 1.0;
    }

    utterance.onstart = () => setRobotState('speaking');
    utterance.onend = () => setRobotState('idle');
    utterance.onerror = () => setRobotState('idle');

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setRobotState('idle');
    }
  };

  const startVoiceInput = () => {
    setSpeechError(null);
    if (!recognitionSupported) {
      setSpeechError('Speech recognition is not supported in this browser. Please use text input.');
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setRobotState('listening');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        setRobotState('idle');
        handleSendMessage(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        setRobotState('idle');
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission was denied. Please allow microphone access in your browser.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice error: ${event.error}. You can still type below.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (robotState === 'listening') setRobotState('idle');
      };

      recognition.start();
    } catch (e: any) {
      setIsListening(false);
      setRobotState('idle');
      setSpeechError('Could not start microphone. Please type your question.');
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
    setRobotState('idle');
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend) return;

    if (isListening) stopVoiceInput();
    stopSpeaking();

    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setRobotState('thinking');

    try {
      // Physical breakdown detector
      const lower = textToSend.toLowerCase();
      const isBreakdownReport =
        (lower.includes('broken') ||
          lower.includes('smoke') ||
          lower.includes('spark') ||
          lower.includes('not turning on') ||
          lower.includes('flicker') ||
          lower.includes('noise') ||
          lower.includes('beeping') ||
          lower.includes('leak') ||
          lower.includes('burnt')) &&
        textToSend.split(' ').length > 3;

      let diagnosticResult: any = null;
      if (isBreakdownReport) {
        try {
          diagnosticResult = await apiRequest('/ai/classify', {
            method: 'POST',
            body: JSON.stringify({ description: textToSend })
          });
        } catch (e) {}
      }

      // Query authentic grounded assistant API
      const assistantData = await apiRequest<{
        query: string;
        answer: string;
        spoken_text?: string;
        sql_intent: string;
        lab_context: string;
        record_count: number;
        results: ResultCard[];
        authorized_labs: string[];
        timestamp: string;
        disclaimer: string;
      }>('/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ query: textToSend })
      });

      let finalAnswer = assistantData.answer;
      if (diagnosticResult && diagnosticResult.category !== 'Needs Manual Review') {
        finalAnswer += `\n\n🤖 **AI Fault Diagnostic Suggestion:**\n• **Predicted Category:** ${diagnosticResult.category}\n• **Suggested Urgency:** ${diagnosticResult.suggested_priority}\n• **Recommended Technician:** ${diagnosticResult.recommended_technician} *(Confidence: ${Math.round(diagnosticResult.confidence * 100)}%)*`;
      }

      const spokenContent = assistantData.spoken_text || formatSpokenPronunciation(finalAnswer);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: finalAnswer,
        spoken_text: spokenContent,
        sql_intent: assistantData.sql_intent,
        lab_context: assistantData.lab_context,
        record_count: assistantData.record_count,
        results: assistantData.results,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        disclaimer: assistantData.disclaimer,
        character: character,
        isAiDiagnostic: !!diagnosticResult,
        diagnosticData: diagnosticResult
          ? {
              category: diagnosticResult.category,
              priority: diagnosticResult.suggested_priority,
              technician: diagnosticResult.recommended_technician,
              confidence: diagnosticResult.confidence
            }
          : undefined
      };

      setMessages((prev) => [...prev, botMsg]);
      speakText(finalAnswer, character, spokenContent);
    } catch (err: any) {
      setRobotState('error');
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Error accessing inventory intelligence: ${err.message || 'Please check network connection.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        disclaimer: 'Connection error during database inquiry.',
        character: character
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleCardAction = (card: ResultCard) => {
    if (card.action === 'OPEN_QR_SCANNER') {
      onOpenQRScanner();
      return;
    }
    if (card.navigate_to) {
      onNavigate(card.navigate_to as PageId);
    } else {
      onNavigate('inventory');
    }
  };

  const clearChat = () => {
    stopSpeaking();
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: `Conversation cleared. Ready for your next inventory inquiry or breakdown diagnosis with **${characterName}**.`,
        spoken_text: `Conversation cleared. Ready for your next inquiry with ${characterName}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        character: character
      }
    ]);
    setRobotState('idle');
  };

  const handleCharacterSwitch = (newChar: AICharacter) => {
    if (newChar === character) return;
    stopSpeaking();
    setCharacter(newChar);
    const newName = newChar === 'male' ? 'Arya' : 'Ananya';
    setMessages((prev) => [
      ...prev,
      {
        id: `switch-${Date.now()}`,
        sender: 'assistant',
        text: `Switched assistant persona to **${newName}** (${newChar === 'male' ? 'Lead Systems Specialist' : 'Quantum Inventory Specialist'}). How may I assist your laboratory today?`,
        spoken_text: `Switched assistant persona to ${newName}. How may I assist your laboratory today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        character: newChar
      }
    ]);
  };

  // Distinct themes
  const themeBgGlow = isMale
    ? 'from-navy-950 via-slate-900 to-cyan-950'
    : 'from-navy-950 via-purple-950 to-slate-900';
  const themeBorder = isMale ? 'border-cyan-500/40' : 'border-purple-500/40';
  const themeAccentText = isMale ? 'text-cyan-400' : 'text-purple-400';

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. FLOATING LAUNCHER BUTTON */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3">
        {!isOpen && (
          <div
            onClick={() => setIsOpen(true)}
            className={`hidden md:flex items-center space-x-2.5 px-3.5 py-2 rounded-2xl shadow-xl cursor-pointer border backdrop-blur-md transition-all duration-300 hover:scale-105 ${
              isMale
                ? 'bg-navy-900/90 text-cyan-200 border-cyan-400/40 hover:border-cyan-300 shadow-cyan-900/30'
                : 'bg-navy-900/90 text-purple-200 border-purple-400/40 hover:border-purple-300 shadow-purple-900/30'
            }`}
          >
            <AIAvatar character={character} state={robotState} size="sm" showAura={false} />
            <div className="flex flex-col pr-1">
              <span className="text-xs font-bold leading-tight flex items-center space-x-1">
                <span>Ask {characterName}</span>
                <Sparkles className="h-3 w-3 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
              </span>
              <span className="text-[10px] text-slate-300/80 leading-none mt-0.5">
                {isMale ? 'Male Avatar' : 'Female Avatar'} • Online
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            if (isOpen) stopSpeaking();
            setIsOpen(!isOpen);
          }}
          className={`relative p-2.5 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center active:scale-90 border ${
            isOpen
              ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400'
              : isMale
              ? 'bg-gradient-to-tr from-navy-950 via-navy-900 to-cyan-900 border-cyan-400/50 shadow-cyan-500/20'
              : 'bg-gradient-to-tr from-navy-950 via-navy-900 to-purple-900 border-purple-400/50 shadow-purple-500/20'
          }`}
          title={isOpen ? 'Close Assistant' : `Talk with ${characterName}`}
          aria-label="Toggle AI Assistant"
        >
          {isOpen ? (
            <X className="h-7 w-7" />
          ) : (
            <AIAvatar character={character} state={robotState} size="md" isSpeakingAudio={robotState === 'speaking'} />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN ASSISTANT WINDOW (ROBOT MODE & TEXT MODE) */}
      {/* ========================================================================= */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-40 w-[96vw] sm:w-[500px] h-[670px] max-h-[88vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          
          {/* Header Bar */}
          <div className={`bg-gradient-to-r ${themeBgGlow} text-white p-3.5 border-b border-navy-700/80 shadow-md`}>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <AIAvatar character={character} state={robotState} size="sm" isSpeakingAudio={robotState === 'speaking'} />
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h3 className="font-bold text-sm leading-tight text-white">{characterName}</h3>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border uppercase tracking-wider ${
                        isMale
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
                          : 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                      }`}
                    >
                      {characterTitle}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 flex items-center space-x-1 mt-0.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        robotState === 'listening'
                          ? 'bg-rose-400 animate-ping'
                          : robotState === 'thinking'
                          ? 'bg-amber-400 animate-pulse'
                          : robotState === 'speaking'
                          ? 'bg-emerald-400 animate-ping'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span>
                      {robotState === 'listening'
                        ? 'Listening to microphone...'
                        : robotState === 'thinking'
                        ? 'Analyzing authentic database...'
                        : robotState === 'speaking'
                        ? `Speaking (${characterName})...`
                        : robotState === 'error'
                        ? 'Diagnostic alert'
                        : 'Real-Time DB Grounded'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Mode Toggle & Header Actions */}
              <div className="flex items-center space-x-1">
                {/* Mode Selector Pill: Robot Mode vs Text Mode */}
                <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10 mr-1 text-[11px]">
                  <button
                    onClick={() => setViewMode('robot')}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg font-semibold transition ${
                      viewMode === 'robot'
                        ? isMale
                          ? 'bg-cyan-500 text-navy-950 font-bold shadow'
                          : 'bg-purple-500 text-white font-bold shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="Interactive AI Robot Visualizer Mode"
                  >
                    <Bot className="h-3 w-3" />
                    <span className="hidden sm:inline">Robot</span>
                  </button>
                  <button
                    onClick={() => setViewMode('text')}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg font-semibold transition ${
                      viewMode === 'text'
                        ? isMale
                          ? 'bg-cyan-500 text-navy-950 font-bold shadow'
                          : 'bg-purple-500 text-white font-bold shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="Streamlined Conversational Text Mode"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span className="hidden sm:inline">Text</span>
                  </button>
                </div>

                {robotState === 'speaking' && (
                  <button
                    onClick={stopSpeaking}
                    className="p-1.5 text-amber-300 hover:text-white hover:bg-white/10 rounded-xl transition"
                    title="Stop Speaking"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                )}

                {speechSupported && (
                  <button
                    onClick={() => {
                      if (!isVoiceMuted && robotState === 'speaking') stopSpeaking();
                      setIsVoiceMuted(!isVoiceMuted);
                    }}
                    className={`p-1.5 rounded-xl transition ${
                      isVoiceMuted
                        ? 'text-slate-400 hover:text-slate-200'
                        : isMale
                        ? 'text-cyan-300 bg-white/5'
                        : 'text-purple-300 bg-white/5'
                    }`}
                    title={isVoiceMuted ? 'Unmute Voice Output' : 'Mute Voice Output'}
                  >
                    {isVoiceMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                )}

                <button
                  onClick={clearChat}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
                  title="Clear Conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => {
                    stopSpeaking();
                    setIsOpen(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
                  title="Minimize"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Persona Switcher & Voice Config Pill */}
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => handleCharacterSwitch('male')}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition ${
                    isMale
                      ? 'bg-cyan-500 text-navy-950 font-bold shadow'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>👨 Arya (Male)</span>
                </button>
                <button
                  onClick={() => handleCharacterSwitch('female')}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition ${
                    !isMale
                      ? 'bg-purple-500 text-white font-bold shadow'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>👩 Ananya (Female)</span>
                </button>
              </div>

              {/* Voice Selector Dropdown Toggle */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  className="text-[10px] text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 flex items-center space-x-1 transition"
                  title="Select Voice"
                >
                  <span>🎙️ Voice</span>
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showVoiceSettings ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Voice Dropdown Panel */}
            {showVoiceSettings && (
              <div className="mt-2 p-2 bg-navy-950/90 rounded-xl border border-white/15 text-xs animate-in fade-in duration-150">
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">
                  Select System Speech Voice ({isMale ? 'Arya' : 'Ananya'}):
                </label>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-1.5 outline-none focus:border-cyan-400"
                >
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

          </div>

          {/* Voice Error Notice */}
          {speechError && (
            <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-1 text-[11px] text-amber-800 flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>{speechError}</span>
              </div>
              <button onClick={() => setSpeechError(null)} className="text-amber-900 font-bold ml-2">
                &times;
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ROBOT MODE: INTERACTIVE 3D/ANIMATED STAGE */}
          {/* ========================================================================= */}
          {viewMode === 'robot' && (
            <div className={`relative px-4 py-3 bg-gradient-to-b ${isMale ? 'from-slate-900 via-navy-950 to-slate-900' : 'from-slate-900 via-purple-950 to-slate-900'} border-b border-slate-800 flex items-center justify-between overflow-hidden shadow-inner`}>
              
              {/* Background Cybernetic Grid Lines */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, ${isMale ? '#00D8FF' : '#E056FD'} 1px, transparent 1px)`,
                  backgroundSize: '16px 16px'
                }}
              />

              {/* Left Side: Avatar Display */}
              <div className="relative flex items-center space-x-4 z-10">
                <AIAvatar character={character} state={robotState} size="2xl" showAura={true} isSpeakingAudio={robotState === 'speaking'} />

                <div>
                  <div className="flex items-center space-x-1.5">
                    <h4 className="font-bold text-white text-sm">{characterName}</h4>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${isMale ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' : 'bg-purple-500/20 text-purple-300 border-purple-400/40'}`}>
                      {isMale ? 'Cyborg Specialist' : 'Quantum AI'}
                    </span>
                  </div>

                  {/* Dynamic Status / Speaking Equalizer */}
                  <div className="mt-1 flex items-center space-x-2">
                    {robotState === 'speaking' ? (
                      <div className="flex items-center space-x-1 py-0.5 px-2 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px]">
                        <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-3" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 bg-emerald-300 rounded-full animate-bounce h-4" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 bg-white rounded-full animate-bounce h-2" style={{ animationDelay: '300ms' }} />
                        <span className="w-1 bg-emerald-300 rounded-full animate-bounce h-4" style={{ animationDelay: '200ms' }} />
                        <span className="font-semibold ml-1">Speaking Response</span>
                      </div>
                    ) : robotState === 'listening' ? (
                      <div className="flex items-center space-x-1.5 py-0.5 px-2 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-[10px] animate-pulse">
                        <Mic className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
                        <span className="font-semibold">Listening to speech...</span>
                      </div>
                    ) : robotState === 'thinking' ? (
                      <div className="flex items-center space-x-1.5 py-0.5 px-2 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px]">
                        <Sparkles className="h-3 w-3 animate-spin" style={{ animationDuration: '2s' }} />
                        <span className="font-semibold">Analyzing database...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 py-0.5 px-2 rounded-full bg-white/10 text-slate-300 text-[10px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>Interactive Assistant Ready</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side: Quick Action Mic / Replay Trigger */}
              <div className="relative z-10 flex flex-col items-end space-y-1">
                {recognitionSupported && (
                  <button
                    onClick={isListening ? stopVoiceInput : startVoiceInput}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-md active:scale-95 ${
                      isListening
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : isMale
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-navy-950'
                        : 'bg-purple-500 hover:bg-purple-400 text-white'
                    }`}
                  >
                    {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    <span>{isListening ? 'Stop Mic' : 'Voice Input'}</span>
                  </button>
                )}
                <span className="text-[9px] text-slate-400">SMVITM AI Engine</span>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* CONVERSATION MESSAGE STREAM */}
          {/* ========================================================================= */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/80">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl p-3 text-xs shadow-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? isMale
                        ? 'bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-br-none'
                        : 'bg-gradient-to-r from-purple-950 to-navy-900 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-none shadow-xs'
                  }`}
                >
                  {/* Assistant Message Header */}
                  {msg.sender === 'assistant' && (
                    <div className="flex items-center justify-between space-x-2 pb-1.5 mb-1.5 border-b border-slate-100 text-[10px] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <AIAvatar character={msg.character || character} state={robotState} size="xs" showAura={false} />
                        <span className={`font-bold ${isMale ? 'text-cyan-800' : 'text-purple-800'}`}>
                          {msg.character === 'female' ? 'Ananya' : 'Arya'}
                        </span>
                        {msg.sql_intent && (
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-mono">
                            {msg.sql_intent}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {speechSupported && (
                          <button
                            onClick={() => speakText(msg.text, msg.character || character, msg.spoken_text)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-navy-900 transition flex items-center space-x-0.5 active:scale-95"
                            title="Replay Voice Speech"
                          >
                            <Volume1 className="h-3 w-3 text-cyan-700" />
                            <span className="text-[9px] font-semibold text-cyan-800">Replay</span>
                          </button>
                        )}
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                  )}

                  {/* Body text with bold / bullet rendering */}
                  <div className="space-y-1.5 whitespace-pre-wrap">
                    {msg.text.split('\n\n').map((paragraph, idx) => (
                      <p key={idx}>
                        {paragraph.split('**').map((part, pIdx) =>
                          pIdx % 2 === 1 ? (
                            <strong key={pIdx} className="font-bold text-navy-950">
                              {part}
                            </strong>
                          ) : (
                            part
                          )
                        )}
                      </p>
                    ))}
                  </div>

                  {/* Equipment Result Cards if returned */}
                  {msg.results && msg.results.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>Database Records ({msg.results.length}):</span>
                        {msg.lab_context && <span className="text-slate-400 font-normal">{msg.lab_context}</span>}
                      </div>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {msg.results.slice(0, 6).map((card, cIdx) => (
                          <div
                            key={cIdx}
                            className="bg-slate-50 hover:bg-slate-100/90 p-2 rounded-xl border border-slate-200/80 flex items-center justify-between text-[11px] transition"
                          >
                            <div className="pr-2 truncate">
                              <div className="font-bold text-navy-900 truncate flex items-center space-x-1.5">
                                <span>{card.asset_id || card.name}</span>
                                {card.status && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                      card.status.toLowerCase().includes('work') || card.status.toLowerCase().includes('operat')
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : card.status.toLowerCase().includes('repair') || card.status.toLowerCase().includes('fault')
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {card.status}
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 text-[10px] truncate">
                                {card.name && card.asset_id ? card.name : ''} {card.lab_name ? `• ${card.lab_name}` : ''}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCardAction(card)}
                              className="px-2 py-0.5 bg-white hover:bg-navy-900 hover:text-white border border-slate-200 text-navy-900 rounded-lg font-semibold text-[10px] flex items-center space-x-1 shrink-0 transition shadow-xs"
                            >
                              <span>{card.action_label || 'View'}</span>
                              <ArrowRight className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grounded Disclaimer Note */}
                  {msg.disclaimer && (
                    <div className="mt-2 text-[10px] text-slate-400 flex items-center space-x-1 italic border-t border-slate-100 pt-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                      <span>{msg.disclaimer}</span>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <span className="text-[10px] text-slate-400 mt-1 mr-1">{msg.timestamp}</span>
                )}
              </div>
            ))}

            {/* Thinking / Listening Indicator Bubble */}
            {robotState === 'thinking' && (
              <div className="flex items-center space-x-2.5 text-xs text-slate-600 bg-white p-2.5 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm max-w-[260px]">
                <AIAvatar character={character} state="thinking" size="xs" showAura={false} />
                <div className="flex space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isMale ? 'bg-cyan-500' : 'bg-purple-500'} animate-bounce`} style={{ animationDelay: '0ms' }} />
                  <div className={`w-2 h-2 rounded-full ${isMale ? 'bg-cyan-500' : 'bg-purple-500'} animate-bounce`} style={{ animationDelay: '150ms' }} />
                  <div className={`w-2 h-2 rounded-full ${isMale ? 'bg-cyan-500' : 'bg-purple-500'} animate-bounce`} style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[11px] font-medium">{characterName} is querying records...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Questions Scroll Bar */}
          <div className="bg-slate-100/90 border-t border-slate-200 p-2 overflow-x-auto flex space-x-1.5 scrollbar-none">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={robotState === 'thinking'}
                className={`whitespace-nowrap px-2.5 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-semibold text-slate-700 transition shrink-0 active:scale-95 disabled:opacity-50 ${
                  isMale ? 'hover:bg-cyan-50 hover:text-cyan-900' : 'hover:bg-purple-50 hover:text-purple-900'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input & Microphone Bar */}
          <div className="p-2.5 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              {/* Voice Input Microphone Button */}
              {recognitionSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  disabled={robotState === 'thinking'}
                  className={`p-2.5 rounded-xl transition shrink-0 ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : isMale
                      ? 'bg-slate-100 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700'
                      : 'bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700'
                  }`}
                  title={isListening ? 'Stop Listening' : 'Speak Question with Microphone'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isListening ? 'Listening to speech...' : `Ask ${characterName} about computers, repairs, lab assets...`}
                disabled={robotState === 'thinking'}
                className="flex-1 py-2 px-3.5 bg-slate-50 border border-slate-200 focus:border-navy-900 focus:bg-white rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || robotState === 'thinking'}
                className={`p-2.5 text-white rounded-xl transition shadow active:scale-95 shrink-0 disabled:opacity-40 ${
                  isMale ? 'bg-cyan-800 hover:bg-cyan-700' : 'bg-purple-800 hover:bg-purple-700'
                }`}
                title="Send Message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
};
