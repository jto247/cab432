"use strict";
const express = require('express');
const https = require('https');
const router = express.Router();
const axios = require('axios');
const needle = require('needle');
const sentiment = require('../scripts/sentiment');
const Analyzer = require('natural').SentimentAnalyzer;
const stemmer = require('natural').PorterStemmer;
const analyzer = new Analyzer("English", stemmer, "afinn");
const redis = require('redis');

const twitterBearer = "AAAAAAAAAAAAAAAAAAAAAB1nTwEAAAAAWeK9qu%2FjYAU%2FcXOWtIjgT5Hm3Ro%3DIRLYCxx6AkSUwGL9HCjoFMDbeD8OqH2zU9ycqXkEb4WrjZ3dUv";
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';

let searchTerm ="";
let sentimentalValue = [];

const redisPort = '6379'; // Port
const redisName = 'redis' // Name of Redis

let stream = needle.get(streamURL, {
    headers: {
        "User-Agent": "v2FilterStreamJS",
        "Authorization": `Bearer ` +twitterBearer
    },
    timeout: 200
});

//Create and connect redis client to local instance
let client = redis.createClient();

client.on('connect', function(){
	console.log('Connected to Redis...');
});
client.on('error', (err) => {
    console.log("Redis Error " + err);
});


//Built upon from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/main/Filtered-Stream/filtered_stream.js
async function getAllRules() {

    const response = await needle('get', rulesURL, {
        headers: {
            "authorization": 'Bearer ' + twitterBearer
        }
    })

    if (response.statusCode !== 200) {
        console.log("Error:", response.statusMessage, response.statusCode)
        throw new Error(response.body);
    }

    //console.log(response.body);
    return (response.body);
}

//Built upon from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/main/Filtered-Stream/filtered_stream.js
async function deleteAllRules(rules) {

    if (!Array.isArray(rules.data)) {
        return null;
    }

    const ids = rules.data.map(rule => rule.id);

    const data = {
        "delete": {
            "ids": ids
        }
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": 'Bearer ' + twitterBearer
        }
    })

    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }

    return (response.body);

}

//Built upon from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/main/Filtered-Stream/filtered_stream.js
async function setRules(value) {

    const data = {
       'add': [{'value': value}]
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": 'Bearer ' + twitterBearer
        }
    })

    if (response.statusCode !== 201) {
        throw new Error(response.body);
    }

    return (response.body);

}

//Function to connect to stream
//Retrieved from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/b3e13798ae1093251f6b03830e4c30b5002e3c46/Filtered-Stream/filtered_stream.js#L145
function streamConnect(retryAttempt) {
    stream.on('data', data => {
        try {
            const json = JSON.parse(data);
            let output = Number(sentiment.sentimentalAnalysis(json.data.text.split(" ")));

            //Get array of sentimental values for each term and save it to csv file
            sentimentalValue = sentiment.updateCSV(searchTerm, Math.sign(output), sentimentalValue);
            sentiment.saveCSV(sentimentalValue);
            // A successful connection resets retry count.
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(e);
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

router.get('', async function(req,res) {

    //destroy stream
    if (req.query.rules == "stopstream") {
        stream.destroy();
        //console.log(sentimentalValue[0].search);

        if (sentimentalValue) {
            for (let i = 0; i < sentimentalValue.length; i++) {
                client.hmset(sentimentalValue[i].search, {
                    'score': sentimentalValue[i].score,
                    'total': sentimentalValue[i].total
                });
                console.log("saved "+sentimentalValue[i].search +" into redis.");
            }
        }

    //save the csv data into redis/other storage

    console.log("close twitter stream");
    stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ` +twitterBearer
        },
        timeout: 200
    });
    res.redirect('/');
    }
    else if(req.query.rules == "resetcsv") {
        sentiment.resetCSV();
        res.redirect('/');
    } 
    else {
        //Check Redis/other storage for the term
        // client.hgetall(searchTerm, async function(err, result){
        //     //If that key exists in Redis Storage
        //     if (result) {
        //         //check if searchterm already in csv
        //         if (sentiment.checkCSV(searchTerm)) {
        //             //return back true
        //             console.log("Term is already in csv");
        //         }
        //         else {
        //             console.log(searchTerm + " is in cache: "+result);
        //             console.log("adding it to csv");
        //             sentiment.addCSV(searchTerm, result);
        //             sentimentalValue = await sentiment.readCSV();
        //         }
        //     }
        // })
        try {
            sentimentalValue = sentiment.readCSV();
            searchTerm = req.query.rules;
            // Gets the complete list of rules currently applied to the stream
            let currentRules = await getAllRules();
            //console.log("current rules: " + currentRules)
    
            // Delete all rules. Comment the line below if you want to keep your existing rules.
            await deleteAllRules(currentRules);
            console.log("deleted all rules");
    
            // Add rules to the stream. Comment the line below if you don't want to add new rules.
            await setRules(searchTerm);
    
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    
        //Begin the stream
        streamConnect(0);
    }
})

module.exports = router;