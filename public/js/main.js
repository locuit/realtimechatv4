

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

function login(userId)
{
  socket.emit('login', userId);
  
}

socket.on('privateRoom',({username,room})=>{
  btnCall.style.display = 'block';
  socket.emit('joinRoom', { username, room });
})

socket.on('roomUsers', ({ room, users}) => {
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
      console.log(imageBuffer)
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

socket.on('output-messages', (data) => {
  if (data.length) {
    data.forEach((message) => {
      outputMessage(message);
    });
  }
});