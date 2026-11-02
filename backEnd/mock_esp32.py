import requests
import time

BASE_URL = "http://localhost:8000/esp-event"

def send_event(event_type, payload={}):
    print(f"Sending: {event_type}, {payload}")
    res = requests.post(
        BASE_URL,
        json={"event_type": event_type, "payload": payload}
    )
    print(f"Response: {res.status_code}, {res.text}")

send_event("proximity", {"distance": 20})
time.sleep(50)
send_event("lift_state", {"lift_vector": [0,1,1,1,1]})
time.sleep(30)
#send_event("gone", {"distance": 60})
time.sleep(30)
send_event("start_recording")
time.sleep(10)
send_event("stop_recording")

time.sleep(30)

send_event("gone", {"distance": 60})