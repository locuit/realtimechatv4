const express = require('express');
const http = require('http');
const app = express();
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const User = require('./models/user');
const Room = require('./models/room');
const PrivateRoom = require('./models/privateroom'); 
const Message = require('./models/message'); 
var path = require('path')
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser,userLeave,getRoomUsers, getAnotherUser, addRoomUser} = require('./utils/users');
dotenv.config();
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const fs = require('fs');
const moment = require('moment');
const bcrypt = require('bcrypt');
const multer = require('multer');
const firebase = require('firebase/app');
const {getStorage,ref,uploadBytes,getDownloadURL} = require('firebase/storage');
const firebaseConfig = {
  apiKey: "AIzaSyCvRlzQx6sy0QiJeDNm2Bpx0zM5oRr1Fpg",
  authDomain: "realtimechat-85fd8.firebaseapp.com",
  projectId: "realtimechat-85fd8",
  storageBucket: "realtimechat-85fd8.appspot.com",
  messagingSenderId: "221248134335",
  appId: "1:221248134335:web:b6aed4646b0fd97fc67a0a",
  measurementId: "G-VR2ZDQ2Y2R"
};
firebase.initializeApp(firebaseConfig);
const storage = getStorage();

const upload = multer({ storage: multer.memoryStorage() });

const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server);
const Redis = require('ioredis');
const client = new Redis({
    host: 'redis-11490.c295.ap-southeast-1-1.ec2.cloud.redislabs.com',
    port: 11490,
    username: 'default',
    password: 'ZzbFUmwQEXe6rQIbxZoempgvTqOrUjm9',
});




app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static(path.join(__dirname, 'models')));
app.use(express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'uploads/voice')));
app.use(express.static(path.join(__dirname, 'uploads/image')));



mongoose.connect(process.env.MONGO_URL, { 
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(console.log('DB Connection Successful!')).catch(err => {console.log(err)});

app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
  secret: 'locuit',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

passport.use('local-login',new LocalStrategy({
  username: 'username',
  password:'password',
},
  async (username, password, done) => {
    try {
      const user = await User.findOne({ username: username }); 
      if (!user) {
        return done(null, false, { message: 'Tên người dùng không hợp lệ'});
      }
      if (!user.isValidPassword(password)) { 
        return done(null, false, { message: 'Mật khẩu không đúng' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));
passport.use('local-register', new LocalStrategy({
  username: 'username',
  password:'password',
  passReqToCallback: true,

}, async (req,username, password, done) => {
  const { fullname } = req.body;
  try{
    const user = await User.findOne({ username: username }); 
    if (user) {
      console.log('Tên người dùng đã tồn tại');
      return done(null, false, { message: 'Tên người dùng đã tồn tại'});
    }
    else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newUser = new User({
        username: username,
        password: hashedPassword,
        fullName: fullname,
        avatar:`https://avatars.dicebear.com/api/avataaars/${username}.svg`
      });
      await newUser.save();
      return done(null, newUser);
    }
  } catch (error) {
    return done(error);
  }
}));

app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/google/callback', passport.authenticate('google'));
app.get('/auth/facebook/callback', passport.authenticate('facebook'));
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID, 
  clientSecret: process.env.GOOGLE_CLIENT_SECRET, 
  callbackURL: 'https://chatchat.onrender.com/google/callback'
}, (accessToken,refreshToken,profile,done) => {
    if (profile.id) {
      User.findOne({googleId: profile.id})
        .then((existingUser) => {
          if (existingUser) {
            done(null, existingUser);
          } else {
            new User({
              username: profile.emails[0].value.split('@')[0]+'gg',
              googleId: profile.id,
              email: profile.emails[0].value,
              fullName: profile.displayName,
              avatar:`https://avatars.dicebear.com/api/avataaars/${profile.id}.svg`
            })
              .save()
              .then(user => done(null, user));
          }
        })
  }
}));
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: 'https://chatchat.onrender.com/facebook/callback',
  profileFields: ['id', 'displayName', 'photos', 'email']
}, (accessToken,refreshToken,profile,done) => {
    // Check if facebook profile exist.
    if (profile.id) {
      User.findOne({facebookId: profile.id})
        .then((existingUser) => {
          if (existingUser) {
            done(null, existingUser);
          } else {
            new User({
              username: profile.emails[0].value.split('@')[0]+'fb',
              facebookId: profile.id,
              email: profile.emails[0].value,
              fullName: profile.displayName,
              avatar:`https://avatars.dicebear.com/api/avataaars/${profile.id}.svg`
            })
              .save()
              .then(user => done(null, user));
          }
        })
    }
    console.log(profile);
  }
));
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
    try {
      const user = User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);

    }
  });
    
app.get('/', (req, res) => {
  res.render('login.ejs', { message: req.flash('error') });
});
app.get('/login', (req, res) => {
  res.render('login.ejs', { message: req.flash('error') });
});
app.get('/register', (req, res) => {
  res.render('register.ejs', { message: req.flash('error') });
});
app.get('/google/callback', passport.authenticate('google', {
  successRedirect: '/chat', // Đường dẫn sau khi đăng nhập thành công
  failureRedirect: '/login', // Đường dẫn sau khi đăng nhập thất bại
  failureFlash: true,
}));
app.get('/facebook/callback', passport.authenticate('facebook', {
  successRedirect: '/chat', // Đường dẫn sau khi đăng nhập thành công
  failureRedirect: '/login', // Đường dẫn sau khi đăng nhập thất bại
  failureFlash: true,
}));
app.post('/auth/register', passport.authenticate('local-register', {
  successRedirect: '/chat',
  failureRedirect: '/register',
  failureFlash: true,
}));
app.post('/auth/login', passport.authenticate('local-login', {
successRedirect: '/chat', 
failureRedirect: '/login', 
failureFlash: true,
}));

app.post('/logout', async (req, res) => {
  try {
    if (!req.session || !req.session.passport || !req.session.passport.user) {
      return res.redirect('/login');
    }
    req.logout((err) => {
      if (err) {
        console.error('Lỗi khi đăng xuất:', err);
        return res.redirect('/login');  
      }

      // Xóa session của người dùng
      req.session.destroy((err) => {
        if (err) {
          console.error('Lỗi khi xóa session:', err);
          return res.redirect('/login');
        } 
        // Chuyển hướng về trang đăng nhập sau khi xóa session thành công
        res.redirect('/login');
      });
    })
  } catch (err) {
    console.error('Lỗi khi đăng xuất:', err);
    return res.redirect('/login');
  }
});

app.get('/videocall', ensureAuthenticated, (req, res) => {
  res.render('videocall.ejs');
});

app.get('/chat', ensureAuthenticated, (req, res) => {
  try {
    const userId = req.session.passport.user;
    User.find({})
      .then(usersNotMe => {
        const filteredUsers = usersNotMe.filter(user => user._id != userId);
        filteredUsers.forEach(user => {
          client.hget('user_status', user._id.toString(), (err, status) => {
            if (err) throw err;
            user.status = status;
          });
        });
        User.findById(userId)
          .then(userIsMe => {
            const savedRooms = userIsMe.rooms;
            Room.find({ _id: { $in: savedRooms } })
              .then(rooms => {
                res.render('chat.ejs', { users: filteredUsers, user: userIsMe, rooms: rooms });
              })
              .catch(err => {
                console.log(err);
              })
          })
          .catch(err => {
            console.log(err);
          })
      })
      .catch(err => {
        console.log(err);
      });
  } catch (err) {
    console.error('Lỗi khi xử lý session không tồn tại:', err);
    res.redirect('/login');
  }  
});  

app.get('/me', (req, res) => {
  const userId = req.session.passport.user;
  User.findById(userId).then(user => {
    const userData = {
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
    };  
    res.render('profile.ejs', { user: userData });  
  })
});  
app.post('/me/update', upload.single('avatar'), async (req, res) => {
  const userId = req.session.passport.user;
  try {
    const user = await User.findById(userId);
    if(req.file){
      const storeRef = ref(storage, `avatars/${req.file.originalname}`);
      await uploadBytes(storeRef, req.file.buffer);
      const url = await getDownloadURL(storeRef);
      user.avatar = url;
    }
    if (req.body.fullName)
    {
      user.fullName = req.body.fullName;
    }
    if(req.body.email)
    {
      user.email = req.body.email;
    }
    await user.save();
    res.redirect('/chat');
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

function ensureAuthenticated(req, res, next) {

const adminName = 'Admin';
  if (req.isAuthenticated()) {
    return next();
  }  
  res.render('login.ejs', { message: req.flash('error') });

}  

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
const callStatus = [];
const adminName = 'Admin';
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
      console.log('buffer');
      console.log(buffer);
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
          console.log(callStatus);
          console.log(user.userId);
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
      answer: data.answer
    });  
  });  
  
  socket.on("reject-call", data => {
    const user = getCurrentUser(socket.id);
    socket.to(data.from).emit("call-rejected", {
      socket: socket.id,
      user: user.username
    });  
  });  
  socket.on('getUserHangUp',(myPeerUserId) => {
    const user = getAnotherUser(myPeerUserId);
    if(user)
    {
      callStatus.splice(callStatus.findIndex(x => x.id === user.userId),1);
      callStatus.splice(callStatus.findIndex(x => x.id === myPeerUserId),1);
      io.to(user.id).emit('handUp');
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

const port = 3000;
server.listen(port, () => {
console.log(`Server is running on port ${port}`);
});
