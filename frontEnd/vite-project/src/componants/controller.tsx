


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
