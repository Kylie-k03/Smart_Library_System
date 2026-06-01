import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import cv2
import numpy as np
import requests
import time
from ultralytics import YOLO
# ==========================================
# FIREBASE SETUP
# ==========================================

cred = credentials.Certificate("smart-library-firebase-adminsdk.json")

firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://smart-library-system-b58b5-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

# We point directly to the website's room data path
room_ref = db.reference('library/rooms')

# -------- SETTINGS --------
IMAGE_URL = "http://10.219.112.132/capture"   # your ESP32-CAM image URL
CONFIDENCE_THRESHOLD = 0.5
REFRESH_DELAY = 0.3   # seconds between image fetches
# --------------------------

model = YOLO("yolov8n.pt")
      
while True:
    try:
        response = requests.get(IMAGE_URL, timeout=30)

        image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if frame is None:
            print("ERROR: Could not decode image")
            break

        results = model(frame, classes=[0], verbose=False)   # class 0 = person
        person_count = len(results[0].boxes)

        # ----------------------------------------------------------------------
        # MAP CAMERA COUNT TO WEBSITE ROOM CAPACITY
        # ----------------------------------------------------------------------
        # Change these to match the room your camera is physically monitoring:
        # - 'silent-reading'   (Capacity: 100 seats)
        # - 'computer-section' (Capacity: 80 seats)
        # - 'group-work'       (Capacity: 40 seats)
        # - 'collaboration-area' (Capacity: 60 seats)
        
        target_room_id = 'silent-reading' 
        total_seats = 100 
        
        # Calculate percentage (0 to 100)
        occupancy_percentage = min(100, int((person_count / total_seats) * 100))

        # Update the specific room key directly on Firebase
        room_ref.update({
            target_room_id: occupancy_percentage
        })

        print(f"Cloud Updated: {person_count} people detected ({occupancy_percentage}% full in {target_room_id})")
        person_count = 0

        for result in results:
            for box in result.boxes:
                confidence = float(box.conf[0])

                if confidence >= CONFIDENCE_THRESHOLD:
                    person_count += 1

                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(
                        frame,
                        f"Person {confidence:.2f}",
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        (0, 255, 0),
                        2
                    )

        cv2.putText(
            frame,
            f"People Count: {person_count}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

        cv2.imshow("Library Occupancy Monitor", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        time.sleep(REFRESH_DELAY)

    except Exception as e:
        print("ERROR:", e)
        break

cv2.destroyAllWindows()