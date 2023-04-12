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
var path = require('path')
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser,userLeave,getRoomUsers} = require('./utils/users');
dotenv.config();
// Khởi tạo middleware multer để xử lý file upload 

// Sử dụng middleware socketio-file-upload để xử lý file upload thông qua Socket.IO
const fs = require('fs');
const mime = require('mime');




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
  secret: 'secret-key', // Khóa bí mật để mã hóa session
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Cấu hình Local Strategy cho Passport
passport.use(new LocalStrategy({
  username: 'username',
  password:'password',
},
  async (username, password, done) => {
    try {
      const user = await User.findOne({ username: username }); // Tìm kiếm user trong cơ sở dữ liệu
      if (!user) {
        // Nếu không tìm thấy user, gọi done() với tham số đầu tiên là null và tham số thứ hai là false để đánh dấu user không hợp lệ
        console.log('Tên người dùng không hợp lệ');
        return done(null, false, { message: 'Tên người dùng không hợp lệ'});
      }
      // Kiểm tra mật khẩu
      if (!user.isValidPassword(password)) { // Giả sử User model có một phương thức isValidPassword() để kiểm tra mật khẩu
        // Nếu mật khẩu không đúng, gọi done() với tham số đầu tiên là null và tham số thứ hai là false để đánh dấu user không hợp lệ
        console.log('Mật khẩu không đúng');
        return done(null, false, { message: 'Mật khẩu không đúng' });
      }

      // Nếu user hợp lệ, gọi done() với tham số đầu tiên là null và tham số thứ hai là user để đánh dấu user hợp lệ
      return done(null, user);
    } catch (error) {
      // Xử lý lỗi nếu có
      return done(error);
    }
  }
));

// Serialize và Deserialize người dùng
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
    
// Cấu hình đường dẫn đăng nhập và đăng xuất
app.get('/login', (req, res) => {
  res.render('login.ejs', { message: req.flash('error') });
});


app.post('/auth/login', passport.authenticate('local', {
successRedirect: '/chat', // Đường dẫn sau khi đăng nhập thành công
failureRedirect: '/login', // Đường dẫn sau khi đăng nhập thất bại
failureFlash: true,
}));
const adminName = 'Admin';
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login'); // Đường dẫn sau khi đăng xuất
});

// io.on('connection', (socket) => {

//   socket.on('joinRoom', ({ username, room }) => {
//       console.log(username, room);
//       const user = userJoin(socket.id, username, room);
//       socket.join(user.room);

//       socket.broadcast.to(user.room).emit('message',formatMessage(adminName, `${user.username} has joined the chat`));

//       io.to(user.room).emit('roomUsers', {
//           room: user.room,
//           users: getRoomUsers(user.room)
//       });

//   });

//   socket.on('chatMessage', (msg) => {
//       const user = getCurrentUser(socket.id);

//       io.to(user.room).emit('message', formatMessage(user.username, msg));
//   });

//   socket.on('disconnect', () => {
//       const user = userLeave(socket.id);
//       if(user)
//       {
//           io.to(user.room).emit('message', formatMessage(adminName, `${user.username} has left the chat`));
//           io.to(user.room).emit('roomUsers', {
//               room: user.room,
//               users: getRoomUsers(user.room)
//           });
//       }
//   });
// }); 
// Cấu hình đường dẫn bảo vệ (nếu cần)
app.get('/chat', ensureAuthenticated, (req, res) => {
  const userId = req.session.passport.user;
  // Lấy danh sách tất cả user trong cơ sở dữ liệu
  User.find({})
    .then(usersNotMe => {
      // Lọc ra danh sách các user khác với user hiện tại
      const filteredUsers = usersNotMe.filter(user => user._id != userId);
      User.findById(userId)
      .then(userIsMe => {
        // Lấy danh sách các phòng chat mà người dùng hiện tại đã lưu
        const savedRooms = userIsMe.rooms;
        // Tìm các phòng chat trong bảng Room dựa trên danh sách các phòng đã lưu
        Room.find({ _id: { $in: savedRooms } })
        .then(rooms => {
            // Render trang chat.ejs với danh sách các phòng chat đã lưu
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

  //   })

});

// Middleware xác thực
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

  await privateRoom.save(); // Lưu private room vào cơ sở dữ liệu
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
          socket.emit('privateRoom',room._id);
        })
      }
    })
    
  })

  socket.on('joinRoom', ({ username, room }) => {
    User.findById(username).then( userFullName => {

    const user = userJoin(socket.id, userFullName.fullName, room);
        socket.join(user.room);

        socket.broadcast.to(user.room).emit('message',formatMessage(adminName, `${user.username} has joined the chat`));
        io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room)
        });

    })
    

  });
    
  
  socket.on('chatMessage', (msg) => {
      const user = getCurrentUser(socket.id);

      io.to(user.room).emit('message', formatMessage(user.username, msg));
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
      // Tạo buffer từ dữ liệu file
      const buffer = Buffer.from(fileData);
      
      // Đặt tên cho file dựa trên thời gian hiện tại
      const fileName = `file_${Date.now()}`;
      const fileExtension = getFileExtensionFromBuffer(buffer);
      // Lưu buffer vào thư mục 'uploads'
      fs.writeFile(`uploads/${fileName}.${fileExtension}`, buffer, (err) => {
        if (err) {
          console.error('Lỗi lưu file:', err);
          // Gửi thông báo lỗi về cho client nếu cần
          socket.emit('uploadError', 'Lỗi lưu file');
        } else {
          console.log('File đã được lưu:', fileName);
          // Gửi thông báo thành công về cho client nếu cần
          const user = getCurrentUser(socket.id);
          io.to(user.room).emit('message', formatMessage(user.username, `${fileName}`,`${fileExtension}`));
        }
      });
    // Tại đây, bạn có thể xử lý file đã được upload, ví dụ như lưu thông tin file vào cơ sở dữ liệu, thực hiện các thao tác xử lý hình ảnh, hoặc gửi lại thông tin file đã được upload cho client để xử lý tiếp theo.
  });
});
 // Khởi động server
const port = 3000; // Hoặc cổng số khác tuỳ ý
server.listen(port, () => {
console.log(`Server đang lắng nghe trên cổng ${port}`);
});
   
