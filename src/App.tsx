/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { 
  ClipboardCheck, 
  Copy, 
  Download, 
  FileText, 
  Hash, 
  Info, 
  Mic2, 
  Music, 
  Newspaper, 
  Play, 
  RefreshCw, 
  Share2, 
  Sparkles, 
  Type, 
  Video,
  Volume2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect } from "react";

// Types
interface ReelsContent {
  script: string;
  caption: string;
  hashtags: string[];
  coverText: string;
}

function extractJson(text: string) {
  // Clean up the text - remove potential backticks or conversational text
  let cleaned = text.trim();
  
  // Try to find a JSON code block first
  const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch && markdownMatch[1]) {
    cleaned = markdownMatch[1].trim();
  }

  try {
    // Try finding the first { and last } to strip potential prefix/suffix strings
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      const jsonStr = cleaned.substring(start, end + 1).trim();
      return JSON.parse(jsonStr);
    }
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parse error:", e, "Raw text:", text);
    return null;
  }
}

const VOICES = [
  { id: 'Kore', name: 'Kore', description: 'Net ve profesyonel', sample: 'Sarı kırmızı şampiyon Cimbom!' },
  { id: 'Puck', name: 'Puck', description: 'Genç ve enerjik', sample: 'Hedef yirmibeş, konsantrasyon!' },
  { id: 'Charon', name: 'Charon', description: 'Derin ve ciddi', sample: 'Galatasaray bir histir.' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Sert ve güçlü', sample: 'Florya rüzgarı esiyor!' },
];

export default function App() {
  const [newsText, setNewsText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState<ReelsContent | null>(null);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const handleGenerate = async () => {
    if (!newsText.trim()) return;
    setIsGenerating(true);
    setContent(null);
    setAudioUrl(null);
    setApiError(null);

    try {
      const prompt = `
        Aşağıdaki Galatasaray spor haberini 30-40 saniyelik bir sosyal medya (Reels, TikTok, Shorts) videosu için metne dönüştür.
        
        KURALLAR:
        1. Dil: Türkçe.
        2. Tarz: Çok yüksek enerjili, heyecanlı, "hype" yaratan, taraftarı gaza getiren bir üslup kullan.
        3. Trendler: Güncel sosyal medya trendlerindeki çarpıcı giriş cümlelerini (Hook) kullan. (Örn: "Duyanlar duymayanlara anlatsın!", "Florya'da neler oluyor?", "İşte beklenen o haber!")
        4. Yapı:
           - Script: 30-40 saniye sürecek şekilde ayarla. Maksimum 400 karakter. Saniyeleri parantez içinde belirtme, sadece okunacak metni ver.
           - Caption: Paylaşım için etkileyici, merak uyandıran bir açıklama.
           - Hashtags: En az 10 adet popüler ve Galatasaray odaklı hashtag.
           - CoverText: Video kapağına yazılacak en fazla 2-3 kelimelik, devasa puntoluymuş gibi duran, "clickbait" tadında çarpıcı bir başlık.
        
        GİRİS HABER METNİ:
        "${newsText}"

        JSON FORMATINDA CEVAP VER:
        {
          "script": "...",
          "caption": "...",
          "hashtags": ["#gs", "..."],
          "coverText": "..."
        }
      `;

      const result = await (ai as any).models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        },
      });

      // Robust text extraction from various result shapes
      let text = "";
      if (typeof result.text === 'function') {
        text = await result.text();
      } else if (result.response?.text) {
        text = typeof result.response.text === 'function' ? await result.response.text() : result.response.text;
      } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = result.candidates[0].content.parts[0].text;
      } else {
        text = result.text || "";
      }

      const contentData = extractJson(text);
      if (contentData) {
        setContent(contentData);
      } else {
        throw new Error("Could not parse AI response: " + text);
      }
    } catch (error: any) {
      console.error("Content generation failed:", error);
      if (error?.message?.includes("429") || error?.status === 429 || error?.toString().includes("quota")) {
        setApiError("Yapay zeka şu an çok yoğun veya kota sınırına ulaşıldı. Lütfen 30 saniye sonra tekrar deneyin.");
      } else {
        setApiError("İçerik üretilirken bir hata oluştu. Lütfen haber metnini kontrol edin.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    const voice = VOICES.find(v => v.id === voiceId);
    if (!voice) return;
    setIsPreviewing(voiceId);
    setApiError(null);

    try {
      const result = await (ai as any).models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ parts: [{ text: voice.sample }] }],
        generationConfig: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceId },
            },
          },
        },
      });

      // Extract part safely
      const response = result.response || result;
      const part = (response.candidates?.[0]?.content?.parts || response.parts)?.[0];
      const base64Audio = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (base64Audio) {
        const audio = new Audio(`data:${mimeType};base64,${base64Audio}`);
        await audio.play();
      }
    } catch (error: any) {
      console.error("Preview failed:", error);
      if (error?.message?.includes("429") || error?.status === 429 || error?.toString().includes("quota")) {
        setApiError("Seslendirme kotası doldu veya model şu an meşgul. Kısa bir süre bekleyip tekrar deneyin.");
      }
    } finally {
      setIsPreviewing(null);
    }
  };

  const handleGenerateAudio = async () => {
    if (!content?.script) return;
    setIsGeneratingAudio(true);
    setApiError(null);

    try {
      const result = await (ai as any).models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ parts: [{ text: `Pay attention to punctuation. Say with extreme excitement, energy, and sports broadcaster hype for social media: ${content.script}` }] }],
        generationConfig: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const response = result.response || result;
      const part = (response.candidates?.[0]?.content?.parts || response.parts)?.[0];
      const base64Audio = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (base64Audio) {
        setAudioUrl(`data:${mimeType};base64,${base64Audio}`);
      }
    } catch (error: any) {
      console.error("Audio generation failed:", error);
      if (error?.message?.includes("429") || error?.status === 429 || error?.toString().includes("quota")) {
        setApiError("Seslendirme servisi şu an yoğun. Lütfen 1-2 dakika bekleyip tekrar 'Oluştur'a basın.");
      }
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus({ ...copyStatus, [key]: true });
    setTimeout(() => {
      setCopyStatus({ ...copyStatus, [key]: false });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#FDB912] selection:text-black">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#A90432] opacity-20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[0%] -right-[10%] w-[30%] h-[40%] bg-[#FDB912] opacity-10 blur-[100px] rounded-full" />
      </div>

      <header className="relative z-10 p-6 border-b border-white/10 backdrop-blur-md bg-black/40 sticky top-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[#FDB912] font-bold text-[10px] tracking-[0.3em] uppercase mb-1">Cimbom Dijital İçerik Üretici</span>
            <h1 className="text-5xl impact-text">GS REELS <span className="text-[#A90432]">STUDIO</span></h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto p-6 space-y-6 pb-24">
        {/* Error Display */}
        <AnimatePresence>
          {apiError && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#A90432]/20 border border-[#A90432]/40 p-4 rounded-2xl flex items-center gap-3">
                <Info className="w-5 h-5 text-[#A90432] shrink-0" />
                <p className="text-sm font-bold text-[#f87171] leading-tight">
                  {apiError}
                </p>
                <button 
                  onClick={() => setApiError(null)}
                  className="ml-auto text-[10px] uppercase font-black opacity-40 hover:opacity-100"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Section */}
        <section className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 glass-panel rounded-3xl p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-2 text-[#FDB912] mb-1">
              <Newspaper className="w-4 h-4" />
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Haber Kaynağı / Gazete Metni</label>
            </div>
            <textarea
              value={newsText}
              onChange={(e) => setNewsText(e.target.value)}
              placeholder="Florya'dan haberi buraya yapıştır..."
              className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl p-6 text-lg focus:outline-none focus:border-[#FDB912] transition-colors resize-none placeholder:opacity-20 font-medium leading-relaxed"
            />
            <div className="flex justify-end pt-2">
              <motion.button
                disabled={isGenerating || !newsText.trim()}
                onClick={handleGenerate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-3 px-10 py-5 rounded-2xl impact-text text-xl transition-all ${
                  isGenerating || !newsText.trim() 
                    ? "bg-white/10 text-white/30 cursor-not-allowed" 
                    : "gs-gradient text-white shadow-2xl shadow-[#A90432]/30"
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Metni Dönüştür
                  </>
                )}
              </motion.button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 glass-panel rounded-3xl p-8 flex flex-col justify-center gap-6 relative overflow-hidden min-h-[300px]">
            <div className="absolute -right-8 -bottom-8 opacity-5">
              <Video className="w-64 h-64" />
            </div>
            <div className="relative z-10 space-y-4">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50 block">Kapak Başlığı Önerisi</label>
              <AnimatePresence mode="wait">
                {content ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={content.coverText}
                    className="text-2xl md:text-3xl impact-text text-[#FDB912] drop-shadow-2xl leading-none break-words"
                  >
                    {content.coverText}
                  </motion.div>
                ) : (
                  <div className="text-2xl impact-text opacity-20">Analiz Bekleniyor...</div>
                )}
              </AnimatePresence>
              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] opacity-60 uppercase font-bold tracking-widest text-[#FDB912]">Tasarım İpucu:</p>
                <p className="text-[10px] opacity-40 uppercase font-medium mt-1">Parlak sarı zemin üzerine kırmızı kalın font (impact) kullanmayı unutma.</p>
              </div>
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {content && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-12 gap-6"
            >
              {/* Output Cards */}
              
              {/* Script Section */}
              <div className="col-span-12 lg:col-span-7 bg-white/[0.01] backdrop-blur-[2px] border border-white/5 rounded-3xl p-8 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Trend Reels Senaryosu</label>
                    <span className="text-[#A90432] text-[10px] font-black uppercase mt-1 tracking-widest">Yüksek Etkileşim Potansiyeli</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(content.script, 'script')}
                    className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    {copyStatus['script'] ? <ClipboardCheck className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 opacity-50" />}
                  </button>
                </div>
                
                <div className="space-y-6 overflow-y-auto scroll-hide max-h-[400px] pr-2">
                  {content.script.split(". ").map((sentence, idx) => (
                    <div key={idx} className={`border-l-4 pl-6 py-2 transition-all hover:bg-white/5 rounded-r-xl ${idx === 0 ? "border-[#FDB912]" : idx === content.script.split(". ").length - 1 ? "border-[#A90432]" : "border-white/10"}`}>
                      <span className="text-[10px] font-black opacity-30 uppercase tracking-widest block mb-1">Parça {idx + 1}</span>
                      <p className="text-xl font-bold leading-tight uppercase tracking-tight text-white/90">
                        {sentence.trim()}{idx < content.script.split(". ").map((s) => s).length - 1 ? "." : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata Section */}
              <div className="col-span-12 lg:col-span-5 space-y-6">
                {/* TTS Section */}
                <div className="glass-panel rounded-3xl p-6 space-y-6">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50 block text-center">AI Seslendirme (TTS)</label>
                    <h3 className="impact-text text-center text-xl text-[#FDB912]">Karakter Seçimi</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {VOICES.map((v) => (
                      <div
                        key={v.id}
                        className={`group px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                          selectedVoice === v.id 
                            ? "bg-white/10 border-[#FDB912]" 
                            : "bg-white/5 border-transparent"
                        }`}
                      >
                        <button 
                          onClick={() => setSelectedVoice(v.id)}
                          className="flex-1 text-left"
                        >
                          <span className={`text-xs font-black uppercase tracking-widest ${selectedVoice === v.id ? "text-[#FDB912]" : "text-white/40"}`}>
                            {v.name}
                          </span>
                          <p className="text-[9px] opacity-30 uppercase">{v.description}</p>
                        </button>
                        
                        <button
                          disabled={isPreviewing === v.id}
                          onClick={() => handlePreviewVoice(v.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                        >
                          {isPreviewing === v.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-[#FDB912]" />
                          ) : (
                            <Volume2 className="w-3 h-3 text-[#FDB912]" />
                          )}
                          <span className="text-[10px] font-bold uppercase text-white/60">Dinle</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    {!audioUrl ? (
                      <motion.button
                        disabled={isGeneratingAudio}
                        onClick={handleGenerateAudio}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-4 bg-white text-black rounded-2xl impact-text text-xl flex items-center justify-center gap-3 hover:bg-[#FDB912] transition-colors"
                      >
                        {isGeneratingAudio ? (
                          <RefreshCw className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-5 h-5 fill-current" />
                            Oluştur
                          </>
                        )}
                      </motion.button>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#A90432] flex items-center justify-center">
                              <Music className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase opacity-60">reels_final.mp3</span>
                              <audio src={audioUrl} autoPlay className="h-0 w-0" />
                              <audio controls src={audioUrl} className="h-8 w-40 accent-[#FDB912]" />
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = audioUrl;
                              a.download = 'gs_reels_audio.wav';
                              a.click();
                            }}
                            className="p-2 hover:bg-white/10 rounded-full text-green-400"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        </div>
                        <button onClick={() => setAudioUrl(null)} className="w-full text-[10px] uppercase font-black tracking-widest opacity-30 hover:opacity-100 transition-opacity">Yeniden Yap</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Caption & Hashtags */}
                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-3xl p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Post Açıklaması</label>
                      <button onClick={() => copyToClipboard(content.caption, 'cap')} className="opacity-40 hover:opacity-100">
                        {copyStatus['cap'] ? <ClipboardCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="bg-white/[0.03] p-4 rounded-xl text-xs leading-relaxed font-mono opacity-70 border border-white/5">
                      {content.caption}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Hashtags</label>
                      <button onClick={() => copyToClipboard(content.hashtags.join(" "), 'hash')} className="opacity-40 hover:opacity-100">
                        {copyStatus['hash'] ? <ClipboardCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {content.hashtags.map((tag, i) => (
                        <span key={i} className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-white/5 rounded border border-white/5 text-[#FDB912]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        {!content && !isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid md:grid-cols-3 gap-6 pt-12"
          >
            <div className="p-6 glass-panel rounded-2xl space-y-2">
              <Video className="w-6 h-6 text-[#FDB912]" />
              <h4 className="font-bold uppercase tracking-widest text-xs">Hızlı Dönüşüm</h4>
              <p className="text-[10px] opacity-50 uppercase tracking-tighter">Gazete haberini saniyeler içinde viral olmaya aday bir Reels metnine çevirir.</p>
            </div>
            <div className="p-6 glass-panel rounded-2xl space-y-2">
              <Music className="w-6 h-6 text-[#A90432]" />
              <h4 className="font-bold uppercase tracking-widest text-xs">Gerçekçi Ses</h4>
              <p className="text-[10px] opacity-50 uppercase tracking-tighter">Google destekli yapay zeka sesleri ile profesyonel bir seslendirme elde et.</p>
            </div>
            <div className="p-6 glass-panel rounded-2xl space-y-2">
              <Hash className="w-6 h-6 text-blue-400" />
              <h4 className="font-bold uppercase tracking-widest text-xs">Hashtags</h4>
              <p className="text-[10px] opacity-50 uppercase tracking-tighter">Başlık, caption ve hashtag'ler dahil, içeriğin paylaşılmaya hazır halde sunulur.</p>
            </div>
          </motion.div>
        )}
      </main>
      <footer className="pt-12 text-center pb-12">
        <p className="text-[10px] opacity-20 uppercase tracking-[0.5em] font-black">
          Galatasaray Digital Content Studio &copy; 2026 - Design for Victory
        </p>
      </footer>
    </div>
  );
}
