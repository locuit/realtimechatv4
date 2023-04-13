const mongoose = require('mongoose');
const messageSchema = new mongoose.Schema({
    roomId: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Room' }], 
    senderId:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'}],

    content: { type: String, required: true },
    messageType: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Create Message model from schema
const Message = mongoose.model('Message', messageSchema);

// Export Message model
module.exports = Message;