const mongoose = require('mongoose');

const privateRoomSchema = new mongoose.Schema({
  user1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Tham chiếu đến schema User (nếu có)
  },
  user2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Tham chiếu đến schema User (nếu có)
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const PrivateRoom = mongoose.model('PrivateRoom', privateRoomSchema);

module.exports = PrivateRoom;
