
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




socket.on('privateRoom',({username,room})=>{
  socket.emit('joinRoom', { username, room });
})


socket.on('roomUsers', ({ room, users }) => {
  outputUsers(users);
});


// Lắng nghe sự kiện submit form
document.getElementById('uploadForm').addEventListener('submit', (event) => {
  event.preventDefault();

  // Lấy file từ input
  const file = document.getElementById('fileInput').files[0];
  // Tạo FileReader để đọc dữ liệu của file
  const reader = new FileReader();
  // Xử lý sự kiện khi FileReader đọc dữ liệu thành công
  reader.onload = function(event) {
    // Đọc dữ liệu của file dưới dạng chuỗi (string) hoặc dưới dạng ArrayBuffer
    const fileData = event.target.result;
    // Gửi dữ liệu của file lên server thông qua kết nối Socket.IO
    socket.emit('uploadFile', fileData);
  };

  // Xử lý sự kiện khi FileReader đọc dữ liệu thất bại
  reader.onerror = function(event) {
    console.error('Lỗi đọc dữ liệu file:', event.target.error);
  };

  // Đọc dữ liệu của file
  reader.readAsArrayBuffer(file); // Hoặc reader.readAsText(file) nếu muốn đọc dữ liệu dưới dạng chuỗi (string)
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
  // Tạo một thẻ li để hiển thị thông tin file đã upload
  const li = document.createElement('li');

  // Tạo một thẻ a để hiển thị tên file và đường dẫn đến file
  const link = document.createElement('a');
  link.href = `/uploads/${fileName}.jpg`; // Đường dẫn đến file
  link.textContent = fileName; // Tên file
  li.appendChild(link);

  // Nếu file là hình ảnh, thì hiển thị nó làm hình ảnh
    const img = document.createElement('img');
    img.src = `/uploads/${fileName}.jpg`; // Đường dẫn đến file
    img.width = 200; // Kích thước ảnh
    li.appendChild(img);

  // Thêm thẻ li vào danh sách tin nhắn
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

