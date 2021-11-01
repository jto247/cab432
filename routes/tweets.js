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

const { io } = require("socket.io-client");



const socket = io("ws://localhost:3001");
socket.on('connect', function() {
    console.log('Connected to Stream Server');
})


socket.on('newTweet', (json) => {
    console.log(json);

    if (json.matching_rules[0].id == rulesID) {
        //sentimental analysis on tweet
        let output = Number(sentiment.sentimentalAnalysis(json.data.text.split(" ")));
        //Get array of sentimental values for each term and save it to csv file
        sentimentalValue = sentiment.updateCSV(searchTerm, Math.sign(output), sentimentalValue);
    }

})


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

const twitterBearer = "AAAAAAAAAAAAAAAAAAAAAG5VVQEAAAAATXVIxiA19xSIYMtrzdq9sWW1YKE%3DBlPj2vJwoa97lw66BNGQnxZhPt8lZ2ep8s1JVqVVCfZFnwKceM";
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';

let searchTerm ="";
let rulesID = "";
var sentimentalValue;

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

    //console.log(response.body);
    if (response.statusCode !== 200) {
        console.log("Error:", response.statusMessage, response.statusCode)
        throw new Error(response.body);
    }
    if (response.body.data) {
        for (let i = 0; i < response.body.data.length; i++) {
            if (response.body.data[i].value == searchTerm) {
                rulesID = response.body.data[i].id;
            }
        }
    }
    
    //console.log(matchRules);
    return (response.body);
}

router.get('', async function(req,res) {
    
    //destroy stream
    if (req.query.rules == "stopstream") {
        //save csv into redis and s3
        
        //console.log("before removal unique: " + sentimentalValue);
        if (sentimentalValue) {
            sentimentalValue = sentiment.updateCSV(searchTerm, 0, sentimentalValue)
            //Remove duplicates
            sentimentalValue = sentimentalValue.reduce((unique, o) => {
                if(!unique.some(obj => obj.search === o.search)) {
                  unique.push(o);
                }
                return unique;
            },[]);

        //Final save to csv
        sentiment.saveCSV(sentimentalValue);

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
            socket.emit('newRule', searchTerm);
            await getAllRules();

            //Check Redis/other storage for the term
            client.hgetall(searchTerm, async function(err, result) {
            //If that key exists in Redis Storage
                if (result) {
                    console.log ("term in redis " + result.score);
                    //check if searchterm already in csv                   
                    if (sentiment.checkCSV(searchTerm, sentimentalValue) === true) {
                        //return back true
                        console.log("Term is already in csv (redis)");
                    }
                    else {
                        let fullData = {'search': searchTerm, 'score': result.score, 'total': result.total};
                        sentimentalValue = sentiment.addCSV(fullData);
                        
                        sentimentalValue = sentiment.readCSV();
                    }
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
                            console.log("this from s3");
                            console.log(resultJSON);

                            //check if term is in csv file
                            if (sentiment.checkCSV(searchTerm, sentimentalValue) === true) {
                                //return back true
                                console.log("Term is already in csv (S3)");
                            }
                            else {
                                let fullData = {'search': searchTerm, 'score': resultJSON.score, 'total': resultJSON.total};
                                console.log(fullData.search + " adding it to csv");
                                sentimentalValue = sentiment.addCSV(fullData);
                                
                                sentimentalValue = sentiment.readCSV();
                            }
                        } 
                        else {

                        }
                    })

                }
            });
    
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
        res.redirect('/show?='+searchTerm);

    }
})

module.exports = router;