
function formatMessage(username, text, fileType,time) {
  return {
    username,
    text,
    fileType,
    time,
  };
}

module.exports = formatMessage;