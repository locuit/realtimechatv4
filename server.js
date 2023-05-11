const express = require('express');
const http = require('http');
const app = express();
var path = require('path')
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const server = http.createServer(app)
require('./socket/socket')(server)
const routes = require('./routes/route.js')
const cors = require('cors');
const port = 3000;

mongoose.connect(process.env.MONGO_URL, { 
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(console.log('DB Connection Successful!')).catch(err => {console.log(err)});
app.use(cors());
app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static(path.join(__dirname, 'models')));
app.use(express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'uploads/voice')));
app.use(express.static(path.join(__dirname, 'uploads/image')));
app.use('/', routes);

server.listen(port, () => {
console.log(`Server is running on port ${port}`);
});
