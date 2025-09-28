import cv2
from deepface import DeepFace
from PIL import Image, ImageTk
import tkinter as tk

class WebcamEmotionDetector:
    def __init__(self, window_title="Webcam Emotion Detection", update_interval=30):
        self.update_interval = update_interval 
        self.emotion = "Starting..."
        
    
        self.root = tk.Tk()
        self.root.title(window_title)
        
        self.label = tk.Label(self.root)
        self.label.pack()
    
        self.cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            print("Could not open webcam")
            exit()
        
      
        self.update_frame()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def detect_emotion(self, frame):
        try:
            result = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)
            return result[0]['dominant_emotion']
        except:
            return "No face"

    def update_frame(self):
        ret, frame = self.cap.read()
        if ret:
        
            self.emotion = self.detect_emotion(frame)
            print("🧠 Detected Emotion:", self.emotion)
            
        
            cv2.putText(frame, f"Emotion: {self.emotion}", (50, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
           
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(frame_rgb)
            imgtk = ImageTk.PhotoImage(image=img)
            
            self.label.imgtk = imgtk
            self.label.configure(image=imgtk)
        
      
        self.label.after(self.update_interval, self.update_frame)

    def on_close(self):
     
        self.cap.release()
        self.root.destroy()

    def run(self):
        
        self.root.mainloop()




detector = WebcamEmotionDetector()
detector.run()
