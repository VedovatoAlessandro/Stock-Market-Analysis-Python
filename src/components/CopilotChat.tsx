import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, MessageSquare, ShieldAlert } from "lucide-react";
import Markdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CopilotChatProps {
  context: any;
}

const PRESETS = [
  "Explain the Sharpe Ratio and what it says about my portfolio.",
  "How can I adjust weights to reduce overall annualized volatility?",
  "What is the mathematical formulation of Maximum Drawdown?",
  "Explain the structure of the data_loader.py file in the repository.",
];

export default function CopilotChat({ context }: CopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your AI Quantitative Finance Copilot. Ask me anything about stock market analysis, statistical metrics (CAGR, Volatility, Sharpe, Drawdown), portfolio optimization, or the Python codebase we've structured. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ **Error**: ${data.error || "Failed to contact Gemini server. Is GEMINI_API_KEY configured?"}`,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ **Error**: Unable to establish network contact with the AI server.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-white border border-slate-200 rounded-xl overflow-hidden h-[650px] shadow-sm">
      {/* Sidebar: presets & info */}
      <div className="lg:col-span-1 bg-slate-50 p-4 border-r border-slate-200 flex flex-col h-full overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 text-indigo-600 font-semibold text-sm">
          <Sparkles size={16} />
          <span>Interactive Copilot</span>
        </div>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          The AI is pre-loaded with the current stock prices, date ranges, and custom portfolio weight allocations from your active simulation session.
        </p>

        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Suggested Prompts</h4>
        <div className="space-y-2.5 flex-1">
          {PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => handleSend(preset)}
              disabled={loading}
              className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-xs text-slate-700 hover:text-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed leading-snug shadow-2xs cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 flex items-start gap-2 text-slate-400 text-[10px] leading-snug">
          <ShieldAlert size={14} className="text-indigo-500 shrink-0 mt-0.5" />
          <span>Requires GEMINI_API_KEY configured in the secrets panel to execute queries.</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="lg:col-span-3 flex flex-col bg-slate-50 h-full overflow-hidden">
        {/* Chat log */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
          {messages.map((m, i) => {
            const isAI = m.role === "assistant";
            return (
              <div key={i} className={`flex gap-3 max-w-3xl ${isAI ? "" : "ml-auto flex-row-reverse"}`}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isAI
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {isAI ? "AI" : "U"}
                </div>
                <div
                  className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    isAI
                      ? "bg-indigo-50/30 border border-indigo-100/50 text-slate-800"
                      : "bg-slate-50 border border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="prose prose-slate max-w-none text-xs leading-relaxed text-slate-800">
                    <Markdown>{m.content}</Markdown>
                  </div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center animate-pulse font-bold text-xs">
                AI
              </div>
              <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-xl px-4 py-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Form Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your quantitative or architectural question..."
            disabled={loading}
            className="flex-1 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-lg px-4 py-2.5 text-xs text-slate-800 focus:outline-none transition-all font-mono shadow-xs"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
