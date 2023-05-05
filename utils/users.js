
const users = [];

function userJoin(id, username, room, userId) {
  const user = { id, username, room , userId };
  const index = users.findIndex(user => user.id === id);
  if (index !== -1) {
    users.splice(index, 1);
  }
  users.push(user);
  return user;
}

function getCurrentUser(id) {
  return users.find(user => user.id === id);
}

function userLeave(id) {
  const index = users.findIndex(user => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}
function getAnotherUser(myPeerUserId) {
  return users.find(user => user.userId === myPeerUserId);
}
function getRoomUsers(room) {
    return users.filter(user => user.room === room);
}
module.exports = {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
    getAnotherUser
}