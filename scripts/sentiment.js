const natural = require('natural')
const stemmer = natural.PorterStemmer
const Analyzer = require('natural').SentimentAnalyzer;
const analyzer = new Analyzer("English", stemmer, "afinn");
const tokenizer = new natural.WordTokenizer();
const csv = require('csv-parser');
const fs = require('fs');

const createCSVWriter = require('csv-writer').createObjectCsvWriter;

const csvWriter = createCSVWriter( {
    path: '../cab432/test.csv',
    header: [
      {id: 'search', title:'search'},
      {id: 'score', title: 'score'}
    ]
  });


let score = 0;
let position = 0;


//Break down tweet into array and terms ready for sentimental analysis
function sentimentalAnalysis(text) {
    let output = analyzer.getSentiment(text);
    //console.log(output);
    return output;
}

function readCSV() {
    let tableData = [];

    //Read from file
    fs.createReadStream('../cab432/test.csv')
    .pipe(csv())
    .on('data', (row) => {
        tableData.push(row);
    })
    .on('end', () => {
       console.log("Table has been written");
    });
    return tableData;
}

function updateCSV(word, value, data) {
        let exist = false;
        //Check the csv file for if the term already exists
        for(let i = 0; i < data.length; i++) {
                if (data[i].search == word) {
                    if (score == 0) {
                        score = parseInt(data[i].score);
                        score = score + value;
                    }
                    else {
                        score = score + value;
                    }
                    position = i;
                    exist = true;
                }
        }

        //If search term isnt in the database, push into the table data
        if (exist == false) {
            let obj ={};
            obj.search = word;
            obj.score = 1;
            console.log(data);
            data.push(obj);
        }
        else {
            //If term exists, change its score value
            data[position].score = score;
        }
        return data;

}

function resetCSV() {
    //Reset CSV file to input new entries
        fs.writeFileSync('../cab432/test.csv', "search,score\n");
        console.log('The CSV file was reset');

}

function saveCSV(tableData) {
    //Write the new data
    resetCSV();
    csvWriter.writeRecords(tableData)
    .then( ()=> {
        console.log('The CSV file was written Successfully');
        console.log(tableData);
        score = 0;
    });
}




module.exports.sentimentalAnalysis = sentimentalAnalysis;
module.exports.updateCSV = updateCSV;
module.exports.saveCSV = saveCSV;
module.exports.readCSV = readCSV;
module.exports.resetCSV = resetCSV;