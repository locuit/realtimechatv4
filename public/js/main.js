
const leaveRoom = document.getElementById('leave-btn');
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const userList = document.getElementById('user-InRoom');
const userListAll = document.getElementById('users');
const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('user');
const room = urlParams.get('room');
const myPeerUserId = urlParams.get('user1');
const myUserId = urlParams.get('user2');
var btnCall = document.getElementById('video-call-btn');

// handle video call
let isAlreadyCalling = false;
let getCalled = false;
const { RTCPeerConnection, RTCSessionDescription } = window;
const peerConnection = new RTCPeerConnection();
const videoContainer = document.querySelector('.video-container');
const endCallBtn = document.getElementById('end-call-btn');
document.getElementById("end-call-btn").addEventListener("click", hangUp);
document.getElementById('video-call-btn').addEventListener('click', async ()  => {
  videoContainer.classList.remove('hidden');
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (stream) {
    console.log('stream')
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
  }
  console.log(myPeerUserId)
  socket.emit('getPeerId',myPeerUserId);
});
  function hangUp() {
    peerConnection.close();
    peerConnection.onicecandidate = null;
    peerConnection.onaddstream = null;

    const localVideo = document.getElementById("local-video");
    localVideo.srcObject.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;

    const remoteVideo = document.getElementById("remote-video");
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;

    videoContainer.classList.add('hidden');
    socket.emit('getUserHangUp',myPeerUserId);
    alert('Cuộc gọi đã kết thúc');
    window.location.reload();
  }
socket.on('handUp', () => {
  // thong bao nguoi dung khac da thoat
  alert('Cuộc gọi đã kết thúc');

  window.location.reload();
});
socket.on('getPeerIdSuccess', (peerId) => {
  console.log('peerId', peerId);
  callUser(peerId);
});
async function callUser(socketId) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
  
  socket.emit("call-user", {
    offer,
    to: socketId
  });
}
socket.on("call-made", async data => {
  if (getCalled) {
    const confirmed = confirm(
      `User "${data.user}" wants to call you. Do accept this call?`
    );

    if (!confirmed) {
      socket.emit("reject-call", {
        from: data.socket
      });

      return;
    }
    videoContainer.classList.remove('hidden');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (stream) {
      const localVideo = document.getElementById("local-video");
      localVideo.srcObject = stream;
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    }
  }
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.offer)
    );
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));

  socket.emit("make-answer", {
    answer,
    to: data.socket
  });
  getCalled = true;
});
socket.on("answer-made", async data => {
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.answer)
  );
  if (!isAlreadyCalling) {
    callUser(data.socket);
    isAlreadyCalling = true;
  }
});

socket.on("call-rejected", data => {
  alert(`User: "${data.user}" rejected your call.`);
});

peerConnection.ontrack = function({ streams: [stream] }) {
  const remoteVideo = document.getElementById("remote-video");
  if (remoteVideo) {
    remoteVideo.srcObject = stream;
  }
};





if(urlParams.get('user1') == null && urlParams.get('user2') == null && urlParams.get('user') == null && urlParams.get('room') == null){
}
else {
if (username==null && room==null) {
  socket.emit('checkRoom', {myPeerUserId,myUserId});
}
else{
  socket.emit('joinRoom', { username, room });
}
}
socket.on('offlineUser',(userId)=>{
  console.log(userId,'offline');
  let x = document.querySelectorAll(`[id="${userId}"]`);
  for(var i=0;i<x.length;i++){
    console.log(x[i]);
    x[i].classList.remove('online');
    x[i].classList.add('offline');
  }
})
socket.on('onlineUser',(userId)=>{
  console.log(userId,'online');
  let x = document.querySelectorAll(`[id="${userId}"]`);
  for(var i=0;i<x.length;i++){
    console.log(x[i]);
    x[i].classList.remove('offline');
    x[i].classList.add('online');
  }
})
socket.on('createRoomSuccess',({roomName, roomId})=>{
  alert('Tạo phòng thành công');
  window.location.reload();
})

function login(userId)
{
  setInterval(() => {
    socket.emit('heartbeat',userId);
  }, 5000);
  socket.emit('login', userId);
  
}

socket.on('privateRoom',({username,room})=>{
  btnCall.style.display = 'block';
  socket.emit('joinRoom', { username, room });
})

socket.on('roomUsers', ({ room, users }) => {
  outputUsers(users);
});

function createRoom(roomName, selectedUsers){
  socket.emit('createRoom', {roomName, selectedUsers});
}
let imageSelected = false; 

document.getElementById('imageInput').addEventListener('change', (event) => {
  if (event.target.files.length > 0) {

    const imageFile = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageBuffer = new Uint8Array(e.target.result);
      
      socket.emit('imageUpload', imageBuffer);
    };
    reader.readAsArrayBuffer(imageFile);
  }
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  let msg = e.target.elements.msg.value;
  
  msg = msg.trim();
  
  if (!msg) {
    return false;
  }

  socket.emit('chatMessage', msg);
  

  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});



socket.on('message', (message) => {
  outputMessage(message);
  chatMessages.scrollTo(0,chatMessages.scrollHeight);
});

socket.on('uploadSuccess', (fileName) => {
  const li = document.createElement('li');

  const link = document.createElement('a');
  link.href = `/uploads/${fileName}.jpg`;
  link.textContent = fileName;
  li.appendChild(link);
    const img = document.createElement('img');
    img.src = `/uploads/${fileName}.jpg`;
    img.width = 200; 
    li.appendChild(img);
  document.getElementById('messages').appendChild(li);
});

function outputMessage(message) {
  const div = document.createElement('div');
  if(message.fileType){
      if (message.fileType==='webm') {
        div.innerHTML = `
        <p class="meta">${message.username} <span>${message.time}</span></p>
        <audio src="${message.text}.${message.fileType}" controls class="audio-message"></audio>
      `;
      }
      else {
        div.classList.add('message');
        div.innerHTML = `<p class="meta">${message.username} <span>${message.time}</span></p>
        <img src="${message.text}.${message.fileType}" alt="${message.fileName}" class="image-message">`;
      }
  }
  else {
    div.classList.add('message');
    div.innerHTML = `<p class="meta">${message.username} <span>${message.time}</span></p>
    <p class="text">
      ${message.text}
    </p>`;
}
document.querySelector('.chat-messages').appendChild(div);
} 


function outputUsers(users) {

  userList.innerHTML = '';
  userList.innerHTML = `
    ${users.map(user => `<li id="${user._id}" class="${user.status === 'online' ? 'online' : 'offline'}">${user.fullName}</li>`).join('')}
  `;
}
const startStopRecordingButton = document.getElementById('startStopRecordingButton');
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;


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