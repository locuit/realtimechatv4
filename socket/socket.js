module.exports = function(server)
{   const Redis = require('ioredis');
const client = new Redis({
    host: 'redis-11490.c295.ap-southeast-1-1.ec2.cloud.redislabs.com',
    port: 11490,
    username: 'default',
    password: 'ZzbFUmwQEXe6rQIbxZoempgvTqOrUjm9',
});
const fs = require('fs');
const PrivateRoom = require('../models/privateroom'); 
const User = require('../models/user');
const Message = require('../models/message'); 
const formatMessage = require('../utils/messages');
const moment = require('moment');
    const { userJoin, getCurrentUser,userLeave,getRoomUsers, getAnotherUser, addRoomUser} = require('../utils/users');
    const socket = require('socket.io');
    const io = socket(server);
    const callStatus = [];
    const adminName = 'Admin';
    const checkPrivateRoom = async (senderId, receiverId) => {
        const privateRoom = await PrivateRoom.findOne({
          $or: [
            { user1Id: senderId, user2Id: receiverId },
            { user1Id: receiverId, user2Id: senderId }
          ]  
        });  
      
        return privateRoom;
      };  
      const createPrivateRoom = async (senderId, receiverId) => {
        const privateRoom = new PrivateRoom({
          user1Id: senderId,
          user2Id: receiverId
        });  
      
        await privateRoom.save(); 
        return privateRoom;
      };  
      function getFileExtensionFromBuffer(buffer) {
        const jpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
        const txtBuffer = Buffer.from([0x74, 0x65, 0x78, 0x74]);
      
        if (buffer.slice(0, 3).equals(jpgBuffer)) {
          return 'jpg';
        } else if (buffer.slice(0, 4).equals(pngBuffer)) {
          return 'png';
        } else if (buffer.slice(0, 4).equals(txtBuffer)) {
          return 'txt';
        } else {
          return 'unknown';
        }  
      }  
    io.on("connection", (socket) => {
    socket.on('login', ( userId ) => {
      client.hset('user_status', userId, 'online');
      const user = userJoin(socket.id, '', '', userId);
      client.hgetall('user_status', (err, result) => {
        if (err) throw err;
        const onlineUsers = Object.keys(result).filter((userId) => result[userId] === 'online');
        io.to(socket.id).emit('onlineUsers', onlineUsers);
      });  
      io.emit('onlineUser', userId);
    });  
    // Handle chat event
    socket.on('checkRoom', ({myPeerUserId,myUserId}) => {
      checkPrivateRoom(myPeerUserId,myUserId).then(room => {
        if(room)
        {
          socket.emit('privateRoom',{username:myUserId,room:room._id});
  
        }  
        else{
          createPrivateRoom(myPeerUserId,myUserId).then(room => {
            socket.emit('privateRoom',{username:myUserId,room:room._id});
          })  
        }   
      })  
      
    })  
    socket.on('createRoom', ({roomName, selectedUsers})=> {
      const room = new Room({
        roomName: roomName,
      });  
      room.save().then(room => {
        User.find({ _id: { $in: selectedUsers } })
        .then(users => {
          users.forEach(user => {
            user.rooms.push(room._id);
            user.save();
          });  
        })  
      })  
      socket.emit('createRoomSuccess', {roomName: roomName, roomId: room._id});
      
    });  
    socket.on('joinRoom', async ({ username, room }) => {
      try {
        const userFullName = await User.findById(username);
        const user = userJoin(socket.id, userFullName.fullName, room, username);
        socket.join(user.room);
        User.find({rooms : user.room}).then(userInRoom => {
          io.to(socket.id).emit('roomUsers', {
            room: user.room,
            users: userInRoom
          });  
          client.hgetall('user_status', (err, result) => {
            if (err) throw err;
            const onlineUsers = Object.keys(result).filter((userId) => result[userId] === 'online');
            io.to(socket.id).emit('onlineUsers', onlineUsers);
          });  
        })  
        
        io.emit('onlineUser', username);
        const messages = await Message.find({ roomId: room });
        messages.sort((a, b) => a.createdAt - b.createdAt);
        const messagesData = [];
        for (const message of messages) {
          const user = await User.findById(message.senderId);
          const formattedTime = moment(message.createdAt).format('HH:mm');
          let messageContent ='';
          let extension ='';
          if (message.messageType === 'text') {
            messageContent = message.content;
          }  
          else{
            const dotIndex = message.content.lastIndexOf(".");
            const fileName = message.content.substring(0, dotIndex);
            extension = message.content.substring(dotIndex + 1);
            messageContent = fileName;
          }  
          const messageData = {
            username: user.fullName,
            text: messageContent,
            fileType: extension,
            time: formattedTime
          }  
          messagesData.push(messageData);
        }  
        io.to(socket.id).emit('output-messages', messagesData);
      } catch (error) {
        console.error(error);
      }  
     
    });  
  
    socket.on('chatMessage', (msg) => {
        const user = getCurrentUser(socket.id);
        if(!user || !user.room)
        {
          socket.emit('message', formatMessage(adminName, 'You are not in a room, please join a room or user first','',moment().format('h:mm a')));
          return;
        }  
        const message = new Message({
          roomId: user.room,
          senderId: user.userId,
          content: msg,
          messageType: 'text'
        });  
        message.save();
        io.to(user.room).emit('message', formatMessage(user.username, msg,'',moment().format('h:mm a')));
    });    
    // End Handle chat event
    //Handle Send Voice
    socket.on('voiceUpload', (data) => {
      const user = getCurrentUser(socket.id);
          if(!user || !user.room)
        {
          socket.emit('message', formatMessage(adminName, 'You are not in a room, please join a room or user first','',moment().format('h:mm a')));
          return;
        }  
      const audioBuffer = Buffer.from(data.audio, 'binary');  
      const fileName = `file_${Date.now()}`;
      fs.writeFile(`uploads/voice/${fileName}.webm`, audioBuffer, (err) => {
        if (err) {
          console.error('Error saving audio file:', err);
        } else {
            const message = new Message({
              roomId: user.room,
              senderId: user.userId,
              content: `${fileName}.webm`,
              messageType: 'audio'
            });  
            message.save();
            io.emit('onlineUser',user.userId)
            io.to(user.room).emit('message', formatMessage(user.username, `${fileName}`,`webm`,moment().format('h:mm a')));
          }  
        });  
      });  
      //End Handle Send Voice
      //Handle Send Image
      socket.on('imageUpload', (fileData) => {
        const user = getCurrentUser(socket.id);
            if(!user || !user.room)
            {
              socket.emit('message', formatMessage(adminName, 'You are not in a room, please join a room or user first','',moment().format('h:mm a')));
              return;
            }  
        const buffer = Buffer.from(fileData);
        const fileName = `file_${Date.now()}`;
        const fileExtension = getFileExtensionFromBuffer(buffer);
        fs.writeFile(`uploads/image/${fileName}.${fileExtension}`, buffer, (err) => {
          if (err) {
            console.error('Lỗi lưu file:', err);
          } else {   
                   
            const message = new Message({
              roomId: user.room,
              senderId: user.userId,
              content: `${fileName}.${fileExtension}`,
              messageType: 'image'
            });  
            message.save();
            io.emit('onlineUser',user.userId);
            io.to(user.room).emit('message', formatMessage(user.username, `${fileName}`,`${fileExtension}`,moment().format('h:mm a')));
          }  
        });  
      });  
      // End Handle Send Image
      //Handle Video Call
      socket.on('getPeerId', (myPeerUserId) => {
        const user = getAnotherUser(myPeerUserId);
        if(user)
        {
          //kiem tra neu da ton tai trong callStatus thi thong bao da co nguoi goi
          if(callStatus.findIndex(x => x.id === user.userId) !== -1)
          {
            io.to(socket.id).emit('getPeerIdFail');
            return;
          }
          io.to(socket.id).emit('getPeerIdSuccess', user.id);
        }
        else{
          io.to(socket.id).emit('getPeerIdFail');
        }
      });  
      socket.on("call-user", (data) => {
        const user = getCurrentUser(socket.id);
        socket.to(data.to).emit("call-made", {
          offer: data.offer,
          socket: socket.id,
          user: user.username
        });  
    });    
    socket.on("make-answer", data => {
      const user = getCurrentUser(socket.id);
      const peerUser = getCurrentUser(data.to);
      if(callStatus.findIndex(x => x.id === user.userId) === -1)
      {
        callStatus.push({
          id: user.userId
        });
        callStatus.push({
          id: peerUser.userId
        });
  
      }
      socket.to(data.to).emit("answer-made", {
        socket: socket.id,
        answer: data.answer,
        peerUser: peerUser.userId
      });  
    });  
    
    socket.on("reject-call", data => {
      const user = getCurrentUser(socket.id);
      const peerUser = getCurrentUser(data.from);
      callStatus.splice(callStatus.findIndex(x => x.id === user.userId),1);
      callStatus.splice(callStatus.findIndex(x => x.id === peerUser.userId),1);
      socket.to(data.from).emit("call-rejected", {
        socket: socket.id,
        user: user.username
      });  
    });  
    socket.on('getUserHangUp',(myPeerUserId) => {
      const user = getAnotherUser(myPeerUserId);
      if(user)
      {
        const userIsMe = getCurrentUser(socket.id);
        callStatus.splice(callStatus.findIndex(x => x.id === user.userId),1);
        callStatus.splice(callStatus.findIndex(x => x.id === userIsMe.userId),1);
        io.to(user.id).emit('handUp');
      }
      else{
        const user = getCurrentUser(socket.id);
        callStatus.splice(callStatus.findIndex(x => x.id === user.userId),1);
        const peerUser = getCurrentUser(myPeerUserId);
        callStatus.splice(callStatus.findIndex(x => x.id === peerUser.userId),1);
        io.to(peerUser.id).emit('handUp');
      }
    })  
    // End Handle Video Call
  
    //Handle Disconnect
    socket.on('logout',(userId) =>{
      io.emit('offlineUser',userId);
      client.hdel('user_status', userId);
    })  
    socket.on('disconnect', () => {
      const getuser = getCurrentUser(socket.id);
      if(getuser)
      {
        io.emit('offlineUser',getuser.userId);
        client.hdel('user_status', getuser.userId);
      }  
      client.hgetall('user_status', (err, result) => {
        if (err) throw err;
      
        const onlineUsers = Object.keys(result).filter((userId) => result[userId] === 'online');
        
      });  
        const user = userLeave(socket.id);
        if(user && user.room)
        {
            io.to(user.room).emit('message', formatMessage(adminName, `${user.username} has left the chat`,'',moment().format('h:mm a')));
        }    
    });    
    //End Handle Disconnect
  }); 
}
