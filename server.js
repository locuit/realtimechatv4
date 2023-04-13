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
const { userJoin, getCurrentUser,userLeave,getRoomUsers} = require('./utils/users');
dotenv.config();
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// Khởi tạo middleware multer để xử lý file upload 
const fs = require('fs');
// Sử dụng middleware socketio-file-upload để xử lý file upload thông qua Socket.IO
const moment = require('moment');



const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server);

// Khởi tạo ứng dụng Express


app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static(path.join(__dirname, 'models')));
app.use(express.static(path.join(__dirname, 'uploads')));



mongoose.connect(process.env.MONGO_URL, { 
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(console.log('DB Connection Successful!')).catch(err => {console.log(err)});

// Cấu hình bodyParser để đọc dữ liệu từ form
app.use(bodyParser.urlencoded({ extended: false }));

// Cấu hình session và passport
app.use(session({
  secret: 'locuit', // Khóa bí mật để mã hóa session
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
      const newUser = new User({
        username: username,
        password: password,
        fullName: fullname,
      });
      await newUser.save();
      return done(null, newUser);
    }
  } catch (error) {
    return done(error);
  }
}));
// Route để bắt đầu quá trình đăng nhập Google
app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

app.get('/auth/google/callback', passport.authenticate('google'));
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID, 
  clientSecret: process.env.GOOGLE_CLIENT_SECRET, 
  callbackURL: 'http://localhost:3000/google/callback'
}, (accessToken,refreshToken,profile,done) => {
    // Check if google profile exist.
    if (profile.id) {
      User.findOne({googleId: profile.id})
        .then((existingUser) => {
          if (existingUser) {
            done(null, existingUser);
          } else {
            new User({
              username: profile.emails[0].value.split('@')[0],
              googleId: profile.id,
              email: profile.emails[0].value,
              fullName: profile.displayName,
            })
              .save()
              .then(user => done(null, user));
          }
        })
  }
}));

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
const adminName = 'Admin';

app.post('/logout', (req, res) => {
  const userId = req.session.passport.user;
  console.log(userId);
  User.findById(userId)
  .then(user => {
    user.status = 'offline';
    console.log(user);
    user.save();
  })
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
  });
});


app.get('/chat', ensureAuthenticated, (req, res) => {
  const userId = req.session.passport.user;
  User.findById(userId)
  .then(user => {
    user.status = 'online';
    console.log(user);
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
            res.render('chat.ejs', {users: filteredUsers, user: userIsMe, rooms: rooms});
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

});


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
  console.log(privateRoom);
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
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
      const messages = await Message.find({ roomId: room });
      messages.sort((a, b) => a.createdAt - b.createdAt);
  
      for (const message of messages) {
        const user = await User.findById(message.senderId);
        const formattedTime = moment(message.createdAt).format('HH:mm');
        if (message.messageType === 'text') {
          // render all message for me 
          io.to(socket.id).emit('message', formatMessage(user.fullName, message.content, '', formattedTime));
  
        } else if (message.messageType === 'file') {
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
      //Lưu message vào database
      console.log(user);
      
      const message = new Message({
        roomId: user.room,
        senderId: user.userId,
        content: msg,
        messageType: 'text'
      });
      message.save();
      io.to(user.room).emit('message', formatMessage(user.username, msg,'',moment().format('h:mm a')));
  });

  socket.on('disconnect', () => {
      const user = userLeave(socket.id);
      if(user)
      {
          io.to(user.room).emit('message', formatMessage(adminName, `${user.username} has left the chat`));
          io.to(user.room).emit('roomUsers', {
              room: user.room,
              users: getRoomUsers(user.room)
          });
      }
  });
  socket.on('uploadFile', (fileData) => {

      const buffer = Buffer.from(fileData);
      const fileName = `file_${Date.now()}`;
      const fileExtension = getFileExtensionFromBuffer(buffer);
      fs.writeFile(`uploads/${fileName}.${fileExtension}`, buffer, (err) => {
        if (err) {
          console.error('Lỗi lưu file:', err);
          socket.emit('uploadError', 'Lỗi lưu file');
        } else {
          console.log('File đã được lưu:', fileName);
          const user = getCurrentUser(socket.id);
          const message = new Message({
            roomId: user.room,
            senderId: user.userId,
            content: `${fileName}.${fileExtension}`,
            messageType: 'file'
          });
          message.save();
          io.to(user.room).emit('message', formatMessage(user.username, `${fileName}`,`${fileExtension}`));
        }
      });
  });
});

const port = 3000;
server.listen(port, () => {
console.log(`Server đang lắng nghe trên cổng ${port}`);
});
   
