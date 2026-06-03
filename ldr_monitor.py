import time
import serial
import serial.tools.list_ports
import firebase_admin
from firebase_admin import credentials
from firebase_admin import db

# ==========================================
# CONFIGURATION
# ==========================================
BAUD_RATE = 9600
FIREBASE_DB_URL = 'https://smart-library-system-b58b5-default-rtdb.asia-southeast1.firebasedatabase.app/'
CREDENTIALS_FILE = "smart-library-firebase-adminsdk.json"

# ==========================================
# FIREBASE SETUP
# ==========================================
print("Initializing Firebase connection...")
try:
    cred = credentials.Certificate(CREDENTIALS_FILE)
    firebase_admin.initialize_app(cred, {
        'databaseURL': FIREBASE_DB_URL
    })
    # Target room id maps to the specific room tab (e.g., 'silent-reading')
    target_room_id = 'collaboration-area'
    ambient_ref = db.reference(f'library/rooms_ambient/{target_room_id}')
    print(f"Firebase connected! Monitoring room: {target_room_id}")
except Exception as e:
    print(f"Error connecting to Firebase: {e}")
    print(f"Make sure '{CREDENTIALS_FILE}' is in this directory.")
    exit(1)

# ==========================================
# SERIAL PORT AUTO-DETECTION
# ==========================================
def find_arduino_port():
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        # Check standard Arduino/USB-to-Serial descriptions
        if any(term in p.description.lower() for term in ["arduino", "ch340", "cp210", "ftdi", "usb-to-serial"]):
            return p.device
    if ports:
        print(f"Available ports: {[p.device for p in ports]}")
        return ports[0].device  # Fallback to the first available port
    return None

# Choose serial port
port = find_arduino_port()
if not port:
    print("\nNo serial port automatically detected!")
    port = input("Please enter your Arduino COM port (e.g., COM3 on Windows, or /dev/ttyUSB0 on Linux/Mac): ").strip()
else:
    print(f"Auto-detected port: {port}")

# Open Serial connection
try:
    ser = serial.Serial(port, BAUD_RATE, timeout=1)
    # Clear buffers
    ser.reset_input_buffer()
    time.sleep(2)  # Wait for Arduino to reset after connection opens
    print(f"Connected to Arduino on port {port} at {BAUD_RATE} baud.")
except Exception as e:
    print(f"Failed to connect to serial port {port}: {e}")
    print("Please make sure your Arduino is plugged in and the COM port is correct/not open in another program.")
    exit(1)

# ==========================================
# MONITOR LOOP
# ==========================================
print("\nMonitoring LDR Sensor... (Press Ctrl+C to exit)")
last_status = None

while True:
    try:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            
            # Match strictly "DARK" or "BRIGHT"
            if line in ["DARK", "BRIGHT"]:
                # Only update Firebase if the status has changed
                if line != last_status:
                    print(f"LDR Status Changed: {line} - Updating Firebase for {target_room_id}...")
                    ambient_ref.set(line)
                    last_status = line
            elif line:
                print(f"Raw serial output: {line}")
                
        time.sleep(0.1)  # Minimal sleep to avoid CPU hogging
        
    except KeyboardInterrupt:
        print("\nExiting monitor...")
        break
    except Exception as e:
        print(f"\nError occurred: {e}")
        time.sleep(2)  # Wait before trying again

# Clean up
try:
    ser.close()
except:
    pass
print("Disconnected.")
