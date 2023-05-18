let isAlreadyCalling = false;
let getCalled = false;
let isMicMuted = false;


const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = window;
const videoContainer = document.querySelector('.video-container');
const endCallBtn = document.getElementById('end-call-btn');
const muteBtn = document.getElementById('mute-btn');
const peerConnection = new RTCPeerConnection({
  iceServers: [
      {
        urls: "stun:a.relay.metered.ca:80",
      },
      {
        urls: "turn:a.relay.metered.ca:80",
        username: "7c294c2f9e9125844880e59f",
        credential: "SWZQqsQ49t2GwE7A",
      },
      {
        urls: "turn:a.relay.metered.ca:80?transport=tcp",
        username: "7c294c2f9e9125844880e59f",
        credential: "SWZQqsQ49t2GwE7A",
      },
      {
        urls: "turn:a.relay.metered.ca:443",
        username: "7c294c2f9e9125844880e59f",
        credential: "SWZQqsQ49t2GwE7A",
      },
      {
        urls: "turn:a.relay.metered.ca:443?transport=tcp",
        username: "7c294c2f9e9125844880e59f",
        credential: "SWZQqsQ49t2GwE7A",
      },
  ],
});
document.getElementById("end-call-btn").addEventListener("click", hangUp);
let localStream = null;
muteBtn.addEventListener('click', () => {
  localStream = document.getElementById("local-video").srcObject;
  const audioTrack = localStream.getAudioTracks()[0];
  isMicMuted = !isMicMuted;
  audioTrack.enabled = !isMicMuted;
  muteBtn.textContent = isMicMuted ? "Unmute" : "Mute";
});
document.getElementById('video-call-btn').addEventListener('click', async ()  => {
  videoContainer.classList.remove('hidden');
  await setupLocalCamera();
  socket.emit('getPeerId',myPeerUserId);
});

async function setupLocalCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (localStream) {
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }
}
function hangUp() {
  videoContainer.classList.add('hidden');
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
      `User "${data.user}" wants to call you. Do you accept this call?`
    );

    if (!confirmed) {
      socket.emit("reject-call", {
        from: data.socket
      });
      return;
    }

    videoContainer.classList.remove('hidden');
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream = newStream;
      if (newStream) {
        const localVideo = document.getElementById("local-video");
        localVideo.srcObject = newStream;
        newStream.getTracks().forEach(track => {
          const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            peerConnection.addTrack(track, newStream);
          }
        });
      }
    } catch (error) {
      // Xử lý lỗi không lấy được camera
      alert("Could not access camera. Please make sure it is not being used by another application.");
      return;
    }
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
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

    // Thêm sự kiện cho nút chuyển đổi camera
document.getElementById('camera-select').addEventListener('change', switchCamera);

// Hàm xử lý sự kiện chuyển đổi camera
async function switchCamera() {
  const selectedDeviceId = this.value;
  console.log('selectedDeviceId', selectedDeviceId, 'localStream', localStream);
  if (localStream && selectedDeviceId) {
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      // Tắt luồng video hiện tại
      videoTracks[0].stop();

      // Lấy luồng mới từ camera đã chọn
      localStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: selectedDeviceId }, audio: true });
      console.log('localStream', localStream);
      // Cập nhật luồng mới cho video hiện tại
      const localVideo = document.getElementById("local-video");
      localVideo.srcObject = localStream;

      // Thêm các luồng mới vào kết nối peer
      localStream.getTracks().forEach(track => {
        const sender = peerConnection.getSenders().find(s => s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          peerConnection.addTrack(track, localStream);
        }
      });

    }
  }
}

// Hàm để lấy danh sách các camera và hiển thị trong dropdown select
async function populateCameraList() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(device => device.kind === 'videoinput');

  const selectElement = document.getElementById('camera-select');
  selectElement.innerHTML = '';

  videoDevices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Camera ${selectElement.length + 1}`;
    selectElement.appendChild(option);
  });
}

// Gọi hàm để lấy danh sách camera khi trang web được tải
populateCameraList();
