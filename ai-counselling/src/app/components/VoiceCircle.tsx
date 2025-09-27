import React, { useState, useEffect, useRef, useCallback } from 'react';

interface AudioFrame {
  data: Blob;
  timestamp: number;
  frameNumber: number;
}

interface VoiceCircleProps {
  onClose?: () => void;
  backendUrl?: string;
  size?: number;
}

const VoiceCircle: React.FC<VoiceCircleProps> = ({ 
  onClose, 
  backendUrl = 'https://your-backend.com/api/audio',
  size = 200 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const frameCounterRef = useRef(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Function to send audio frame to backend
  const sendAudioFrameToBackend = async (frame: AudioFrame) => {
    try {
      const formData = new FormData();
      formData.append('audio', frame.data, `audio_frame_${frame.frameNumber}.webm`);
      formData.append('timestamp', frame.timestamp.toString());
      formData.append('frameNumber', frame.frameNumber.toString());

      const response = await fetch(backendUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error('Failed to send audio frame:', response.status);
      } else {
        console.log(`Frame ${frame.frameNumber} sent successfully`);
      }
    } catch (error) {
      console.error('Error sending audio frame:', error);
    }
  };

  // Function to process and chunk audio into 3-second frames
  const startAudioChunking = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    // Clear any existing interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    // Start recording chunks every 3 seconds
    recordingIntervalRef.current = setInterval(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        // Stop and immediately restart to get the chunk
        mediaRecorderRef.current.stop();
        
        // Process the accumulated chunks
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const frame: AudioFrame = {
            data: audioBlob,
            timestamp: Date.now(),
            frameNumber: frameCounterRef.current++
          };
          
          // Send to backend
          sendAudioFrameToBackend(frame);
          
          // Clear chunks for next frame
          audioChunksRef.current = [];
        }
        
        // Restart recording for next chunk
        if (streamRef.current && streamRef.current.active) {
          mediaRecorderRef.current.start();
        }
      }
    }, 3000); // 3 second intervals
  }, [backendUrl,sendAudioFrameToBackend]);

  // Initialize audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('Recording started');
        audioChunksRef.current = [];
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      setIsRecording(true);
      startAudioChunking();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Send final chunk if any
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const frame: AudioFrame = {
          data: audioBlob,
          timestamp: Date.now(),
          frameNumber: frameCounterRef.current++
        };
        sendAudioFrameToBackend(frame);
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    frameCounterRef.current = 0;
    audioChunksRef.current = [];
  };

  // Toggle main circle action
  const handleCircleClick = () => {
    if (!isListening && !isSpeaking) {
      // Start listening
      setIsListening(true);
      if (!isMuted) {
        startRecording();
      }
    } else if (isListening) {
      // Switch to speaking
      setIsListening(false);
      setIsSpeaking(true);
      stopRecording();
      // Simulate speaking for demo - in real app, play audio response here
      setTimeout(() => {
        setIsSpeaking(false);
      }, 3000);
    } else if (isSpeaking) {
      // Stop everything
      setIsSpeaking(false);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted; // Toggle track
      });
    }
  };

  // Handle close
  const handleClose = () => {
    stopRecording();
    setIsListening(false);
    setIsSpeaking(false);
    if (onClose) {
      onClose();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stop]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-gray-950 to-purple-900/20"></div>
      
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-20 p-3 rounded-full bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700/80 transition-all duration-300 group"
        aria-label="Close"
      >
        <svg className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* Main container */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Voice Circle Container - Now clickable */}
        <button
          onClick={handleCircleClick}
          className="relative focus:outline-none focus:ring-4 focus:ring-blue-500/30 rounded-full transition-all duration-300 hover:scale-105"
          style={{ width: size, height: size }}
        >
          {/* Outer pulsing rings */}
          {(isListening || isSpeaking) && (
            <>
              <div 
                className={`absolute inset-0 rounded-full border-2 ${
                  isListening ? 'border-blue-400' : 'border-purple-400'
                } opacity-30`}
                style={{
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  animationDelay: '0s'
                }}
              ></div>
              <div 
                className={`absolute inset-0 rounded-full border-2 ${
                  isListening ? 'border-blue-400' : 'border-purple-400'
                } opacity-20`}
                style={{
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  animationDelay: '0.5s'
                }}
              ></div>
              <div 
                className={`absolute inset-0 rounded-full border ${
                  isListening ? 'border-blue-400' : 'border-purple-400'
                } opacity-10`}
                style={{
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  animationDelay: '1s'
                }}
              ></div>
            </>
          )}
          
          {/* Middle ring with wave effect */}
          <div 
            className={`absolute inset-4 rounded-full ${
              isListening ? 'bg-blue-500/10' : isSpeaking ? 'bg-purple-500/10' : ''
            }`}
            style={{
              animation: (isListening || isSpeaking) ? 'wave 3s ease-in-out infinite' : 'none'
            }}
          >
            <div className={`w-full h-full rounded-full border-2 ${
              isListening ? 'border-blue-400/50' : isSpeaking ? 'border-purple-400/50' : 'border-gray-600/30'
            } backdrop-blur-sm`}></div>
          </div>
          
          {/* Core circle */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 shadow-2xl flex items-center justify-center cursor-pointer">
            {/* Inner gradient overlay */}
            <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
              isListening 
                ? 'bg-gradient-to-tr from-blue-500/30 to-cyan-500/30' 
                : isSpeaking 
                ? 'bg-gradient-to-tr from-purple-500/30 to-pink-500/30'
                : 'bg-gradient-to-tr from-gray-700/30 to-gray-800/30'
            }`}></div>
            
            {/* Center icon/indicator */}
            <div className="relative z-10 pointer-events-none">
              {isListening ? (
                // Microphone icon (with muted state)
                <div className="relative">
                  <svg className={`w-12 h-12 ${isMuted ? 'text-red-400' : 'text-blue-400'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  {isMuted && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-0.5 bg-red-400 rotate-45"></div>
                    </div>
                  )}
                </div>
              ) : isSpeaking ? (
                // Sound wave bars
                <div className="flex items-center gap-1">
                  <div className="w-1 h-6 bg-purple-400 rounded-full" style={{ animation: 'soundBar 0.5s ease-in-out infinite' }}></div>
                  <div className="w-1 h-8 bg-purple-400 rounded-full" style={{ animation: 'soundBar 0.5s ease-in-out infinite 0.1s' }}></div>
                  <div className="w-1 h-5 bg-purple-400 rounded-full" style={{ animation: 'soundBar 0.5s ease-in-out infinite 0.2s' }}></div>
                  <div className="w-1 h-9 bg-purple-400 rounded-full" style={{ animation: 'soundBar 0.5s ease-in-out infinite 0.3s' }}></div>
                  <div className="w-1 h-6 bg-purple-400 rounded-full" style={{ animation: 'soundBar 0.5s ease-in-out infinite 0.4s' }}></div>
                </div>
              ) : (
                // Idle state - play button
                <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </div>
          </div>
          
          {/* Active state glow effect */}
          {(isListening || isSpeaking) && (
            <div 
              className={`absolute inset-0 rounded-full ${
                isListening ? 'bg-blue-400' : 'bg-purple-400'
              } blur-2xl opacity-20`}
              style={{ animation: 'glow 2s ease-in-out infinite' }}
            ></div>
          )}
        </button>
        
        {/* Status text */}
        <div className="text-center">
          <p className={`text-lg font-medium transition-all duration-300 ${
            isListening 
              ? 'text-blue-400' 
              : isSpeaking 
              ? 'text-purple-400' 
              : 'text-gray-500'
          }`}>
            {isListening 
              ? (isMuted ? 'Listening (Muted)...' : `Listening... ${isRecording ? '🔴' : ''}`) 
              : isSpeaking 
              ? 'Speaking...' 
              : 'Tap to start'}
          </p>
          {isRecording && (
            <p className="text-xs text-gray-500 mt-1">
              Sending audio frames every 3 seconds
            </p>
          )}
        </div>
        
        {/* Control buttons */}
        <div className="flex gap-4 mt-4">
          {/* Mute button */}
          <button
            onClick={toggleMute}
            disabled={!isListening}
            className={`p-3 rounded-full transition-all duration-300 ${
              isMuted 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : isListening
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
            }`}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15L4.172 13.586A2 2 0 013 11.172V9a6 6 0 0112 0v2.172a2 2 0 01-1.172 2.414L12.414 15M12 15v3m0 3h.01M19 10a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v3m0 3h.01" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* Stop button (if active) */}
          {(isListening || isSpeaking) && (
            <button
              onClick={() => {
                setIsListening(false);
                setIsSpeaking(false);
                stopRecording();
              }}
              className="px-6 py-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium transition-all duration-300"
            >
              Stop
            </button>
          )}
        </div>

        {/* Debug info for demo */}
        <div className="mt-8 p-4 bg-gray-900/50 rounded-lg backdrop-blur-sm max-w-md">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Audio Chunking Info:</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Audio chunks: 3-second frames</li>
            <li>• Format: WebM audio</li>
            <li>• Backend URL: {backendUrl}</li>
            <li>• Frame counter: {frameCounterRef.current}</li>
          </ul>
        </div>
      </div>
      
      {/* CSS animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.3;
          }
        }
        
        @keyframes wave {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        
        @keyframes glow {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 0.4;
          }
        }
        
        @keyframes soundBar {
          0%, 100% {
            transform: scaleY(0.5);
          }
          50% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceCircle;


