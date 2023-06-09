const leaveRoom = document.getElementById('leave-btn');
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const userList = document.getElementById('user-InRoom');
const userListAll = document.getElementById('users');
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('user');
const room = urlParams.get('room');
const myPeerUserId = urlParams.get('user1');
const myUserId = urlParams.get('user2');
var btnCall = document.getElementById('video-call-btn');
const socket = io();




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

function logout(userId)
{
  socket.emit('logout',userId)
}
socket.on('offlineUser',(userId)=>{
  let x = document.querySelectorAll(`[id="${userId}"]`);
  for(var i=0;i<x.length;i++){
    x[i].classList.remove('online');
    x[i].classList.add('offline');
  }
})
socket.on('onlineUsers',(onlineUsers)=>{
  onlineUsers.forEach(userId => {
    let x = document.querySelectorAll(`[id="${userId}"]`);
    for(var i=0;i<x.length;i++){
      x[i].classList.remove('offline');
      x[i].classList.add('online');
    }
  });
})
socket.on('onlineUser',(userId)=>{
  let x = document.querySelectorAll(`[id="${userId}"]`);
  for(var i=0;i<x.length;i++){
    x[i].classList.remove('offline');
    x[i].classList.add('online');
  }
})
socket.on('createRoomSuccess',({roomName, roomId})=>{
  alert('Tạo phòng thành công');
  window.location.reload();
})

async function login(userId) {
  await socket.emit('login', userId);
}

socket.on('privateRoom',({username,room})=>{
  btnCall.style.display = 'block';
  socket.emit('joinRoom', { username, room });
})

socket.on('roomUsers', ({ room, users}) => {
  outputUsers(users);
});

async function createRoom(roomName, selectedUsers) {
  await socket.emit('createRoom', { roomName, selectedUsers });
}
let imageSelected = false; 

document.getElementById('imageInput').addEventListener('change', async (event) => {
  if (event.target.files.length > 0) {
    const imageFile = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const image = new Image();
      image.onload = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 1200;
        const maxHeight = 800;
        let width = image.width;
        let height = image.height;

        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(image, 0, 0, width, height);

        const compressedImageData = canvas.toDataURL('image/jpeg', 1);

        const byteString = atob(compressedImageData.split(',')[1]);
        const buffer = new ArrayBuffer(byteString.length);
        const view = new Uint8Array(buffer);

        for (let i = 0; i < byteString.length; i++) {
          view[i] = byteString.charCodeAt(i);
        }

        await socket.emit('imageUpload', buffer);
      };

      image.src = e.target.result;
    };

    reader.readAsDataURL(imageFile);
  }
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  let msg = e.target.elements.msg.value;
  
  msg = msg.trim();
  
  if (!msg) {
    return false;
  }

  await socket.emit('chatMessage', msg);
  

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

async function outputMessage(message) {
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


async function outputUsers(users) {

  userList.innerHTML = '';
  userList.innerHTML = `
    ${users.map(user => `<li id="${user._id}" class="${user.status === 'online' ? 'online' : 'offline'}">${user.fullName}</li>`).join('')}
  `;
}

socket.on('output-messages', async (data) => {
  if (data.length) {
    data.forEach((message) => {
    outputMessage(message);
    });
  }
});


const emojiTrigger = document.getElementById('emoji-trigger');
const emojiPicker = document.getElementById('emoji-picker');
const msgInput = document.getElementById('msg');

emojiTrigger.addEventListener('click', () => {
  emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
});

emojiPicker.addEventListener('emoji-click', (event) => {
  const emoji = event.detail.emoji.unicode;
  const startPos = msgInput.selectionStart;
  const endPos = msgInput.selectionEnd;
  const textBeforeCursor = msgInput.value.substring(0, startPos);
  const textAfterCursor = msgInput.value.substring(endPos);
  msgInput.value = textBeforeCursor + emoji + textAfterCursor;
  const newCursorPos = startPos + emoji.length;
  msgInput.setSelectionRange(newCursorPos, newCursorPos);
});


