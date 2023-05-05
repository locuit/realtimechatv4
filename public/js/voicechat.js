const startStopRecordingButton = document.getElementById('startStopRecordingButton');
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;
const audioPlayer = document.querySelector('audio');

startStopRecordingButton.addEventListener('click', (e) => {

  if (!isRecording) {
    isRecording = true;
    startStopRecordingButton.classList.remove('start-icon');
    startStopRecordingButton.classList.add('stop-icon');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.addEventListener('dataavailable', (e) => {
          recordedChunks.push(e.data);
        });
        console.log('start recording');
        mediaRecorder.start();
      })
      .catch((error) => {
        console.error('Error accessing microphone:', error);
      });
  } else {
    // Nếu đang ghi âm, dừng ghi âm
    isRecording = false;
    startStopRecordingButton.classList.remove('stop-icon');
    startStopRecordingButton.classList.add('start-icon');
    mediaRecorder.stop();
    mediaRecorder.addEventListener('stop', () => {
      const recordedBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const arrayBuffer = fileReader.result;
        socket.emit('voiceUpload', { audio: arrayBuffer });
      };
      fileReader.readAsArrayBuffer(recordedBlob);
      recordedChunks = [];
    });
  }
});