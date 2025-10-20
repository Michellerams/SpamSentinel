
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import WelcomeScreen from './components/WelcomeScreen';
import { analyzeEmail, generateSpeech, draftReply } from './services/geminiService';
import { AnalysisResult } from './types';
import { 
  LoadingSpinner, ShieldCheckIcon, ShieldExclamationIcon, LightBulbIcon, FlagIcon, TrashIcon, 
  UserCircleIcon, GlobeAltIcon, LinkIcon, PhotographIcon, SpeakerWaveIcon, StopCircleIcon, 
  SparklesIcon, ClipboardDocumentIcon, CheckIcon, MagnifyingGlassIcon
} from './components/IconComponents';

// Audio decoding utilities as per Gemini API guidelines for raw PCM audio
// Fix: Changed UintArray to Uint8Array to match the return type.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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
}


const App: React.FC = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [guideStep, setGuideStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailContent, setEmailContent] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isResultVisible, setIsResultVisible] = useState(false);
  const [image, setImage] = useState<{ file: File; base64: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftedReply, setDraftedReply] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (analysisResult && !isLoading) {
      const timer = setTimeout(() => setIsResultVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsResultVisible(false);
    }
  }, [analysisResult, isLoading]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        if (base64String) {
          setImage({ file, base64: base64String });
        }
      };
      reader.onerror = () => {
        setError("Failed to read the image file.");
      }
      // FIX: Corrected typo in FileReader method from readDataURL to readAsDataURL.
      reader.readAsDataURL(file);
    }
  };

  const handleStopAudio = () => {
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
        setIsPlaying(false);
    }
  };

  const handleAnalyze = async () => {
    if (!emailContent.trim() && !image) {
      setError("Please paste email content or upload an image to analyze.");
      return;
    }
    
    handleStopAudio();
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setIsResultVisible(false);
    setDraftedReply(null);

    try {
      const result = await analyzeEmail(
        emailContent, 
        image ? { base64: image.base64, mimeType: image.file.type } : undefined
      );
      setAnalysisResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setEmailContent('');
    setImage(null);
    setAnalysisResult(null);
    setError(null);
    setIsResultVisible(false);
    setDraftedReply(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    handleStopAudio();
  }

  const handleReadAloud = async () => {
      if (isPlaying) {
          handleStopAudio();
          return;
      }

      if (!analysisResult) return;
      
      if (!audioContextRef.current) {
          try {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          } catch (e) {
              setError("Audio playback is not supported by your browser.");
              return;
          }
      }

      setIsSynthesizing(true);
      setError(null);
      
      const textToSpeak = `
        Analysis complete. 
        Verdict: ${analysisResult.isSpam ? 'Likely Spam' : 'Likely Not Spam'}. 
        Confidence score is ${analysisResult.confidenceScore} percent.
        Here is the explanation: ${analysisResult.explanation}
      `;

      try {
          const base64Audio = await generateSpeech(textToSpeak);
          const audioBytes = decode(base64Audio);
          const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
          
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          source.start();
          setIsPlaying(true);
          
          source.onended = () => {
              setIsPlaying(false);
              audioSourceRef.current = null;
          };
          audioSourceRef.current = source;

      } catch (err) {
          setError(err instanceof Error ? err.message : "An unknown error occurred during audio generation.");
      } finally {
          setIsSynthesizing(false);
      }
  };

  const handleDraftReply = async () => {
    if (!emailContent.trim()) return;
    setIsDrafting(true);
    try {
      const reply = await draftReply(emailContent);
      setDraftedReply(reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft a reply.");
    } finally {
      setIsDrafting(false);
    }
  };
  
  const handleCopyReply = () => {
      if (draftedReply) {
          navigator.clipboard.writeText(draftedReply);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }
  };
  
  const handleDirectRecordAndDownload = async (dimension: '3D' | '4D') => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { mediaSource: "screen" } as any,
            audio: true,
        });

        const recordedChunks: Blob[] = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        const download = () => {
            if (recordedChunks.length === 0) return;
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${dimension.toLowerCase()}-recording-${new Date().toISOString()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        recorder.onstop = download;
        
        stream.getTracks().forEach(track => track.onended = () => {
            if (recorder.state === 'recording') {
                recorder.stop();
            }
        });

        recorder.start();

    } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
            setError("Screen recording permission was denied. To use this feature, please allow screen sharing when prompted.");
        } else {
            setError("Could not start screen recording. Please grant permissions and try again.");
        }
        console.error("Error starting direct recording:", err);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score > 75) return 'bg-green-500';
    if (score > 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (showWelcome) {
    return <WelcomeScreen onAnimationEnd={() => setShowWelcome(false)} />;
  }

  const guideSteps = [
    {
        title: "Step 1: Provide the Email Content",
        description: "Start by pasting the full text of the suspicious email into this text area. The more content you provide, the better the analysis."
    },
    {
        title: "Step 2: Upload an Image (Optional)",
        description: "If you have a screenshot of the email, you can upload it here. This is useful for emails with complex formatting or images."
    },
    {
        title: "Step 3: Begin the Analysis",
        description: "Once your content is ready, click this button. Our AI will scan it for threats, red flags, and signs of malicious intent."
    }
  ];

  const isSpam = analysisResult?.isSpam;
  const verdictBgColor = isSpam ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30';
  const verdictTextColor = isSpam ? 'text-red-200' : 'text-green-200';
  const verdictIcon = isSpam ? <ShieldExclamationIcon className="w-10 h-10" /> : <ShieldCheckIcon className="w-10 h-10" />;

  return (
    <div className="min-h-screen font-sans text-slate-200 flex flex-col">
      <Header onRecord={handleDirectRecordAndDownload} />
      <main className="flex-grow max-w-4xl mx-auto p-4 w-full">
        <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 shadow-2xl rounded-2xl p-4 sm:p-8 animate-fadeInUp">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-4">Email Content</h2>
          <p className="text-slate-400 mb-4 text-sm">Paste the full email content below, or upload a picture of the email.</p>

          <div className={`relative transition-all duration-300 ${guideStep === 1 ? 'guide-highlight' : ''}`}>
            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder="Paste email content here..."
              className="w-full h-48 p-4 bg-slate-800/50 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-slate-200 placeholder-slate-500"
              disabled={isLoading}
            />
            {emailContent && (
              <button 
                onClick={handleClear}
                className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-200"
                aria-label="Clear input"
              >
                <TrashIcon className="w-5 h-5"/>
              </button>
            )}
          </div>

          <div className="mt-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
            {!image ? (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800/60 disabled:opacity-50 transition-all duration-300 ${guideStep === 2 ? 'guide-highlight' : ''}`}
                >
                    <PhotographIcon className="w-5 h-5" />
                    Upload Image of Email
                </button>
            ) : (
                <div className={`relative border border-slate-600 rounded-lg p-2 transition-all duration-300 ${guideStep === 2 ? 'guide-highlight' : ''}`}>
                    <img 
                        src={`data:${image.file.type};base64,${image.base64}`} 
                        alt="Email preview" 
                        className="max-h-48 w-auto rounded-md mx-auto"
                    />
                    <button
                        onClick={() => {
                            setImage(null);
                            if(fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-1 right-1 bg-slate-900/50 rounded-full p-1 text-slate-200 hover:bg-slate-800"
                        aria-label="Remove image"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || (!emailContent.trim() && !image)}
              className={`w-full sm:w-auto px-8 py-3 font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400 transition-transform transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 mx-auto ${guideStep === 3 ? 'guide-highlight' : ''}`}
            >
              {isLoading ? <LoadingSpinner className="w-5 h-5" /> : null}
              {isLoading ? 'Analyzing...' : 'Analyze Email'}
            </button>
          </div>
        </div>
        
        {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg relative my-6" role="alert">
                <span className="block sm:inline">{error}</span>
                <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3"><span className="text-xl">×</span></button>
            </div>
        )}

        {isLoading && !analysisResult && (
           <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-2xl mt-6 text-center overflow-hidden relative">
             <div className="scan-line"></div>
             <LoadingSpinner className="w-12 h-12 mx-auto text-blue-500" />
             <p className="mt-4 text-lg font-semibold text-slate-200">AI is analyzing the email...</p>
             <p className="text-slate-400">This might take a moment.</p>
          </div>
        )}

        <div className={`mt-6 space-y-6 ${isResultVisible ? 'animate-flipIn' : 'opacity-0'}`}>
          {analysisResult && !isLoading && (
            <>
              <div className={`border-l-4 p-6 rounded-r-lg shadow-md flex items-center gap-6 ${verdictBgColor} ${verdictTextColor} bg-slate-900/40 backdrop-blur-sm`}>
                {verdictIcon}
                <div className="flex-grow">
                  <h3 className="text-2xl font-bold">
                    {isSpam ? 'Verdict: Likely Spam' : 'Verdict: Likely Not Spam'}
                  </h3>
                  <p className="mt-1 text-slate-400">Review the details below carefully before taking any action.</p>
                </div>
                <button 
                    onClick={handleReadAloud}
                    disabled={isSynthesizing}
                    className="p-2 rounded-full text-slate-300 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label={isPlaying ? "Stop reading" : "Read analysis aloud"}
                >
                    {isSynthesizing ? <LoadingSpinner className="w-6 h-6" /> : (isPlaying ? <StopCircleIcon className="w-6 h-6" /> : <SpeakerWaveIcon className="w-6 h-6" />)}
                </button>
              </div>

              <div className="group">
                <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-2xl card-3d-effect">
                  <h3 className="text-lg font-bold text-slate-200 mb-3">Confidence Score</h3>
                  <div className="w-full bg-slate-700 rounded-full h-6">
                      <div 
                        className={`h-6 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all duration-500 ${getConfidenceColor(analysisResult.confidenceScore)}`}
                        style={{ width: `${analysisResult.confidenceScore}%` }}
                      >
                      {analysisResult.confidenceScore}%
                      </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                  <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-2xl card-3d-effect h-full">
                    <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <LightBulbIcon className="w-6 h-6 text-yellow-400" />
                      Explanation
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{analysisResult.explanation}</p>
                  </div>
                </div>
                <div className="group">
                  <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-2xl card-3d-effect h-full">
                    <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <FlagIcon className="w-6 h-6 text-red-400" />
                      Identified Red Flags
                    </h3>
                    {analysisResult.redFlags.length > 0 ? (
                      <ul className="space-y-2 text-sm text-slate-300 list-disc list-inside">
                        {analysisResult.redFlags.map((flag, index) => <li key={index}>{flag}</li>)}
                      </ul>
                    ) : (
                      <p className="text-slate-400 text-sm">No specific red flags were identified.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-2xl card-3d-effect h-full">
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                            <UserCircleIcon className="w-6 h-6 text-cyan-400" />
                            Sender Reputation
                        </h3>
                        <p className="text-slate-300 text-sm leading-relaxed">{analysisResult.senderReputation}</p>
                    </div>
                </div>
                <div className="group">
                    <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-2xl card-3d-effect h-full">
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                            <GlobeAltIcon className="w-6 h-6 text-emerald-400" />
                            Domain Insights
                        </h3>
                        <p className="text-slate-300 text-sm leading-relaxed">{analysisResult.domainAnalysis}</p>
                    </div>
                </div>
              </div>

              {analysisResult.linkAnalysis.length > 0 && (
                <div className="group">
                    <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-2xl card-3d-effect">
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                            <LinkIcon className="w-6 h-6 text-purple-400" />
                            Link Summary
                        </h3>
                        <div className="space-y-4">
                            {analysisResult.linkAnalysis.map((link, index) => (
                                <div key={index} className="border-l-2 border-slate-600 pl-4">
                                    <p className="text-sm font-semibold text-slate-300 break-all">{link.url}</p>
                                    <p className="text-sm text-slate-400 mt-1">{link.summary}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              )}
              
              {!analysisResult.isSpam && (
                <div className="group">
                  <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-2xl card-3d-effect">
                    <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <SparklesIcon className="w-6 h-6 text-yellow-300" />
                      AI Assistant
                    </h3>
                    
                    {!draftedReply && !isDrafting &&(
                      <button
                        onClick={handleDraftReply}
                        disabled={isDrafting}
                        className="w-full sm:w-auto px-6 py-2.5 font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-600 transition-transform transform hover:scale-105 shadow-md flex items-center justify-center gap-2"
                      >
                        Draft a Reply
                      </button>
                    )}
                    
                    {isDrafting && !draftedReply && (
                       <div className="flex items-center justify-center gap-2 text-slate-300">
                         <LoadingSpinner className="w-5 h-5" />
                         <span>Drafting Reply...</span>
                       </div>
                    )}

                    {draftedReply && (
                      <div className={`space-y-4 ${isDrafting ? 'opacity-50' : ''}`}>
                        <h4 className="font-semibold text-slate-300">Suggested Reply:</h4>
                        <textarea
                          value={draftedReply}
                          onChange={(e) => setDraftedReply(e.target.value)}
                          className="w-full h-40 p-3 bg-slate-800/50 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-200 placeholder-slate-500"
                          aria-label="Suggested reply text area"
                        />
                        <div className="flex flex-wrap items-center gap-4">
                          <button
                            onClick={handleCopyReply}
                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
                          >
                            {isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                            {isCopied ? 'Copied!' : 'Copy to Clipboard'}
                          </button>
                           <button
                            onClick={handleDraftReply}
                            disabled={isDrafting}
                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
                          >
                            {isDrafting ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                            Regenerate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {guideStep > 0 && guideStep <= guideSteps.length && (
        <>
            <div className="guide-overlay" onClick={() => setGuideStep(0)}></div>
            <div className="guide-box animate-fadeInUp">
                <h3 className="text-lg font-bold text-white mb-2">{guideSteps[guideStep - 1].title}</h3>
                <p className="text-sm text-slate-400 mb-4">{guideSteps[guideStep - 1].description}</p>
                <div className="flex justify-between items-center">
                    <button onClick={() => setGuideStep(0)} className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1">Skip</button>
                    <span className="text-sm text-slate-500">{guideStep} / {guideSteps.length}</span>
                    <button onClick={() => {
                        if (guideStep < guideSteps.length) {
                            setGuideStep(guideStep + 1);
                        } else {
                            setGuideStep(0); // Finish
                        }
                    }} className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                        {guideStep < guideSteps.length ? 'Next' : 'Finish'}
                    </button>
                </div>
            </div>
        </>
      )}

      <footer className="text-center text-slate-400/80 py-6 text-sm">
        <p>Spam Sentinel AI &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default App;