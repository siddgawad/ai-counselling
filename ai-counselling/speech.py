from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor
import torch
import librosa
import math
import numpy as np
from collections import Counter, deque
import warnings
warnings.filterwarnings('ignore')

class EnsembleEmotionRecognizer:
    def __init__(self, model_name="r-f/wav2vec-english-speech-emotion-recognition", num_runs=5):
        self.feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
        self.model = Wav2Vec2ForSequenceClassification.from_pretrained(model_name)
        self.model.eval()
        self.num_runs = num_runs
        
        # Confidence thresholds
        self.high_confidence_threshold = 0.7
        self.medium_confidence_threshold = 0.5
    
    def is_valid_speech(self, audio_chunk, sr):
        """Enhanced speech validation"""
        rms = np.sqrt(np.mean(audio_chunk**2))
        if rms < 0.005:
            return False
        
        zcr = np.mean(librosa.feature.zero_crossing_rate(audio_chunk)[0])
        if zcr > 0.4:
            return False
        
        try:
            spectral_centroid = librosa.feature.spectral_centroid(y=audio_chunk, sr=sr)[0]
            spec_centroid_mean = np.mean(spectral_centroid)
            
            if spec_centroid_mean < 300 or spec_centroid_mean > 8000:
                return False
        except:
            pass
        
        return True
    
    def predict_single_chunk(self, audio_chunk, sr):
        """Single prediction for a chunk"""
        if not self.is_valid_speech(audio_chunk, sr):
            return None, 0.0
        
        try:
            inputs = self.feature_extractor(audio_chunk, sampling_rate=sr, return_tensors="pt", padding=True)
            
            with torch.no_grad():
                logits = self.model(**inputs).logits
            
            probs = torch.softmax(logits.squeeze(0), dim=-1)
            top_prob, predicted_id = torch.max(probs, dim=-1)
            
            emotion = self.model.config.id2label[predicted_id.item()]
            confidence = top_prob.item()
            
            return emotion, confidence
            
        except Exception as e:
            return None, 0.0
    
    def predict_chunk_ensemble(self, audio_chunk, sr):
        """Run multiple predictions and return majority vote"""
        predictions = []
        confidences = []
        
        # Run multiple predictions
        for _ in range(self.num_runs):
            emotion, confidence = self.predict_single_chunk(audio_chunk, sr)
            if emotion is not None:
                predictions.append(emotion)
                confidences.append(confidence)
        
        if not predictions:
            return None, 0.0
        
        # Majority voting
        emotion_counts = Counter(predictions)
        most_common = emotion_counts.most_common(1)[0]
        final_emotion = most_common[0]
        vote_count = most_common[1]
        
        # Calculate ensemble confidence
        # Weight by how many runs agreed and their average confidence
        emotion_indices = [i for i, e in enumerate(predictions) if e == final_emotion]
        emotion_confidences = [confidences[i] for i in emotion_indices]
        
        # Ensemble confidence = (vote_ratio * avg_confidence_of_votes)
        vote_ratio = vote_count / len(predictions)
        avg_confidence = np.mean(emotion_confidences)
        ensemble_confidence = vote_ratio * avg_confidence
        
        return final_emotion, ensemble_confidence
    
    def process_audio(self, audio_file):
        """Process audio with ensemble predictions"""
        print(f"Running ensemble emotion recognition ({self.num_runs} runs per chunk)...")
        
        # Load and preprocess audio
        waveform, rate = librosa.load(audio_file, sr=16000)
        waveform = librosa.util.normalize(waveform)
        waveform, _ = librosa.effects.trim(waveform, top_db=20)
        
        total_duration = len(waveform) / rate
        print(f"Processing audio: {total_duration:.2f} seconds")
        
        # Chunking parameters
        chunk_duration = 1.0
        overlap_duration = 0.5
        chunk_size = int(chunk_duration * rate)
        overlap_size = int(overlap_duration * rate)
        
        chunks = []
        chunk_times = []
        
        step_size = chunk_size - overlap_size
        num_chunks = math.ceil((len(waveform) - chunk_size) / step_size) + 1
        
        for i in range(num_chunks):
            start_sample = i * step_size
            end_sample = min(start_sample + chunk_size, len(waveform))
            
            if end_sample - start_sample < chunk_size // 3:
                break
            
            chunk = waveform[start_sample:end_sample]
            
            if len(chunk) < chunk_size:
                chunk = np.pad(chunk, (0, chunk_size - len(chunk)), mode='constant')
            
            chunks.append(chunk)
            chunk_times.append((start_sample / rate, min(end_sample / rate, total_duration)))
        
        # Process chunks with ensemble
        results = []
        total_chunks = len(chunks)
        
        for i, (start_time, end_time, chunk) in enumerate(zip([t[0] for t in chunk_times], 
                                                             [t[1] for t in chunk_times], 
                                                             chunks)):
            
            print(f"\rProcessing chunk {i+1}/{total_chunks}... ", end='', flush=True)
            
            emotion, confidence = self.predict_chunk_ensemble(chunk, rate)
            
            if emotion is None:
                continue
            
            result = {
                'emotion': emotion,
                'confidence': confidence,
                'start': start_time,
                'end': end_time
            }
            
            results.append(result)
        
        print("\nEnsemble processing complete!")
        return results

def analyze_audio_ensemble(audio_file, num_runs=5):
    """Main function to analyze audio with ensemble approach"""
    recognizer = EnsembleEmotionRecognizer(num_runs=num_runs)
    results = recognizer.process_audio(audio_file)
    
    if not results:
        print("No valid speech segments detected.")
        return None
    
    print("\n" + "="*60)
    print("ENSEMBLE EMOTION ANALYSIS RESULTS")
    print("="*60)
    
    # Group consecutive same emotions into phases
    emotion_phases = []
    current_phase = None
    
    for result in results:
        if current_phase is None or current_phase['emotion'] != result['emotion']:
            if current_phase is not None:
                emotion_phases.append(current_phase)
            
            current_phase = {
                'emotion': result['emotion'],
                'start': result['start'],
                'end': result['end'],
                'confidences': [result['confidence']],
            }
        else:
            current_phase['end'] = result['end']
            current_phase['confidences'].append(result['confidence'])
    
    if current_phase is not None:
        emotion_phases.append(current_phase)
    
    # Display emotion phases
    print(f"\nDetected {len(emotion_phases)} emotion phases:")
    print("-" * 60)
    
    for i, phase in enumerate(emotion_phases, 1):
        duration = phase['end'] - phase['start']
        avg_confidence = np.mean(phase['confidences'])
        
        print(f"Phase {i}: {phase['start']:6.1f}-{phase['end']:6.1f}s ({duration:4.1f}s)")
        print(f"         Emotion: {phase['emotion']:12} (avg confidence: {avg_confidence:.3f})")
        print()
    
    # Overall emotion distribution
    total_duration = results[-1]['end'] - results[0]['start']
    emotion_durations = {}
    
    for phase in emotion_phases:
        emotion = phase['emotion']
        duration = phase['end'] - phase['start']
        if emotion not in emotion_durations:
            emotion_durations[emotion] = 0
        emotion_durations[emotion] += duration
    
    print("OVERALL EMOTION DISTRIBUTION:")
    print("-" * 40)
    for emotion, duration in sorted(emotion_durations.items(), key=lambda x: x[1], reverse=True):
        percentage = (duration / total_duration) * 100
        print(f"{emotion:12}: {duration:5.1f}s ({percentage:5.1f}%)")
    
    # Summary statistics
    all_confidences = [r['confidence'] for r in results]
    print(f"\nSUMMARY STATISTICS:")
    print(f"Total analyzed duration: {total_duration:.1f}s")
    print(f"Number of emotion phases: {len(emotion_phases)}")
    print(f"Average ensemble confidence: {np.mean(all_confidences):.3f}")
    print(f"Most dominant emotion: {max(emotion_durations.items(), key=lambda x: x[1])[0]}")
    
    return {
        'phases': emotion_phases,
        'distribution': emotion_durations,
        'total_duration': total_duration,
        'avg_confidence': np.mean(all_confidences)
    }

# Usage
if __name__ == "__main__":
    audio_file = "/Users/madhusiddharthsuthagar/Downloads/input_1.wav"
    
    # Run ensemble analysis (5 predictions per chunk, majority vote)
    results = analyze_audio_ensemble(audio_file, num_runs=5)
