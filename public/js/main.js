
const leaveRoom = document.getElementById('leave-btn');
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const userList = document.getElementById('user-InRoom');
const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('user');
const room = urlParams.get('room');
const myPeerUserId = urlParams.get('user1');
const myUserId = urlParams.get('user2');


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

socket.on('createRoomSuccess',({roomName, roomId})=>{
  alert('Tạo phòng thành công');
  window.location.reload();
})


socket.on('privateRoom',({username,room})=>{
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
      
      socket.emit('uploadFile', imageBuffer);
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
  if(message.fileType){
    const div = document.createElement('div');
    div.classList.add('message');
  div.innerHTML = `<p class="meta">${message.username} <span>${message.time}</span></p>
  <img src="${message.text}.${message.fileType}" alt="${message.fileName}" class="image-message">`;
  document.querySelector('.chat-messages').appendChild(div);
  }
  else {
     const div = document.createElement('div');
  div.classList.add('message');
  div.innerHTML = `<p class="meta">${message.username} <span>${message.time}</span></p>
  <p class="text">
    ${message.text}
  </p>`;
  document.querySelector('.chat-messages').appendChild(div);
  }
 
} 


function outputUsers(users) {
  userList.innerHTML = `
    ${users.map(user => `<li id="userInRoom">${user.username}</li>`).join('')}
  `;
}
leaveRoom.addEventListener('click', () => {
  const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
  if (leaveRoom) {
    window.location = './login';
  }
});

