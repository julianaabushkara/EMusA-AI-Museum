/*import { ReactMediaRecorder } from "react-media-recorder";
import RecordIcon from "./RecordIcon";

type Props = {
  handleStop: any;
};

function RecordMessage({ handleStop }: Props) {
  return (
    <ReactMediaRecorder
      audio

      onStop={handleStop}
      render={({ status, startRecording, stopRecording }) => (
        <div className="mt-2">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            className="bg-white p-4 rounded-full"
          >
            <RecordIcon
              classText={
                status == "recording"
                  ? "animate-pulse text-red-500 "
                  : "text-sky-500"
              }
            />
          </button>
          <p className="mt-2 text-white font-light">{status}</p>
        </div>
      )}
    />
  );
}

export default RecordMessage;*/

//this works ------------------------------------------------------------------------->>>>>

import { ReactMediaRecorder } from "react-media-recorder";
import RecordIcon from "./RecordIcon";

type Props = {
  handleStop: any;
};

function RecordMessage({ handleStop }: Props) {
  return (
    <ReactMediaRecorder
      audio
      mediaRecorderOptions={{ mimeType: "audio/webm" }}
      onStop={handleStop}
      render={({ status, startRecording, stopRecording }) => (
        <div className="mt-2">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            className="bg-white p-4 rounded-full"
          >
            <RecordIcon
              classText={
                status == "recording"
                  ? "animate-pulse text-red-500 "
                  : "text-sky-500"
              }
            />
          </button>
          <p className="mt-2 text-white font-light">{status}</p>
        </div>
      )}
    />
  );
}

export default RecordMessage;
/*
import { ReactMediaRecorder } from "react-media-recorder";
import RecordIcon from "./RecordIcon";
import { useRef, useImperativeHandle, forwardRef } from "react";

type Props = {
  handleStop: any;
};

const MAX_DURATION_MS = 30000; // 30 secounds 

const RecordMessage = forwardRef(({ handleStop }: Props, ref) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    startRecording: () => {
      // This will trigger recording in child
      if (recordingApi?.startRecording) {
        recordingApi.startRecording();
        timerRef.current = setTimeout(() => {
          if (recordingApi?.stopRecording) recordingApi.stopRecording();
        }, MAX_DURATION_MS);
      }
    },
    stopRecording: () => {
      if (recordingApi?.stopRecording) recordingApi.stopRecording();
      if (timerRef.current) clearTimeout(timerRef.current);
    },
  }));

  let recordingApi: any = {};

  return (
    <ReactMediaRecorder
      audio
      mediaRecorderOptions={{ mimeType: "audio/webm" }}
      onStop={handleStop}

      render={({ status, startRecording, stopRecording }) => {
        recordingApi = { startRecording, stopRecording };
        return (
          <div className="mt-2">
            <button
              onMouseDown={() => {
                startRecording();
                timerRef.current = setTimeout(() => stopRecording(), MAX_DURATION_MS);
              }}
              onMouseUp={() => {
                stopRecording();
                if (timerRef.current) clearTimeout(timerRef.current);
              }}
              className="bg-white p-4 rounded-full"
            >
              <RecordIcon
                classText={
                  status == "recording"
                    ? "animate-pulse text-red-500 "
                    : "text-sky-500"
                }
              />
            </button>
            <p className="mt-2 text-white font-light">{status}</p>
          </div>
        );
      }}
    />
  );
});

export default RecordMessage;*/

