let isAlreadyCalling = false;
let getCalled = false;
let isMicMuted = false;

const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
const { RTCPeerConnection, RTCSessionDescription } = window;
const peerConnection = new RTCPeerConnection(configuration);
const videoContainer = document.querySelector('.video-container');
const endCallBtn = document.getElementById('end-call-btn');
const muteBtn = document.getElementById('mute-btn');

document.getElementById("end-call-btn").addEventListener("click", hangUp);

muteBtn.addEventListener('click', () => {
  const localStream = document.getElementById("local-video").srcObject;
  const audioTrack = localStream.getAudioTracks()[0];
  isMicMuted = !isMicMuted;
  audioTrack.enabled = !isMicMuted;
  muteBtn.textContent = isMicMuted ? "Unmute" : "Mute";
});

document.getElementById('video-call-btn').addEventListener('click', async ()  => {
  videoContainer.classList.remove('hidden');
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (stream) {
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
  }
  socket.emit('getPeerId',myPeerUserId);
});
function hangUp() {
    peerConnection.close();
    peerConnection.onicecandidate = null;
    peerConnection.onaddstream = null;

    const localVideo = document.getElementById("local-video");
    localVideo.srcObject.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    const myCallVideoId = document.getElementById('userId').getAttribute('data-myUserId');
    const remoteVideo = document.getElementById("remote-video");
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;

    videoContainer.classList.add('hidden');
    socket.emit('getUserHangUp',myCallVideoId);
    alert('Cuộc gọi đã kết thúc');
    window.location.reload();
};

socket.on('handUp', () => {
  alert('Cuộc gọi đã kết thúc');

  window.location.reload();
});

socket.on('getPeerIdSuccess', (peerId) => {
  peerUserId = peerId;
  callUser(peerId);
});

socket.on('getPeerIdFail',()=> {
  alert('Người dùng không online');
  window.location.reload();
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
  peerUserId = data.socket;
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
  window.location.reload();
});

peerConnection.ontrack = function({ streams: [stream] }) {
  const remoteVideo = document.getElementById("remote-video");
  if (remoteVideo) {
    remoteVideo.srcObject = stream;
  }
};
peerConnection.onicecandidate = function(event) {
  if (event.candidate) {
  socket.emit("addIceCandidate", {
  candidate: event.candidate,
  to: peerUserId
  });
  }
  };
  socket.on("iceCandidate", async data => {
    try {
    await peerConnection.addIceCandidate( new RTCIceCandidate(data.candidate));
    console.log('addIceCandidate success');
    } catch (error) {
    console.error("Error adding ice candidate:", error);
    }
    });