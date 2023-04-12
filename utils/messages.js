const moment = require('moment');
function formatMessage(username, text, fileType) {
  return {
    username,
    text,
    fileType,
    time: moment().format('h:mm a')
  };
}

module.exports = formatMessage;