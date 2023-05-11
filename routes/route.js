const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Room = require('../models/room');
const passport = require('../passport/passport-config.js');
const bcrypt = require('bcrypt');
const multer = require('multer');
const firebase = require('firebase/app');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
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

const Redis = require('ioredis');
const client = new Redis({
    host: 'redis-11490.c295.ap-southeast-1-1.ec2.cloud.redislabs.com',
    port: 11490,
    username: 'default',
    password: 'ZzbFUmwQEXe6rQIbxZoempgvTqOrUjm9',
});
router.use(bodyParser.urlencoded({ extended: false }));

router.use(session({
  secret: 'locuit',
  resave: false,
  saveUninitialized: false
}));
router.use(passport.initialize());
router.use(passport.session());
router.use(flash());


router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);
router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/auth/google/callback', passport.authenticate('google'));
router.get('/auth/facebook/callback', passport.authenticate('facebook'));
router.get('/', (req, res) => {
    res.render('login.ejs', { message: req.flash('error') });
});
router.get('/login', (req, res) => {
    res.render('login.ejs', { message: req.flash('error') });
});
router.get('/register', (req, res) => {
    res.render('register.ejs', { message: req.flash('error') });
});
  router.get('/google/callback', passport.authenticate('google', {
    successRedirect: '/chat', // Đường dẫn sau khi đăng nhập thành công
    failureRedirect: '/login', // Đường dẫn sau khi đăng nhập thất bại
    failureFlash: true,
  }));
  router.get('/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/chat', // Đường dẫn sau khi đăng nhập thành công
    failureRedirect: '/login', // Đường dẫn sau khi đăng nhập thất bại
    failureFlash: true,
  }));
  router.post('/auth/register', passport.authenticate('local-register', {
    successRedirect: '/chat',
    failureRedirect: '/register',
    failureFlash: true,
  }));
  router.post('/auth/login', passport.authenticate('local-login', {
  successRedirect: '/chat', 
  failureRedirect: '/login', 
  failureFlash: true,
  }));
  
  router.post('/logout', async (req, res) => {
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
  
  router.get('/videocall', ensureAuthenticated, (req, res) => {
    res.render('videocall.ejs');
  });
  
  router.get('/chat', ensureAuthenticated, (req, res) => {
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
  
  router.get('/me', (req, res) => {
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
  router.post('/me/update', upload.single('avatar'), async (req, res) => {
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
if (req.isAuthenticated()) {
    return next();
}  
res.render('login.ejs', { message: req.flash('error') });

}  
module.exports = router;