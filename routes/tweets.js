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

require('dotenv').config();
const AWS = require('aws-sdk');

const bucketName = 'cab432-sentimental-store';
// Create a promise on S3 service object
const bucketPromise = new AWS.S3({apiVersion: '2006-03-01'}).createBucket({Bucket: bucketName}).promise();
bucketPromise.then(function(data) {
 console.log("Successfully created " + bucketName);
})
.catch(function(err) {
 console.error(err, err.stack);
});

const twitterBearer = "AAAAAAAAAAAAAAAAAAAAAB1nTwEAAAAAEqfb8heiH9EgfW7lOr4iUA7HxNo%3DBy9wMBOxD4qHviYQntmdGue3yDDlAGIXATf9iWfNBb4uq9QV8w";
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';

let searchTerm ="";
var sentimentalValue;

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
async function streamConnect(retryAttempt) {
    //sentimentalValue = await sentiment.readCSV();
    stream.on('data', data => {
        try {
            const json = JSON.parse(data);
            let output = Number(sentiment.sentimentalAnalysis(json.data.text.split(" ")));

            //Get array of sentimental values for each term and save it to csv file
            sentimentalValue = sentiment.updateCSV(searchTerm, Math.sign(output), sentimentalValue);
            // A successful connection resets retry count.
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail);
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
        //save csv into redis and s3
        if (sentimentalValue) {
            for (let i = 0; i < sentimentalValue.length; i++) {
                client.hmset(sentimentalValue[i].search, {
                    'score': sentimentalValue[i].score,
                    'total': sentimentalValue[i].total
                });

                const body = {'score': sentimentalValue[i].score, 'total': sentimentalValue[i].total};
                const objectParams = {Bucket: bucketName, Key: `database-` + sentimentalValue[i].search, Body: JSON.stringify(body)};
                const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();
                uploadPromise.then(function(data) {
                    console.log("Successfully uploaded data to " + bucketName + "/" + `database-` + sentimentalValue[i].search);
                });

                console.log("saved "+sentimentalValue[i].search +" into redis.");
            }
        }

        //close stream
        stream.destroy();
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
        try {
            searchTerm = req.query.rules;
            sentimentalValue = sentiment.readCSV();

            //Check Redis/other storage for the term
            client.hgetall(searchTerm, async function(err, result) {
            //If that key exists in Redis Storage
                if (result) {
                    console.log ("term in redis " + result.score);
                    //check if searchterm already in csv                   
                    if (sentiment.checkCSV(searchTerm, sentimentalValue) === true) {
                        //return back true
                        console.log("Term is already in csv");
                    }
                    else {
                        let fullData = {'search': searchTerm, 'score': result.score, 'total': result.total};
                        console.log(searchTerm + " is in cache: "+result.score);
                        console.log(fullData.search + " adding it to csv");
                        sentimentalValue = sentiment.addCSV(fullData);
                        
                        sentimentalValue = sentiment.readCSV();
                    }

                    // Gets the complete list of rules currently applied to the stream
                    let currentRules = await getAllRules();
                    //console.log("current rules: " + currentRules)
            
                    // Delete all rules. Comment the line below if you want to keep your existing rules.
                    await deleteAllRules(currentRules);
                    console.log("deleted all rules");
            
                    // Add rules to the stream. Comment the line below if you don't want to add new rules.
                    await setRules(searchTerm);
                    console.log("rules have been added to stream");

                    console.log("begin stream");
                    streamConnect(0);
                }
                //Check S3 bucket
                else {
                    const s3Key = `database-` + searchTerm;
                    // Check S3
                    const params = { Bucket: bucketName, Key: s3Key};

                    new AWS.S3({apiVersion: '2006-03-01'}).getObject(params, async(err, result) => {
                        if (result) {
                            // Serve from S3
                            const resultJSON = JSON.parse(result.Body);
                            console.log("this from s3" + resultJSON);
                            console.log(resultJSON);

                            //check if term is in csv file
                            if (sentiment.checkCSV(searchTerm, sentimentalValue) === true) {
                                //return back true
                                console.log("Term is already in csv");
                            }
                            else {
                                let fullData = {'search': searchTerm, 'score': resultJSON.score, 'total': resultJSON.total};
                                console.log(fullData.search + " adding it to csv");
                                sentimentalValue = sentiment.addCSV(fullData);
                                
                                sentimentalValue = sentiment.readCSV();
                            }


                            // Gets the complete list of rules currently applied to the stream
                            let currentRules = await getAllRules();
                            //console.log("current rules: " + currentRules)
                    
                            // Delete all rules. Comment the line below if you want to keep your existing rules.
                            await deleteAllRules(currentRules);
                            console.log("deleted all rules");
                    
                            // Add rules to the stream. Comment the line below if you don't want to add new rules.
                            await setRules(searchTerm);
                            console.log("rules have been added to stream");

                            console.log("begin stream");
                            streamConnect(0);
                        } 
                        else {
                            // Gets the complete list of rules currently applied to the stream
                            let currentRules = await getAllRules();
                            //console.log("current rules: " + currentRules)
                    
                            // Delete all rules. Comment the line below if you want to keep your existing rules.
                            await deleteAllRules(currentRules);
                            console.log("deleted all rules");
                    
                            // Add rules to the stream. Comment the line below if you don't want to add new rules.
                            await setRules(searchTerm);
                            console.log("rules have been added to stream");

                            console.log("begin stream");
                            streamConnect(0);
                        }
                    })

                }
            });
            // // Gets the complete list of rules currently applied to the stream
            // let currentRules = await getAllRules();
            // //console.log("current rules: " + currentRules)
    
            // // Delete all rules. Comment the line below if you want to keep your existing rules.
            // await deleteAllRules(currentRules);
            // console.log("deleted all rules");
    
            // // Add rules to the stream. Comment the line below if you don't want to add new rules.
            // await setRules(searchTerm);
            // console.log("rules have been added to stream");
    
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
        res.redirect('/');
    
        //Begin the stream
        // console.log("begin stream");
        // streamConnect(0);
    }
})

module.exports = router;