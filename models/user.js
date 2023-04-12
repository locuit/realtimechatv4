const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    username: {
        type: String, 
        required: true, 
        unique: true
    },
    password: {
        type: String, 
        required: true
    },
    fullName: {
        type: String, 
    },
    avatar: {
        type: String, 
        default: ''
    },
    rooms: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Room' }]
},
    {timestamps: true}
);
UserSchema.methods.isValidPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
}
const User = mongoose.model('User', UserSchema, 'users');

module.exports = User;
