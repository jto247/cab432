const express = require('express');
const https = require('https');
const router = express.Router();
const axios = require('axios');
const needle = require('needle');
const Analyzer = require('natural').SentimentAnalyzer;
const stemmer = require('natural').PorterStemmer;
const analyzer = new Analyzer("English", stemmer, "afinn");

const twitterBearer = "AAAAAAAAAAAAAAAAAAAAAB1nTwEAAAAAiIXMeU%2BG0%2BNwtjNabjDMsW9ZsIA%3DKhtmxlbRsEUVTEewUsHP3rvSzQxqiQzjLtbqRGRJ1oDE6HHKzo";
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';


//Function to connect to stream
//Retrieved from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/b3e13798ae1093251f6b03830e4c30b5002e3c46/Filtered-Stream/filtered_stream.js#L145
function streamConnect(retryAttempt) {

    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ` +twitterBearer
        },
        timeout: 200
    });

    stream.on('data', data => {
        try {

            //Maybe save this somewhere? and then perfrom analysis on it
            const json = JSON.parse(data);
            console.log(json);
            console.log(analyzer.getSentiment(json.data.text.split(" ")));
            // A successful connection resets retry count.
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail)
                process.exit(1)
            } else {
                // Keep alive signal received. Do nothing.
            }
        }
    }).on('err', error => {
        if (error.code !== 'ECONNRESET') {
            console.log(error.code);
            process.exit(1);
        } else {
            // This reconnection logic will attempt to reconnect when a disconnection is detected.
            // To avoid rate limits, this logic implements exponential backoff, so the wait time
            // will increase if the client cannot reconnect to the stream. 
            setTimeout(() => {
                console.warn("A connection error occurred. Reconnecting...")
                streamConnect(++retryAttempt);
            }, 2 ** retryAttempt)
        }
    });

    return stream;

}

router.get('', function(req,res) {
    //Set the rules to the stream
    axios({
        method: 'POST',
        url:"https://api.twitter.com/2/tweets/search/stream/rules",
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Bearer ' + twitterBearer
        },
        data: {
            'add': [{'value': req.query.rules}]
        }
    })
    //shows the applied rules
    .then ((response) => {
        const rsp = response.data;
    })

    .catch((error) => {
        if( error.response ){
            console.log(error.response.data); // => the response payload 
        }
    });
    
    //Begin the stream
    streamConnect(0);


})

module.exports = router;