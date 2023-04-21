const express = require('express');
const http = require('http');
const app = express();
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const User = require('./models/user'); // Import User model (nếu có)
const Room = require('./models/room'); // Import Room model (nếu có)
const PrivateRoom = require('./models/privateroom'); // Import PrivateRoom model (nếu có)
const Message = require('./models/message'); // Import Message model (nếu có)
var path = require('path')
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser,userLeave,getRoomUsers, getAnotherUser} = require('./utils/users');
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
  callbackURL: 'http://localhost:3000/google/callback'
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
  callbackURL: 'http://localhost:3000/facebook/callback',
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
    User.findById(userId)
      .then(user => {
        user.status = 'online';
        user.save();
      })
    User.find({})
      .then(usersNotMe => {
        const filteredUsers = usersNotMe.filter(user => user._id != userId);
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

const adminName = 'Admin';
function ensureAuthenticated(req, res, next) {
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
const onlineUsers = [];
function updateStatus(userId){
  const index = onlineUsers.findIndex(u => u.userId === userId);
  if (index !== -1) {
    onlineUsers.splice(index, 1)[0];
  }
  const onlineUser ={userId,lastHeartbeat:new Date()};
  onlineUsers.push(onlineUser)
}
io.on("connection", (socket) => {
  socket.on('login', ( userId ) => {
    updateStatus(userId);
    socket.broadcast.emit('onlineUser', userId);
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
        io.to(user.room).emit('roomUsers', {
          room: user.room,
          users: userInRoom
        });
      })
      updateStatus(username);
      socket.broadcast.emit('onlineUser', username);
      const messages = await Message.find({ roomId: room });
      messages.sort((a, b) => a.createdAt - b.createdAt);
  
      for (const message of messages) {
        const user = await User.findById(message.senderId);
        const formattedTime = moment(message.createdAt).format('HH:mm');
        if (message.messageType === 'text') {
          io.to(socket.id).emit('message', formatMessage(user.fullName, message.content, '', formattedTime));
  
        } else if (message.messageType === 'image') {
          const dotIndex = message.content.lastIndexOf(".");
          const fileName = message.content.substring(0, dotIndex);
          const extension = message.content.substring(dotIndex + 1);
  
          io.to(socket.id).emit('message', formatMessage(user.fullName, fileName, extension, formattedTime));
        }
        else if (message.messageType === 'audio')
        {
          const dotIndex = message.content.lastIndexOf(".");
          const fileName = message.content.substring(0, dotIndex);
          const extension = message.content.substring(dotIndex + 1);
  
          io.to(socket.id).emit('message', formatMessage(user.fullName, fileName, extension, formattedTime));
        }
      }
    } catch (error) {
      console.error(error);
    }
  });

  socket.on('chatMessage', (msg) => {
      const user = getCurrentUser(socket.id);
      if(!user)
      {
        socket.emit('message', formatMessage(adminName, 'You are not in a room, please join a room or user first','',moment().format('h:mm a')));
        return;
      }
      updateStatus(user.userId);
      socket.broadcast.emit('onlineUser', user.userId);
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
  socket.on('getUserHangUp',(myPeerUserId) => {
    const user = getAnotherUser(myPeerUserId);
    if(user)
    {
      io.to(user.id).emit('handUp');
    }
  })
  //Handle Send Voice
  socket.on('voiceUpload', (data) => {
    const audioBuffer = Buffer.from(data.audio, 'binary');
    const fileName = `file_${Date.now()}`;
    fs.writeFile(`uploads/voice/${fileName}.webm`, audioBuffer, (err) => {
      if (err) {
        console.error('Error saving audio file:', err);
      } else {
        console.log('Audio file saved successfully');
        const user = getCurrentUser(socket.id);
          const message = new Message({
            roomId: user.room,
            senderId: user.userId,
            content: `${fileName}.webm`,
            messageType: 'audio'
          });
          message.save();
          io.to(user.room).emit('message', formatMessage(user.username, `${fileName}`,`webm`,moment().format('h:mm a')));
        }
      });
    });
    //End Handle Send Voice
    //Handle Send Image
    socket.on('imageUpload', (fileData) => {
      
      const buffer = Buffer.from(fileData);
      const fileName = `file_${Date.now()}`;
      const fileExtension = getFileExtensionFromBuffer(buffer);
      fs.writeFile(`uploads/image/${fileName}.${fileExtension}`, buffer, (err) => {
        if (err) {
          console.error('Lỗi lưu file:', err);
        } else {
          console.log('File đã được lưu:', fileName);
          const user = getCurrentUser(socket.id);
          const message = new Message({
            roomId: user.room,
            senderId: user.userId,
            content: `${fileName}.${fileExtension}`,
            messageType: 'image'
          });
          message.save();
          io.to(user.room).emit('message', formatMessage(user.username, `${fileName}`,`${fileExtension}`,moment().format('h:mm a')));
        }
      });
    });
    // End Handle Send Image
    
    //Handle Video Call
    socket.on('getPeerId', (myPeerUserId) => {
      const user = getAnotherUser(myPeerUserId);
      console.log(user);
      if(user)
      {
        io.to(socket.id).emit('getPeerIdSuccess', user.id);
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
  // End Handle Video Call

  //Handle Disconnect
  setInterval(() => {
    const now = Date.now();
    onlineUsers.forEach((user, index) => {
      if (now - user.lastHeartbeat > 30000) {
        // user has been inactive for more than 30 seconds, remove from onlineUsers
        onlineUsers.splice(index, 1);
        User.updateOne({ _id: user.userId }, { $set: { status: 'offline' } }).then(() => {
        })
        socket.broadcast.emit('offlineUser', user.userId);
      }
    });
  }, 60000);
  socket.on('heartbeat', (userId) => {
    console.log(onlineUsers)
    const user = onlineUsers.find(u => u.id === userId);
    if (user) {
      user.lastHeartbeat = Date.now();
  }

  });
  socket.on('logout',(userId) =>{
    onlineUsers.forEach((user, index) => {
          onlineUsers.splice(index, 1);
          User.updateOne({ _id: userId }, { $set: { status: 'offline' } }).then(() => {
          })
          socket.broadcast.emit('offlineUser', userId);
        }
      );
  })
  socket.on('disconnect', () => {
      const user = userLeave(socket.id);
      if(user)
      {
          io.to(user.room).emit('message', formatMessage(adminName, `${user.username} has left the chat`,'',moment().format('h:mm a')));
          User.find({rooms : user.room}).then(userInRoom => {
            io.to(user.room).emit('roomUsers', {
              room: user.room,
              users: userInRoom
            });
          })
      }
  });
  //End Handle Disconnect
});

app.post('/me/update', upload.single('avatar'), async (req, res) => {
  const userId = req.session.passport.user;
  try {
    const user = await User.findById(userId);
    if(req.file){
      console.log(req.file.originalname);
      console.log(user.avatar);
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








const port = 3000;
server.listen(port, () => {
console.log(`Server đang lắng nghe trên cổng ${port}`);
});
   
