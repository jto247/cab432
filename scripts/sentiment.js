const natural = require('natural')
const stemmer = natural.PorterStemmer
const Analyzer = require('natural').SentimentAnalyzer;
const analyzer = new Analyzer("English", stemmer, "afinn");
const tokenizer = new natural.WordTokenizer();
const csv = require('csv-parser');
const fs = require('fs');

const createCSVWriter = require('csv-writer').createObjectCsvWriter;

const csvWriter = createCSVWriter( {
    path: '../cab432/public/test.csv',
    header: [
      {id: 'search', title:'search'},
      {id: 'score', title: 'score'},
      {id: 'total', title: 'total'}
    ]
  });

//Break down tweet into array and terms ready for sentimental analysis
function sentimentalAnalysis(text) {
    let output = analyzer.getSentiment(text);
    //console.log(output);
    return output;
}

async function checkCSV(searchTerm) {
    fs.createReadStream('../cab432/public/test.csv')
    .pipe(csv())
    .on('data', (row) => {
        if (row.search == searchTerm) {
            return true;
        }
        else {
            return false;
        }
    })
}

function readCSV() {
    let tableData = [];

    //Read from file
    fs.createReadStream('../cab432/public/test.csv')
    .pipe(csv())
    .on('data', (row) => {
        tableData.push(row);
    })
    .on('end', () => {
       console.log("Table has been written");
       console.log(tableData);
    });
    return tableData;
}

function updateCSV(word, value, data) {
        let exist = false;
        //Check the csv file for if the term already exists
        for(let i = 0; i < data.length; i++) {
                if (data[i].search == word) {
                    data[i].score = Number(data[i].score) + value;
                    data[i].total++;
                    exist = true;
                }
        }

        //If search term isnt in the database, push into the table data
        if (exist == false) {
            let obj ={};
            obj.search = word;
            obj.score = 1;
            obj.total = 1;
            data.push(obj);
        }

        console.clear();
        console.log(data);
        return data;

}

function resetCSV() {
    //Reset CSV file to input new entries
        fs.writeFileSync('../cab432/public/test.csv', "search,score,total\n");
        //console.log('The CSV file was reset');

}

function saveCSV(tableData) {
    //Write the new data
    resetCSV();
    csvWriter.writeRecords(tableData)
    .then( ()=> {
        //console.log('The CSV file was written Successfully');
        //console.log(tableData);
    });
}

//Adds one record to the tableData
function addCSV(searchTerm, data) {
    let fullData = {'search':searchTerm, 'score': data.score, 'total': data.total};
    csvWriter.writeRecords(fullData)
    .then( ()=> {
        console.log("data from Redis:" +fullData);
    });
}




module.exports.sentimentalAnalysis = sentimentalAnalysis;
module.exports.updateCSV = updateCSV;
module.exports.saveCSV = saveCSV;
module.exports.readCSV = readCSV;
module.exports.resetCSV = resetCSV;
module.exports.addCSV = addCSV;
module.exports.checkCSV = checkCSV;