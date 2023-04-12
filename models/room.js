// room.js - File model room

// Import module mongoose để tương tác với MongoDB
const mongoose = require('mongoose');

// Định nghĩa schema cho model Room
const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  roomName: {
    type: String,
    required: true
  }
});

const Room = mongoose.model('Room', roomSchema, 'room');
// Export model Room
module.exports = Room;
