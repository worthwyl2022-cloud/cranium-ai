import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import {
  ArrowUp,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Code2,
  Compass,
  Cpu,
  FileText,
  Globe2,
  Mic,
  LogOut,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  PanelRight,
  Plus,
  Search,
  Settings2,
  Sparkles,
  UserRound,
  Volume2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type GroundingSource = { repo: string; file: string; url: string; authority: string; excerpt: string };
type WorldKnowledgeSource = { kind: "news" | "reference"; title: string; url: string; domain: string; snippet: string; publishedAt?: string };
type CraniumMode = "general" | "builder" | "research" | "creative" | "operator" | "memory";
type CraniumOutput = "answer" | "plan" | "code" | "brief" | "action_proposal";
type ChatMessage = { role: "user" | "assistant"; content: string; model?: string; mode?: CraniumMode; output?: CraniumOutput; grounded?: boolean; research?: boolean; sources?: GroundingSource[]; knowledge?: WorldKnowledgeSource[]; substrate?: { governed: boolean; authority: string; core?: { transactionId: string; journalSequence: number; decision: string }; synapse?: { riskClass: string; confidence: number; disposition: string } }; error?: boolean; retryText?: string };
type BrowserRecognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };

const starterPrompts = [
  "What can you help me build today?",
  "Explain the Cranium substrate in plain language.",
  "Help me turn an idea into a WorthWyl product.",
];

const defaultMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Welcome to **Cranium AI**. I’m the general intelligence layer presented by WorthWyl — ready for conversation, research, coding, creative work, and whatever you’re building next.\n\nAsk me anything, or choose a starting point below.",
    model: "gpt-5-mini",
  },
];

function ProgressiveResponse({ content }: { content: string }) {
  const [visibleLength, setVisibleLength] = useState(content.length);

  useEffect(() => {
    if (content.length <= 1) {
      setVisibleLength(content.length);
      return;
    }
    setVisibleLength(0);
    const timer = window.setInterval(() => {
      setVisibleLength(current => {
        const next = Math.min(content.length, current + Math.max(2, Math.ceil(content.length / 80)));
        if (next >= content.length) window.clearInterval(timer);
        return next;
      });
    }, 18);
    return () => window.clearInterval(timer);
  }, [content]);

  return <Streamdown>{content.slice(0, visibleLength)}</Streamdown>;
}

export default function Home() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(defaultMessages);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState("auto");
  const [mode, setMode] = useState<CraniumMode>("general");
  const [output, setOutput] = useState<CraniumOutput>("answer");
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [openConversationId, setOpenConversationId] = useState<number | undefined>();
  const [historySearch, setHistorySearch] = useState("");
  const [grounded, setGrounded] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceRate, setVoiceRate] = useState(0.98);
  const [voicePitch, setVoicePitch] = useState(0.95);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showLayer, setShowLayer] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelsQuery = trpc.chat.models.useQuery();
  const capabilitiesQuery = trpc.chat.capabilities.useQuery();
  const conversationsQuery = trpc.chat.conversations.useQuery(undefined, { enabled: isAuthenticated });
  const messagesQuery = trpc.chat.messages.useQuery({ conversationId: openConversationId ?? 0 }, { enabled: Boolean(openConversationId && isAuthenticated) });
  const sendMutation = trpc.chat.send.useMutation();
  const voiceStorageKey = `cranium-voice:${user?.openId ?? "guest"}`;

  const models = modelsQuery.data ?? [
    { id: "auto", label: "Auto", provider: "Cranium", note: "Routes by task" },
    { id: "gpt-5-mini", label: "GPT-5 mini", provider: "OpenAI", note: "Fast workhorse" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet", provider: "Anthropic", note: "Deep reasoning" },
  ];
  const selectedModel = models.find(item => item.id === model) ?? models[0];
  const recentConversations = conversationsQuery.data ?? [];
  const filteredConversations = recentConversations.filter(conversation => conversation.title.toLowerCase().includes(historySearch.toLowerCase().trim()));
  const isSending = sendMutation.isPending;
  const statusLabel = isSending ? "Thinking" : researchMode ? "Live research · ready to think" : grounded ? "Grounded · ready to think" : "Ready to think";

  useEffect(() => {
    if (models.length && !models.some(item => item.id === model)) setModel(models[0].id);
  }, [model, models]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(voiceStorageKey) ?? "null") as { enabled?: boolean; rate?: number; pitch?: number } | null;
      if (saved) {
        if (typeof saved.enabled === "boolean") setVoiceEnabled(saved.enabled);
        if (typeof saved.rate === "number") setVoiceRate(saved.rate);
        if (typeof saved.pitch === "number") setVoicePitch(saved.pitch);
      }
    } catch {
      // Browser storage can be unavailable in private or restricted contexts.
    }
  }, [voiceStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(voiceStorageKey, JSON.stringify({ enabled: voiceEnabled, rate: voiceRate, pitch: voicePitch }));
    } catch {
      // Preference persistence is best-effort.
    }
  }, [voiceEnabled, voicePitch, voiceRate, voiceStorageKey]);

  useEffect(() => {
    if (!messagesQuery.data || !openConversationId) return;
    const loaded: ChatMessage[] = messagesQuery.data.map(message => ({ role: message.role === "user" ? "user" : "assistant", content: message.content, model: message.model ?? undefined }));
    if (loaded.length) {
      setMessages(loaded);
      setConversationId(openConversationId);
    }
  }, [messagesQuery.data, openConversationId]);

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || isSending) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setDraft("");
    try {
      const result = await sendMutation.mutateAsync({
        conversationId,
        model,
        mode,
        output,
        grounded,
        research: researchMode,
        messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
      });
      setConversationId(result.conversationId);
      setMessages(current => [...current, { role: "assistant", content: result.content, model: result.model, mode: result.mode, output: result.output, grounded: result.grounded, research: result.research, sources: result.sources, knowledge: result.knowledge, substrate: result.substrate }]);
      if (voiceEnabled) window.setTimeout(() => speakMessage(result.content, nextMessages.length), 0);
      void conversationsQuery.refetch();
      } catch (error) {
        console.error("[Cranium] Chat request failed", error);
        const detail = error instanceof Error ? error.message.replace(/^TRPCClientError:\s*/i, "").slice(0, 180) : "The model gateway did not return a response.";
        setMessages(current => [
          ...current,
          { role: "assistant", error: true, retryText: content, content: `I couldn’t complete that response.\n\n**Details:** ${detail}` },
        ]);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  const newChat = () => {
    setMessages(defaultMessages);
    setConversationId(undefined);
    setOpenConversationId(undefined);
    setDraft("");
    textareaRef.current?.focus();
  };

  const currentMode = useMemo(() => {
    if (draft.toLowerCase().includes("code")) return "Builder";
    if (draft.toLowerCase().includes("research")) return "Research";
    return "General";
  }, [draft]);

  const speakMessage = (text: string, index: number) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (speakingIndex === index) {
      setSpeakingIndex(null);
      return;
    }
    const spoken = text.replace(/[`*_>#\[\]]/g, "").replace(/https?:\/\/\S+/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = "en-US";
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    utterance.onend = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as Window & { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: new () => BrowserRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (isListening) {
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript ?? "").join(" ");
      setDraft(current => `${current} ${transcript}`.trim());
    };
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  return (
    <div className="cranium-app min-h-screen overflow-hidden bg-[#101318] text-[#f4f0e8]">
      <header className="cranium-topbar flex h-[74px] items-center justify-between border-b border-white/10 px-4 md:px-7">
        <div className="flex items-center gap-3">
          <button className="icon-button md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="brand-mark brand-mark-image" aria-hidden="true"><img src="/manus-storage/Picsart_26-08-02_01-54-52-277_2be9d44f.webp" alt="" /></div>
          <div className="leading-none">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#a8b5b0]">WorthWyl presents</div>
            <div className="mt-1 font-display text-[21px] tracking-[-0.04em] text-[#f8f2e7]">Cranium <span className="text-[#ffc857]">AI</span></div>
          </div>
          <Badge className="ml-2 hidden border border-[#ffc857]/20 bg-[#ffc857]/10 font-mono text-[9px] uppercase tracking-[0.15em] text-[#ffc857] sm:inline-flex">Private beta</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-[#a8b5b0] transition hover:border-white/20 hover:text-white lg:flex"><Globe2 size={14} /> Global workspace <ChevronDown size={13} /></button>
          {loading ? <div className="h-8 w-20 animate-pulse rounded-full bg-white/10" /> : isAuthenticated ? (
            <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#e5e0d5] transition hover:bg-white/10" onClick={() => void logout()}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ffc857] text-[10px] font-semibold text-[#2a1806]">{(user?.name || "W").slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-[120px] truncate sm:inline">{user?.name || "Account"}</span><LogOut size={13} className="text-[#8c9993]" />
            </button>
          ) : <Button onClick={startLogin} className="h-9 rounded-full bg-[#f4f0e8] px-4 text-xs font-semibold text-[#171b1e] hover:bg-white">Sign in</Button>}
        </div>
      </header>

      <div className="flex h-[calc(100vh-74px)] min-h-0">
        <aside className={`cranium-sidebar fixed inset-y-[74px] left-0 z-30 w-[285px] border-r border-white/10 bg-[#12161b] px-4 py-5 transition-transform md:relative md:inset-y-0 md:z-0 md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="mb-5 flex items-center justify-between md:hidden"><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8d9a95]">Navigation</span><button className="icon-button" onClick={() => setMobileNavOpen(false)}><X size={17} /></button></div>
          <Button onClick={newChat} className="mb-5 h-11 w-full justify-between rounded-xl bg-[#ffc857] px-4 text-sm font-semibold text-[#2b1805] hover:bg-[#ffe0a3]"><span className="flex items-center gap-2"><MessageSquarePlus size={17} /> New chat</span><span className="font-mono text-[10px] opacity-60">⌘ K</span></Button>
          <div className="mb-3 flex items-center justify-between px-2"><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#728079]">Workspace</span><button className="text-[#728079] transition hover:text-white"><MoreHorizontal size={15} /></button></div>
          <nav className="space-y-1">
            {[
              { icon: Compass, label: "Explore", active: true },
              { icon: Code2, label: "Build", active: false },
              { icon: BookOpen, label: "Knowledge", active: false },
              { icon: Settings2, label: "Settings", active: false },
          ].map(({ icon: Icon, label, active }) => <button key={label} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active ? "bg-white/[0.08] text-[#f4f0e8]" : "text-[#8e9a95] hover:bg-white/[0.05] hover:text-[#f4f0e8]"}`}><Icon size={16} className={active ? "text-[#ffc857]" : "text-[#718078]"} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ffc857]" />}</button>)}
          </nav>
          <div className="my-6 h-px bg-white/[0.08]" />
          <div className="mb-3 flex items-center justify-between px-2"><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#728079]">Conversation history</span><button className="text-[#728079] transition hover:text-white" onClick={newChat} aria-label="New chat"><Plus size={15} /></button></div>
          <div className="history-search-wrap"><Search size={13} /><input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search chats" aria-label="Search conversation history" /></div>
          <div className="mt-2 space-y-1">
            {filteredConversations.slice(0, 8).map(conversation => <button key={conversation.id} onClick={() => setOpenConversationId(conversation.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition hover:bg-white/[0.05] hover:text-white ${openConversationId === conversation.id ? "bg-white/[0.08] text-[#f4f0e8]" : "text-[#9da9a4]"}`}><MessageSquarePlus size={14} className="shrink-0 text-[#68756f]" /><span className="truncate">{conversation.title}</span></button>)}
            {isAuthenticated && !filteredConversations.length && <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs leading-relaxed text-[#68756f]">{historySearch ? "No matching chats." : "Your signed-in conversations will appear here as you use Cranium."}</div>}
            {!isAuthenticated && <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs leading-relaxed text-[#68756f]">Sign in to save and search conversation history.</div>}
          </div>
          <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-[#ffc857]/15 bg-[#ffc857]/[0.06] p-4"><div className="mb-3 flex items-center gap-2 text-[#ffc857]"><Cpu size={16} /><span className="font-mono text-[10px] uppercase tracking-[0.18em]">Cranium layer</span></div><p className="text-xs leading-relaxed text-[#9eaca4]">Live research, GitHub grounding, memory, and governed intelligence for WorthWyl products.</p><button className="mt-3 text-xs font-medium text-[#ffe7b5] hover:underline">View foundation →</button></div>
        </aside>
        {mobileNavOpen && <button className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

        <main className="relative flex min-w-0 flex-1 flex-col bg-[#15191e]">
          <div className="flex h-[66px] items-center justify-between border-b border-white/[0.08] px-5 md:px-8"><div><div className="flex items-center gap-2"><h1 className="font-display text-[18px] tracking-[-0.03em] text-[#f2ede4]">Cranium AI</h1><span className="h-1.5 w-1.5 rounded-full bg-[#ffc857] shadow-[0_0_12px_#ffc857]" /></div><div className="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[#718078]"><span>{statusLabel}</span><span className="text-white/20">/</span><span>{currentMode} mode</span></div></div><div className="flex items-center gap-2"><button className="icon-button" onClick={() => setShowLayer(value => !value)} aria-label="Toggle Cranium layer"><PanelRight size={17} /></button><button className="icon-button" aria-label="Help"><CircleHelp size={17} /></button></div></div>
          <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-8 md:px-8">
            <div className="mx-auto max-w-[780px]">
              <div className="mb-9 flex items-center gap-4"><div className="hero-orbit"><img src="/manus-storage/Picsart_26-08-02_01-54-52-277_2be9d44f.webp" alt="Cranium flame-brain mark" /></div><div><div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8d9a95]">WorthWyl intelligence workspace</div><div className="mt-1 text-sm text-[#c7cec9]">One place to think, make, and move forward.</div></div></div>
              <div className="space-y-7">
                {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`message-row flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}><div className={`flex max-w-[92%] gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}><div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${message.role === "assistant" ? "bg-[#ffc857] text-[#17231d]" : "bg-white/10 text-[#c9d0cb]"}`}>{message.role === "assistant" ? <Sparkles size={14} /> : <UserRound size={14} />}</div><div className={message.role === "user" ? "user-bubble" : "assistant-bubble"}>{message.role === "assistant" ? <ProgressiveResponse content={message.content} /> : <p className="whitespace-pre-wrap text-[14px] leading-7">{message.content}</p>}{message.error && message.retryText ? <button type="button" className="retry-button" onClick={() => void sendMessage(message.retryText ?? "")} disabled={isSending}><Zap size={12} /> Retry response</button> : null}{message.role === "assistant" && (message.sources?.length || message.knowledge?.length) ? <div className="source-tray"><div className="source-tray-label"><Search size={11} /> {(message.sources?.length ?? 0) + (message.knowledge?.length ?? 0)} live source{(message.sources?.length ?? 0) + (message.knowledge?.length ?? 0) === 1 ? "" : "s"}</div><div className="flex flex-wrap gap-1.5">{message.sources?.map(source => <a key={`${source.repo}-${source.file}`} href={source.url} target="_blank" rel="noreferrer" className="source-chip"><span className={`authority-dot ${source.authority}`} />{source.repo}/{source.file}</a>)}{message.knowledge?.map(source => <a key={`${source.domain}-${source.title}`} href={source.url} target="_blank" rel="noreferrer" className="source-chip"><span className={`authority-dot ${source.kind === "news" ? "news" : "supporting"}`} />{source.domain} · {source.title}</a>)}</div></div> : null}{message.role === "assistant" && <button type="button" className={`voice-button ${speakingIndex === index ? "voice-button-active" : ""}`} onClick={() => speakMessage(message.content, index)} aria-label={speakingIndex === index ? "Stop reading response" : "Read response aloud"} title={speakingIndex === index ? "Stop reading" : "Read response aloud"}><Volume2 size={12} /><span>Read aloud</span></button>}{message.role === "assistant" && message.model && <div className="mt-4 flex items-center gap-2 border-t border-white/[0.08] pt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[#728079]"><Zap size={11} className="text-[#ffc857]" /> {message.model} <span className="text-white/20">·</span> {message.research ? "Live research response" : message.grounded ? "Grounded response" : "Cranium response"}</div>}</div></div></div>)}
                {isSending && <div className="flex gap-3"><div className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffc857] text-[#17231d]"><Sparkles size={14} /></div><div className="assistant-bubble flex items-center gap-1.5"><span className="typing-dot" /><span className="typing-dot delay-1" /><span className="typing-dot delay-2" /></div></div>}
              </div>
              {messages.length === 1 && !isSending && <div className="mt-9 grid gap-2 md:grid-cols-3">{starterPrompts.map((prompt, index) => <button key={prompt} onClick={() => void sendMessage(prompt)} className="group rounded-xl border border-white/10 bg-white/[0.025] p-3.5 text-left text-xs leading-relaxed text-[#9fa9a4] transition hover:-translate-y-0.5 hover:border-[#ffc857]/30 hover:bg-[#ffc857]/[0.06] hover:text-[#eef7f0]"><span className="mb-3 block font-mono text-[9px] text-[#ffc857]">0{index + 1}</span>{prompt}<ArrowUp size={14} className="mt-3 rotate-45 text-[#68756f] transition group-hover:text-[#ffc857]" /></button>)}</div>}
            </div>
          </div>
          <div className="composer-wrap px-4 pb-5 md:px-8"><form onSubmit={handleSubmit} className="mx-auto max-w-[780px]"><div className="composer relative rounded-2xl border border-white/10 bg-[#1c2228] p-3 shadow-2xl shadow-black/10"><Textarea ref={textareaRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(draft); } }} placeholder="Message Cranium AI..." className="min-h-[68px] resize-none border-0 bg-transparent px-2 py-1 text-[14px] leading-6 text-[#f4f0e8] shadow-none placeholder:text-[#6d7873] focus-visible:ring-0" disabled={isSending} /><div className="flex items-center justify-between px-1 pt-2"><div className="flex items-center gap-1"><button type="button" className={`composer-action ${voiceEnabled ? "composer-action-active" : ""}`} title="Toggle voice replies" onClick={() => setVoiceEnabled(value => !value)}><Volume2 size={15} /></button><button type="button" className={`composer-action ${showVoiceSettings ? "composer-action-active" : ""}`} title="Voice settings" onClick={() => setShowVoiceSettings(value => !value)}><Settings2 size={15} /></button><button type="button" className={`composer-action ${isListening ? "composer-action-active" : ""}`} title="Speak to Cranium" onClick={toggleListening}><Mic size={15} /></button><button type="button" className={`composer-action ${researchMode ? "composer-action-active" : ""}`} title="Toggle live research" onClick={() => setResearchMode(value => !value)}><Globe2 size={15} /></button><button type="button" className={`composer-action ${grounded ? "composer-action-active" : ""}`} title="Toggle GitHub grounding" onClick={() => setGrounded(value => !value)}><Search size={15} /></button><button type="button" className="composer-action hidden sm:flex" title="Attach file"><Plus size={15} /></button><button type="button" className="composer-action hidden sm:flex" title="Add context"><FileText size={14} /></button><span className="ml-2 hidden font-mono text-[9px] uppercase tracking-[0.12em] text-[#65716b] sm:inline">Shift + Enter for new line</span></div><div className="flex items-center gap-2"><div className="relative"><select aria-label="Select output contract" value={output} onChange={event => setOutput(event.target.value as CraniumOutput)} className="model-select"><option value="answer">Answer</option><option value="plan">Plan</option><option value="code">Code</option><option value="brief">Brief</option><option value="action_proposal">Proposal</option></select><ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#76837c]" /></div><div className="relative"><select aria-label="Select model" value={model} onChange={event => setModel(event.target.value)} className="model-select"><option value={selectedModel?.id}>{selectedModel?.label || "Auto"}</option>{models.filter(item => item.id !== selectedModel?.id).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#76837c]" /></div><button type="submit" disabled={!draft.trim() || isSending} className="send-button" aria-label="Send message"><ArrowUp size={17} /></button></div></div></div><div className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.17em] text-[#59655f]">{mode} · {output} · {researchMode ? "Live research on" : grounded ? "GitHub grounding on" : "Cranium can make mistakes · Check important information"}</div>{showVoiceSettings && <div className="voice-settings-panel"><div className="voice-settings-heading"><Volume2 size={13} /> Voice settings</div><label>Autoplay replies <input type="checkbox" checked={voiceEnabled} onChange={event => setVoiceEnabled(event.target.checked)} /></label><label>Speed <input type="range" min="0.7" max="1.3" step="0.05" value={voiceRate} onChange={event => setVoiceRate(Number(event.target.value))} /><span>{voiceRate.toFixed(2)}×</span></label><label>Pitch <input type="range" min="0.7" max="1.3" step="0.05" value={voicePitch} onChange={event => setVoicePitch(Number(event.target.value))} /><span>{voicePitch.toFixed(2)}</span></label></div>}</form></div>
        </main>

        {showLayer && <aside className="cranium-inspector hidden w-[274px] shrink-0 border-l border-white/10 bg-[#12161b] px-5 py-6 xl:block"><div className="mb-8 flex items-start justify-between"><div><div className="mb-2 flex items-center gap-2 text-[#ffc857]"><Cpu size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">Cranium layer</span></div><h2 className="font-display text-[22px] tracking-[-0.04em]">Make it yours.</h2></div><button className="text-[#718078] hover:text-white" onClick={() => setShowLayer(false)}><X size={15} /></button></div><div className="layer-card mb-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs text-[#dfe5df]">Intelligence routing</span><span className="status-pill"><span /> live</span></div><p className="text-xs leading-relaxed text-[#87948d]">Cranium combines live news, reference knowledge, Miracle Memory, governed tools, and model routing while preserving source provenance.</p><div className="mt-4 space-y-2">{models.slice(0, 3).map(item => <div key={item.id} className="flex items-center justify-between text-[11px]"><span className="text-[#9eaaa4]">{item.provider}</span><span className="font-mono text-[10px] text-[#68756f]">{item.note}</span></div>)}</div></div><div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#728079]">Modes</div><div className="space-y-2">{[
          { icon: Sparkles, label: "General", caption: "Conversation & ideas", value: "general" },
          { icon: Code2, label: "Builder", caption: "Code & product work", value: "builder" },
          { icon: BookOpen, label: "Research", caption: "Sources & synthesis", value: "research" },
          { icon: Wand2, label: "Creative", caption: "Concepts & direction", value: "creative" },
          { icon: Zap, label: "Operator", caption: "Bounded proposals", value: "operator" },
          { icon: FileText, label: "Memory", caption: "Governed continuity", value: "memory" },
        ].map(({ icon: Icon, label, caption, value }) => <button key={label} onClick={() => setMode(value as CraniumMode)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${mode === value ? "border-[#ffc857]/25 bg-[#ffc857]/[0.07]" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${mode === value ? "bg-[#ffc857] text-[#17231d]" : "bg-white/[0.07] text-[#a7b3ac]"}`}><Icon size={15} /></span><span><span className="block text-xs text-[#e1e6e1]">{label}</span><span className="mt-0.5 block text-[10px] text-[#728079]">{caption}</span></span></button>)}</div><div className="mt-8 rounded-xl border border-white/[0.07] p-3.5"><div className="mb-2 flex items-center gap-2 text-xs text-[#c8d0ca]"><Wand2 size={14} className="text-[#ffc857]" /> {capabilitiesQuery.data?.length ?? 8} governed capabilities</div><p className="text-[11px] leading-relaxed text-[#728079]">Every mode passes through Synapse, Miracle Memory policy, and Cranium Core authority before consequential output or action.</p></div></aside>}
      </div>
    </div>
  );
}
