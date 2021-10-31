const express = require('express');
//const axios = require('axios');
const tweetRouter = require('./routes/tweets');
const URL = require('url');
const app = express();


//First Screen/ Main menu
app.use(express.static(__dirname + '/public'));

//Home page
app.get('/', function (req, res) {
    
})


//Finding Tweets/ filtered stream
app.use('/search/', tweetRouter);







console.log('Listening on 3000');
app.listen(3000);