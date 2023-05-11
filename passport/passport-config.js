const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/user');
passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: 'http://localhost:3000/facebook/callback',
        profileFields: ['id', 'displayName', 'photos', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if facebook profile exist.
          if (profile.id) {
            const existingUser = await User.findOne({ facebookId: profile.id });
            if (existingUser) {
              done(null, existingUser);
            } else {
              const newUser = new User({
                username: profile.emails[0].value.split('@')[0] + 'fb',
                facebookId: profile.id,
                email: profile.emails[0].value,
                fullName: profile.displayName,
                avatar: `https://avatars.dicebear.com/api/avataaars/${profile.id}.svg`,
              });
              await newUser.save();
              done(null, newUser);
            }
          }
          console.log(profile);
        } catch (error) {
          done(error);
        }
      }
    )
  );

  passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'https://chatchat.onrender.com/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (profile.id) {
          const existingUser = await User.findOne({ googleId: profile.id });
          if (existingUser) {
            done(null, existingUser);
          } else {
            const newUser = new User({
              username: profile.emails[0].value.split('@')[0] + 'gg',
              googleId: profile.id,
              email: profile.emails[0].value,
              fullName: profile.displayName,
              avatar: `https://avatars.dicebear.com/api/avataaars/${profile.id}.svg`,
            });
            await newUser.save();
            done(null, newUser);
          }
        }
      } catch (error) {
        done(error);
      }
    }
  )
);

passport.use(
  'local-register',
  new LocalStrategy(
    {
      username: 'username',
      password: 'password',
      passReqToCallback: true,
    },
    async (req, username, password, done) => {
      const { fullname } = req.body;
      try {
        const user = await User.findOne({ username: username });
        if (user) {
          console.log('Tên người dùng đã tồn tại');
          return done(null, false, { message: 'Tên người dùng đã tồn tại' });
        } else {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          const newUser = new User({
            username: username,
            password: hashedPassword,
            fullName: fullname,
            avatar: `https://avatars.dicebear.com/api/avataaars/${username}.svg`,
          });
          await newUser.save();
          return done(null, newUser);
        }
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.use(
  'local-login',
  new LocalStrategy(
    {
      username: 'username',
      password: 'password',
    },
    async (username, password, done) => {
      try {
        const user = await User.findOne({ username: username });
        if (!user) {
          return done(null, false, { message: 'Tên người dùng không hợp lệ' });
        }
        if (!user.isValidPassword(password)) {
          return done(null, false, { message: 'Mật khẩu không đúng' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);
  module.exports = passport;