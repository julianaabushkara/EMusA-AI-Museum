/*import { useState } from "react";
import Title from "./Title";
import RecordMessage from "./RecordMessage";
import axios from "axios";

function Controller() {
  const [isLoading, setIsLoading] = useState(false);

  //save our messages
  const [messages, setMessages] = useState<any[]>([]);

  const creatBlobUrl = (data: any) => {
    const blob = new Blob([data], { type: "audio/mpeg" });

    //convert into something to play as an audio file
    const url = window.URL.createObjectURL(blob);
    return url;
  };


  const handleStop = async (blobUrl: string) => {
  setIsLoading(true);

  // Fetch blob
  fetch(blobUrl)
    .then((res) => res.blob())
    .then(async (blob) => {
      if (blob.size === 0) {
        alert("Recording was empty. Please try again.");
        setIsLoading(false);
        return;
      }

      // Only add message if blob is not empty!
      const myMessage = { sender: "me", blobUrl };
      const messagesArr = [...messages, myMessage];

      //construct audio as file
      const formData = new FormData();
      formData.append("file", blob, "myFile.webm");

      //send to backend-> send formdata to api endpoint
      await axios
        .post("http://localhost:8000/post-audio", formData, {
          responseType: "arraybuffer",
        })
        .then((res: any) => {
          const blob = res.data;
          const audio = new Audio();

          //creates the blob url
          audio.src = creatBlobUrl(blob);

          //append to audio
          const museum_ai = { sender: "museum_ai", blobUrl: audio.src };
          messagesArr.push(museum_ai);
          setMessages(messagesArr);

          //play audio
          setIsLoading(false);
          audio.play();
        })
        .catch((err) => {
          console.error(err.message);
          setIsLoading(false);
        });
    });
};
  //contains the audio file
  //trigger stop event -> stop recording
  /*const handleStop = async (blobUrl: string) => {
  setIsLoading(true);

  


  //convert bloburl to blobobject -> send to backend !
  // Fetch blob
  fetch(blobUrl)
    .then((res) => res.blob())
    .then(async (blob) => {
      if (blob.size === 0) {
        alert("Recording was empty. Please try again.");
        setIsLoading(false);
        return;
      }

      // Only add message if blob is not empty! -append recoreded message to messages
      const myMessage = { sender: "me", blobUrl };
      const messagesArr = [...messages, myMessage];
       //our call to backend -> when it stops recording its gonna pass our bloburl send it as a file!
      //construct audio as file
      const formData = new FormData();
      formData.append("file", blob, "myFile.webm");

      //send to backend-> send formdata to api endpoint
      await axios
        .post("http://localhost:8000/post-audio", formData, {
          responseType: "arraybuffer",
        })
        .then((res: any) => {
          const blob = res.data;
          const audio = new Audio();

          //creates the blob url
          audio.src = creatBlobUrl(blob);

          //append to audio
          const museum_ai = { sender: "museum_ai", blobUrl: audio.src };

          
          messagesArr.push(museum_ai);
          setMessages(messagesArr);

          //play audio
          setIsLoading(false);

          //plays automatically

          audio.play();
        })
        .catch((err) => {
          console.error(err.message);
          setIsLoading(false);
        });
    });
};*/
  /*const handleStop = async (blobUrl: string) => {---------------------------------------
    //alert("hello");
    console.log(blobUrl);
    setIsLoading(true);

    //append recoreded message to messages
    const myMessage = { sender: "me", blobUrl };
    const messagesArr = [...messages, myMessage];

    //convert bloburl to blobobject -> send to backend !
    fetch(blobUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        //our call to backend -> when it stops recording its gonna pass our bloburl send it as a file!
        //construct audio as file
        const formData = new FormData();
        //formData.append("file", blob, "myFile.webm");------------------------> recommet later
        if (blob.size === 0) {
          alert("Recording was empty. Please try again.");
          setIsLoading(false);
          return;
        }
        formData.append("file", blob, "myFile.webm");

        console.log(blob); // Check if blob contains valid audio data

        //send to backend-> send formdata to api endpoint
        await axios
          .post("http://localhost:8000/post-audio", formData, {
            // Remove this line:
            //headers: { "Content-Type": "audio/wav" },

            //headers: { "Content-Type" : "audio/wav, audio/mpeg, audio/webm, audio/ogg, audio/mp3, audio/flac, audio/aac, audio/amr, audio/aiff" },  // optional

            //handels the data that comes back
            responseType: "arraybuffer", // Set the response type to handle binary data
          })
          .then((res: any) => {
            //we have the response as file
            console.log(
              res.status,
              res.headers["content-type"],
              res.data?.byteLength || 0
            );
            const blob = res.data;
            const audio = new Audio();

            //creates the blob url
            audio.src = creatBlobUrl(blob);

            //append to audio
            const museum_ai = { sender: "museum_ai", blobUrl: audio.src };
            messagesArr.push(museum_ai);
            setMessages(messagesArr);

            //play audio
            setIsLoading(false);
            //plays automatically
            audio.play();
          })
          .catch((err) => {
            console.error(err.message);
            setIsLoading(false);
          });
      });

    //setIsLoading(false);
  };*/

 /* return (
    <div className="h-screen overflow-y-hidden">
      <Title setMessages={setMessages} />
      <div className="flex flex-col justify-between h-full overflow-scroll pb-96">
        {/*Conversation*//*}
        <div className="mt-5 px-5">
          {messages.map((audio, index) => {
            return (
              <div
                key={index + audio.sender}
                className={
                  "flex flex-col " +
                  (audio.sender === "museum_ai" ? "flex items-end" : "")
                }
              >
                {/*sender *//*}
                <div className="mt-4">
                  <p
                    className={
                      audio.sender === "museum_ai"
                        ? "text-right mr-2 italic text-green-500"
                        : "ml-2 italic text-blue-500"
                    }
                  >
                    {audio.sender}
                  </p>

                  {/*Audio Message*//*}
                  <audio
                    src={audio.blobUrl}
                    className="appearance-none"
                    controls
                  />
                </div>
              </div>
            );
          })}

          {messages.length == 0 && !isLoading && (
            <div className="text-center font-light italic mt-10">
              send Ai a message...
            </div>
          )}
          {messages.length == 0 && isLoading && (
            <div className="text-center font-light italic mt-10">
              gimme a few secounds...{" "}
            </div>
          )}
        </div>

        {/*recorder*//*}
        <div className="fixed bottom-0 w-full py-6 border-t text-center bg-gradient-to-r from-sky-500 to-green-500">
          <div className="flex justify-center items-center w-full ">
            <RecordMessage handleStop={handleStop} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Controller;*/
/*---------------------------------------------------------------------------------------------------------->>>>>this works 
*//*console.log(blob.size, blob.type); // Should be >0 and type like "audio/wav" or "audio/webm"-////////////////////////////////////////////////////////////////

*//*import { useState, useRef, useEffect } from "react";
import Title from "./Title";
import RecordMessage from "./RecordMessage";
import axios from "axios";

const BACKEND_URL = "http://localhost:8000";
const MAX_RECORDING_DURATION = 30000; // 1 minute

function Controller() {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const recordRef = useRef<any>(null);
  const lastEspEventRef = useRef<string>("");

  // Helper: create audio blob URL
  const creatBlobUrl = (data: any) => {
    const blob = new Blob([data], { type: "audio/mpeg" });
    return window.URL.createObjectURL(blob);
  };

  // Play museum voice from backend for ESP32 events
  const playMuseumAudio = async (eventType: string, payload: any) => {
    try {
      const response = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, payload }),
      });
      if (response.headers.get("content-type")?.includes("audio/mpeg")) {
        const audioBlob = await response.blob();
        const audioUrl = creatBlobUrl(audioBlob);
        const audio = new Audio(audioUrl);
        setMessages((prev) => [
          ...prev,
          { sender: "museum_ai", blobUrl: audioUrl },
        ]);
        audio.play();
      }
    } catch (err) {
      console.error("Museum audio error:", err);
    }
  };

  // Poll for ESP32 events
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/get-latest-esp-event`);
        const data = res.data;
        if (
          data.event_type &&
          data.event_type !== lastEspEventRef.current
        ) {
          lastEspEventRef.current = data.event_type;

          // Play museum voice for proximity/gone/lift_state
          if (
            ["proximity", "gone", "lift_state"].includes(data.event_type)
          ) {
            playMuseumAudio(data.event_type, data.payload);
          }

          // Start/stop recording for button events
          if (data.event_type === "start_recording") {
            recordRef.current?.startRecording();
            setTimeout(() => {
              recordRef.current?.stopRecording();
            }, MAX_RECORDING_DURATION);
          } else if (data.event_type === "stop_recording") {
            recordRef.current?.stopRecording();
          }
        }
      } catch (err) {
        // If the backend isn't up, ignore error
      }
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  // handleStop: when recording stops, send to backend and play response
  const handleStop = async (blobUrl: string) => {
    setIsLoading(true);

    //append recoreded message to messages
    const myMessage = { sender: "me", blobUrl };
    const messagesArr = [...messages, myMessage];

    //convert bloburl to blobobject -> send to backend !
    fetch(blobUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        if (blob.size === 0) {
          setIsLoading(false);
          return;
        }
        //construct audio as file
        const formData = new FormData();
        formData.append("file", blob, "myFile.webm");
        console.log(blob.size, blob.type); 
        //send to backend-> send formdata to api endpoint
        await axios
          .post(`${BACKEND_URL}/post-audio`, formData, {
            responseType: "arraybuffer", // Set the response type to handle binary data
          })
          .then((res: any) => {
            const blob = res.data;
            const audio = new Audio();
            audio.src = creatBlobUrl(blob);

            //append to audio
            const museum_ai = { sender: "museum_ai", blobUrl: audio.src };
            messagesArr.push(museum_ai);
            setMessages(messagesArr);

            //play audio
            setIsLoading(false);
            audio.play();
          })
          .catch((err) => {
            console.error(err.message);
            setIsLoading(false);
          });
      });
  };

  return (
    <div className="h-screen overflow-y-hidden">
      <Title setMessages={setMessages} />
      <div className="flex flex-col justify-between h-full overflow-scroll pb-96">
        {/*Conversation*//*}
        <div className="mt-5 px-5">
          {messages.map((audio, index) => {
            return (
              <div
                key={index + audio.sender}
                className={
                  "flex flex-col " +
                  (audio.sender === "museum_ai" ? "flex items-end" : "")
                }
              >
                {/*sender *//*}
                <div className="mt-4">
                  <p
                    className={
                      audio.sender === "museum_ai"
                        ? "text-right mr-2 italic text-green-500"
                        : "ml-2 italic text-blue-500"
                    }
                  >
                    {audio.sender}
                  </p>
                  <audio
                    src={audio.blobUrl}
                    className="appearance-none"
                    controls
                  />
                </div>
              </div>
            );
          })}

          {messages.length == 0 && !isLoading && (
            <div className="text-center font-light italic mt-10">
              send Ai a message...
            </div>
          )}
          {messages.length == 0 && isLoading && (
            <div className="text-center font-light italic mt-10">
              gimme a few secounds...{" "}
            </div>
          )}
        </div>
        {/*recorder*//*}
        <div className="fixed bottom-0 w-full py-6 border-t text-center bg-gradient-to-r from-sky-500 to-green-500">
          <div className="flex justify-center items-center w-full ">
            <RecordMessage ref={recordRef} handleStop={handleStop} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Controller;*/
/*



------------------------------------------------------------------------------->>>>>>
import { useState, useRef, useEffect } from "react";
import Title from "./Title";
import RecordMessage from "./RecordMessage";
import axios from "axios";

const BACKEND_URL = "http://localhost:8000";
const MAX_RECORDING_DURATION = 60000; // 1 minute

function Controller() {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const recordRef = useRef<any>(null);
  const lastEspEventRef = useRef<string>("");
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Detect first user interaction (for autoplay unlock)
  useEffect(() => {
    const unlock = () => setHasUserInteracted(true);
    window.addEventListener("mousedown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("mousedown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Helper: create audio blob URL
  const creatBlobUrl = (data: any) => {
    const blob = new Blob([data], { type: "audio/mpeg" });
    return window.URL.createObjectURL(blob);
  };

  // Play museum voice from backend for ESP32 events
  const playMuseumAudio = async (eventType: string, payload: any) => {
    try {
      const response = await fetch(`${BACKEND_URL}/esp-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, payload }),
      });
      if (response.headers.get("content-type")?.includes("audio/mpeg")) {
        const audioBlob = await response.blob();
        const audioUrl = creatBlobUrl(audioBlob);

        setMessages((prev) => [
          ...prev,
          { sender: "museum_ai", blobUrl: audioUrl },
        ]);

        // Only autoplay if user has interacted (browser restriction)
        if (hasUserInteracted) {
          const audio = new Audio(audioUrl);
          audio.play();
        }
      }
    } catch (err) {
      console.error("Museum audio error:", err);
    }
  };

  // Poll for ESP32 events
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/get-latest-esp-event`);
        const data = res.data;
        if (
          data.event_type &&
          data.event_type !== lastEspEventRef.current
        ) {
          lastEspEventRef.current = data.event_type;

          // Play museum voice for proximity/gone/lift_state
          if (
            ["proximity", "gone", "lift_state"].includes(data.event_type)
          ) {
            playMuseumAudio(data.event_type, data.payload);
          }
          // Remove auto-recording triggers for button events!
          // Recording is now started/stopped only by user interaction
        }
      } catch (err) {
        // If the backend isn't up, ignore error
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [hasUserInteracted]);

  // handleStop: when recording stops, send to backend and play response
  const handleStop = async (blobUrl: string) => {
    setIsLoading(true);

    //append recoreded message to messages
    const myMessage = { sender: "me", blobUrl };
    const messagesArr = [...messages, myMessage];

    //convert bloburl to blobobject -> send to backend !
    fetch(blobUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        if (blob.size === 0) {
          setIsLoading(false);
          return;
        }
        //construct audio as file
        const formData = new FormData();
        formData.append("file", blob, "myFile.wav");
        //send to backend-> send formdata to api endpoint
        await axios
          .post(`${BACKEND_URL}/post-audio`, formData, {
            responseType: "arraybuffer", // Set the response type to handle binary data
          })
          .then((res: any) => {
            const blob = res.data;
            const audioUrl = creatBlobUrl(blob);

            //append to audio
            const museum_ai = { sender: "museum_ai", blobUrl: audioUrl };
            messagesArr.push(museum_ai);
            setMessages(messagesArr);

            //play audio (autoplay answer always allowed, user just recorded!)
            const audio = new Audio(audioUrl);
            audio.play();

            setIsLoading(false);
          })
          .catch((err) => {
            console.error(err.message);
            setIsLoading(false);
          });
      });
  };

  return (
    <div className="h-screen overflow-y-hidden">
      <Title setMessages={setMessages} />
      <div className="flex flex-col justify-between h-full overflow-scroll pb-96">
        {/*Conversation*//*}
        <div className="mt-5 px-5">
          {messages.map((audio, index) => {
            return (
              <div
                key={index + audio.sender}
                className={
                  "flex flex-col " +
                  (audio.sender === "museum_ai" ? "flex items-end" : "")
                }
              >
                {/*sender *//*}
                <div className="mt-4">
                  <p
                    className={
                      audio.sender === "museum_ai"
                        ? "text-right mr-2 italic text-green-500"
                        : "ml-2 italic text-blue-500"
                    }
                  >
                    {audio.sender}
                  </p>
                  <audio
                    src={audio.blobUrl}
                    className="appearance-none"
                    controls
                  />
                </div>
              </div>
            );
          })}

          {messages.length == 0 && !isLoading && (
            <div className="text-center font-light italic mt-10">
              send Ai a message...
            </div>
          )}
          {messages.length == 0 && isLoading && (
            <div className="text-center font-light italic mt-10">
              gimme a few secounds...{" "}
            </div>
          )}
        </div>
        {/*recorder*//*}
        <div className="fixed bottom-0 w-full py-6 border-t text-center bg-gradient-to-r from-sky-500 to-green-500">
          <div className="flex justify-center items-center w-full ">
            <RecordMessage ref={recordRef} handleStop={handleStop} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Controller;*//*** doesnt work because of the auto recording --- and network requests  v4
import { useState } from "react";
import Title from "./Title";
import RecordMessage from "./RecordMessage";
import axios from "axios";

function Controller() {
  const [isLoading, setIsLoading] = useState(false);

  // Save our messages
  const [messages, setMessages] = useState<any[]>([]);

  // Helper: create audio blob URL for playback
  const creatBlobUrl = (data: any) => {
    const blob = new Blob([data], { type: "audio/mpeg" });
    return window.URL.createObjectURL(blob);
  };
  
  // When recording stops, send audio to backend and play response
  const handleStop = async (blobUrl: string) => {
    setIsLoading(true);

    // Fetch blob from blobUrl
    fetch(blobUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        if (blob.size === 0) {
          alert("Recording was empty. Please try again.");
          setIsLoading(false);
          return;
        }
        console.log("Recorded Blob:", blob);
        console.log("Recorded Blob type:", blob.type); // e.g., "audio/webm" or "audio/wav"
        console.log("Recorded Blob size:", blob.size);

        // Add user message for playback
        const myMessage = { sender: "me", blobUrl };
        const messagesArr = [...messages, myMessage];

        // Construct form data to send to backend
        const formData = new FormData();
        formData.append("file", blob, "myFile.wav");
        console.log("Uploading as:", "myFile.wav", "with type:", blob.type);

        // Send to backend and handle response
        await axios
          .post("http://localhost:8000/post-audio", formData, {
            responseType: "arraybuffer",
          })
          .then((res: any) => {
            const blob = res.data;
            const audio = new Audio();
            audio.src = creatBlobUrl(blob);

            const museum_ai = { sender: "museum_ai", blobUrl: audio.src };
            messagesArr.push(museum_ai);
            setMessages(messagesArr);

            setIsLoading(false);
            audio.play();
          })
          .catch((err) => {
            console.error(err.message);
            setIsLoading(false);
          });
      });
  };

  return (
    <div className="h-screen overflow-y-hidden">
      <Title setMessages={setMessages} />
      <div className="flex flex-col justify-between h-full overflow-scroll pb-96">
        {/* Conversation *//*}
        <div className="mt-5 px-5">
          {messages.map((audio, index) => {
            return (
              <div
                key={index + audio.sender}
                className={
                  "flex flex-col " +
                  (audio.sender === "museum_ai" ? "flex items-end" : "")
                }
              >
                {/* Sender *//*}
                <div className="mt-4">
                  <p
                    className={
                      audio.sender === "museum_ai"
                        ? "text-right mr-2 italic text-green-500"
                        : "ml-2 italic text-blue-500"
                    }
                  >
                    {audio.sender}
                  </p>
                  {/* Audio Message *//*}
                  <audio
                    src={audio.blobUrl}
                    className="appearance-none"
                    controls
                  />
                </div>
              </div>
            );
          })}

          {messages.length === 0 && !isLoading && (
            <div className="text-center font-light italic mt-10">
              send Ai a message...
            </div>
          )}
          {messages.length === 0 && isLoading && (
            <div className="text-center font-light italic mt-10">
              gimme a few secounds...
            </div>
          )}
        </div>

        {/* Recorder Button *//*}
        <div className="fixed bottom-0 w-full py-6 border-t text-center bg-gradient-to-r from-sky-500 to-green-500">
          <div className="flex justify-center items-center w-full ">
            <RecordMessage handleStop={handleStop} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Controller;*/


import { useState } from "react";
import Title from "./Title";
import RecordMessage from "./RecordMessage";
import axios from "axios";

function Controller() {
  const [isLoading, setIsLoading] = useState(false);

  //save our messages
  const [messages, setMessages] = useState<any[]>([]);

  const creatBlobUrl = (data: any) => {
    const blob = new Blob([data], { type: "audio/mpeg" });
    const url = window.URL.createObjectURL(blob);
    return url;
  };

  //contains the audio file
  //trigger stop event -> stop recording
const handleStop = async (blobUrl: string) => {
  setIsLoading(true);

  fetch(blobUrl)
    .then((res) => res.blob())
    .then(async (blob) => {
      if (blob.size === 0) {
        // No alert, no error, no message!
        setIsLoading(false);
        // Optionally: setStatus("No audio recorded, try again.");
        return;
      }

      // Only add message if blob is not empty!
      const myMessage = { sender: "me", blobUrl };
      const messagesArr = [...messages, myMessage];

      const formData = new FormData();
      formData.append("file", blob, "myFile.wav");
      console.log(blob);

      await axios
        .post("http://localhost:8000/post-audio", formData, {
          // Remove the manual Content-Type, let browser set it!
          //headers: { "Content-Type": "audio/wav" },
          responseType: "arraybuffer",
        })
        .then((res: any) => {
          const blob = res.data;
          const audio = new Audio();
          audio.src = creatBlobUrl(blob);

          const museum_ai = { sender: "museum_ai", blobUrl: audio.src };
          messagesArr.push(museum_ai);
          setMessages(messagesArr);

          setIsLoading(false);
          audio.play();
        })
        .catch((err) => {
          console.error("AI error:", err.message);
          setIsLoading(false);
          // Optionally: setStatus("AI failed to respond.");
        });
    });
};
  return (
    <div className="h-screen overflow-y-hidden">
      <Title setMessages={setMessages} />
      <div className="flex flex-col justify-between h-full overflow-scroll pb-96">
        {/*Conversation*/}
        <div className="mt-5 px-5">
          {messages.map((audio, index) => {
            return (
              <div
                key={index + audio.sender}
                className={
                  "flex flex-col " +
                  (audio.sender === "museum_ai" ? "flex items-end" : "")
                }
              >
                {/*sender */}
                <div className="mt-4">
                  <p
                    className={
                      audio.sender === "museum_ai"
                        ? "text-right mr-2 italic text-green-500"
                        : "ml-2 italic text-blue-500"
                    }
                  >
                    {audio.sender}
                  </p>

                  {/*Audio Message*/}
                  <audio
                    src={audio.blobUrl}
                    className="appearance-none"
                    controls
                  />
                </div>
              </div>
            );
          })}

          {messages.length == 0 && !isLoading && (
            <div className="text-center font-light italic mt-10">
              send Ai a message...
            </div>
          )}
          {messages.length == 0 && isLoading && (
            <div className="text-center font-light italic mt-10">
              gimme a few secounds...{" "}
            </div>
          )}
        </div>

        {/*recorder*/}
        <div className="fixed bottom-0 w-full py-6 border-t text-center bg-gradient-to-r from-sky-500 to-green-500">
          <div className="flex justify-center items-center w-full ">
            <RecordMessage handleStop={handleStop} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Controller;
