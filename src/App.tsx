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
  Palette,
  RefreshCw,
  Sparkles,
  Terminal,
  Type, 
  Video,
  Volume2,
  Wand2,
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect } from "react";

// Types
interface ReelsContent {
  script: string;
  caption: string;
  hashtags: string[];
  coverText: string;
  planner: {
    mediaAdvice: string;
    subtitleStyle: {
      colors: string;
      fonts: string;
    };
    voiceProfile: string;
  };
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

export default function App() {
  const [newsText, setNewsText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState<ReelsContent | null>(null);
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [partImages, setPartImages] = useState<Record<number, string>>({});
  const [isGeneratingPartImage, setIsGeneratingPartImage] = useState<Record<number, boolean>>({});

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const handleGenerate = async () => {
    if (!newsText.trim()) return;
    setIsGenerating(true);
    setContent(null);
    setGeneratedImageUrl(null);
    setPartImages({});
    setApiError(null);

    try {
      const prompt = `
        Aşağıdaki Galatasaray spor haberini 30-40 saniyelik bir sosyal medya (Reels, TikTok, Shorts) videosu için metne ve planlama rehberine dönüştür.
        
        KURALLAR:
        1. Dil: Türkçe.
        2. Tarz: Çok yüksek enerjili, heyecanlı, "hype" yaratan, taraftarı gaza getiren bir üslup kullan.
        3. Yapı:
           - script: 30-40 saniye sürecek şekilde ayarla. Maksimum 400 karakter.
           - caption: Etkileyici bir açıklama.
           - hashtags: En az 10 adet popüler hashtag.
           - coverText: 2-3 kelimelik çarpıcı bir başlık.
           - planner: Videonun yapımı için şu detayları sağla:
             - mediaAdvice: Hangi tür fotoğraf veya videolar seçilmeli? (Örn: "Gol sevinçleri", "Tribün görüntüleri")
             - subtitleStyle: Altyazıların hangi RENK ve hangi FONT ile yazılması gerektiğini belirt.
             - voiceProfile: Seslendirmenin nasıl olması gerektiğini belirt (Kadın mı erkek mi, enerjik mi güçlü mü, tonu nasıl olmalı).
        
        GİRİS HABER METNİ:
        "${newsText}"

        JSON FORMATINDA CEVAP VER:
        {
          "script": "...",
          "caption": "...",
          "hashtags": ["..."],
          "coverText": "...",
          "planner": {
            "mediaAdvice": "...",
            "subtitleStyle": {
              "colors": "...",
              "fonts": "..."
            },
            "voiceProfile": "..."
          }
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

  const handleGenerateImage = async (prompt?: any, partIndex?: number) => {
    const isPart = partIndex !== undefined;
    
    // If prompt is an event object (e.g. from onClick={handleGenerateImage}), ignore it
    const actualPrompt = typeof prompt === 'string' ? prompt : (content?.coverText || "");
    if (!actualPrompt) return;

    if (isPart) {
      setIsGeneratingPartImage(prev => ({ ...prev, [partIndex]: true }));
    } else {
      setIsGeneratingImage(true);
    }
    
    setApiError(null);
    try {
      const result = await (ai as any).models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `Professional sports social media ${isPart ? 'scene background' : 'social media cover'} for Galatasaray. Cinematic lighting, dramatic atmosphere, stadium background. Subject: ${actualPrompt}. Colors: Red and Yellow. Photorealistic, 4k, dynamic composition, no text in the image.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "9:16",
          },
        },
      });

      const response = result.response || result;
      const parts = response.candidates?.[0]?.content?.parts || response.parts || [];
      
      let foundImage = false;
      for (const part of parts) {
        if (part.inlineData) {
          const url = `data:image/png;base64,${part.inlineData.data}`;
          if (isPart) {
            setPartImages(prev => ({ ...prev, [partIndex]: url }));
          } else {
            setGeneratedImageUrl(url);
          }
          foundImage = true;
          break;
        }
      }
      
      if (!foundImage) {
        throw new Error("Resim verisi alınamadı.");
      }
    } catch (error: any) {
      console.error("Image generation failed:", error);
      if (error?.message?.includes("429") || error?.status === 429) {
        setApiError("Görsel oluşturma kotası doldu. Biraz bekleyip tekrar deneyin.");
      } else {
        setApiError("Görsel oluşturulurken bir hata oluştu.");
      }
    } finally {
      if (isPart) {
        setIsGeneratingPartImage(prev => ({ ...prev, [partIndex]: false }));
      } else {
        setIsGeneratingImage(false);
      }
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
        <div className="max-w-6xl mx-auto flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl md:rounded-3xl gs-gradient flex items-center justify-center shadow-2xl shadow-[#A90432]/40 border border-white/10 shrink-0">
            <Wand2 className="w-8 h-8 md:w-10 md:h-10 text-white fill-current transform -rotate-12" />
          </div>
          <div className="flex flex-col">
            <span className="text-[#FDB912] font-bold text-[10px] tracking-[0.3em] uppercase mb-1">Cimbom Dijital İçerik Üretici</span>
            <h1 className="text-4xl md:text-5xl impact-text leading-none">GS REELS <span className="text-[#A90432]">STUDIO</span></h1>
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
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50 block">Kapak Başlığı Önerisi</label>
                {content && (
                  <button 
                    onClick={() => handleGenerateImage()}
                    disabled={isGeneratingImage}
                    className="flex items-center gap-2 px-3 py-1 bg-[#FDB912]/10 border border-[#FDB912]/20 rounded-lg group hover:bg-[#FDB912]/20 transition-all disabled:opacity-50"
                  >
                    <ImageIcon className={`w-3 h-3 text-[#FDB912] ${isGeneratingImage ? "animate-pulse" : ""}`} />
                    <span className="text-[9px] font-black uppercase text-[#FDB912]">Görsel Üret</span>
                  </button>
                )}
              </div>
              
              <AnimatePresence mode="wait">
                {content ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={content.coverText}
                    className="space-y-4"
                  >
                    <div className="text-2xl md:text-3xl impact-text text-[#FDB912] drop-shadow-2xl leading-none break-words">
                      {content.coverText}
                    </div>

                    {generatedImageUrl && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative group mt-4 aspect-[9/16] max-h-[300px] mx-auto overflow-hidden rounded-2xl border border-white/10"
                      >
                        <img 
                          src={generatedImageUrl} 
                          alt="AI Generated Cover" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = generatedImageUrl;
                              a.download = 'gs_reels_cover.png';
                              a.click();
                            }}
                            className="bg-white text-black p-3 rounded-full hover:scale-110 transition-transform"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {isGeneratingImage && (
                      <div className="aspect-[9/16] max-h-[300px] mx-auto rounded-2xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-3 bg-white/5">
                        <RefreshCw className="w-8 h-8 animate-spin text-[#FDB912]" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Görsel Oluşturuluyor...</span>
                      </div>
                    )}
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
                
                <div className="space-y-6 overflow-y-auto scroll-hide max-h-[600px] pr-2">
                  {content.script.split(". ").map((sentence, idx) => (
                    <div key={idx} className={`group border-l-4 pl-6 py-4 transition-all hover:bg-white/5 rounded-r-xl ${idx === 0 ? "border-[#FDB912]" : idx === content.script.split(". ").length - 1 ? "border-[#A90432]" : "border-white/10"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="text-[10px] font-black opacity-30 uppercase tracking-widest block mb-1">Parça {idx + 1}</span>
                          <p className="text-xl font-bold leading-tight uppercase tracking-tight text-white/90">
                            {sentence.trim()}{idx < content.script.split(". ").map((s) => s).length - 1 ? "." : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => handleGenerateImage(sentence, idx)}
                          disabled={isGeneratingPartImage[idx]}
                          className="shrink-0 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-[#FDB912]/10 hover:border-[#FDB912]/30 transition-all disabled:opacity-30"
                          title="Bu parça için görsel üret"
                        >
                          {isGeneratingPartImage[idx] ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-[#FDB912]" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-[#FDB912]" />
                          )}
                        </button>
                      </div>

                      {partImages[idx] && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-xl"
                        >
                          <img 
                            src={partImages[idx]} 
                            alt={`Sahne ${idx + 1}`}
                            className="w-full aspect-video object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = partImages[idx];
                                a.download = `gs_sahne_${idx + 1}.png`;
                                a.click();
                              }}
                              className="bg-white text-black p-3 rounded-full hover:scale-110 transition-transform"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reels Planner Section */}
              <div className="col-span-12 lg:col-span-5 space-y-6">
                <div className="glass-panel rounded-3xl p-8 space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Wand2 className="w-24 h-24" />
                  </div>
                  
                  <div className="flex flex-col gap-1 items-center md:items-start">
                    <label className="text-[10px] uppercase tracking-[0.3em] font-black text-[#FDB912]">Prodüksiyon Taslağı</label>
                    <h3 className="impact-text text-3xl">REELS PLANNER</h3>
                  </div>

                  <div className="space-y-6">
                    {/* Media Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[#A90432]">
                        <ImageIcon className="w-4 h-4" />
                        <h4 className="text-xs font-black uppercase tracking-wider">Video & Fotoğraf Seçimi</h4>
                      </div>
                      <p className="text-sm opacity-70 leading-relaxed pl-6 border-l border-white/10 italic">
                        {content.planner.mediaAdvice}
                      </p>
                    </div>

                    {/* Subtitle Style */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[#FDB912]">
                        <Palette className="w-4 h-4" />
                        <h4 className="text-xs font-black uppercase tracking-wider">Altyazı Stili (Renk & Font)</h4>
                      </div>
                      <div className="pl-6 border-l border-white/10 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FDB912] mt-1.5 shrink-0" />
                          <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                            Renk: <span className="text-white">{content.planner.subtitleStyle.colors}</span>
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#A90432] mt-1.5 shrink-0" />
                          <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                            Font: <span className="text-white">{content.planner.subtitleStyle.fonts}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Voiceover Style */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-blue-400">
                        <Terminal className="w-4 h-4" />
                        <h4 className="text-xs font-black uppercase tracking-wider">Seslendirme Karakteri</h4>
                      </div>
                      <p className="text-sm opacity-70 leading-relaxed pl-6 border-l border-white/10">
                        {content.planner.voiceProfile}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Caption & Hashtags */}
                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-3xl p-8 space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Post Açıklaması</label>
                      <button onClick={() => copyToClipboard(content.caption, 'cap')} className="opacity-40 hover:opacity-100 transition-opacity">
                        {copyStatus['cap'] ? <ClipboardCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="bg-white/[0.03] p-4 rounded-xl text-xs leading-relaxed font-mono opacity-80 border border-white/5">
                      {content.caption}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Hashtagler</label>
                      <button onClick={() => copyToClipboard(content.hashtags.join(" "), 'hash')} className="opacity-40 hover:opacity-100 transition-opacity">
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
              <Palette className="w-6 h-6 text-[#A90432]" />
              <h4 className="font-bold uppercase tracking-widest text-xs">Görsel Rehber</h4>
              <p className="text-[10px] opacity-50 uppercase tracking-tighter">İçeriğe en uygun font, renk ve video seçim önerileri ile profesyonel görünüm.</p>
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
