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

//check if term is in csv already
function checkCSV(searchTerm, data) {
    let final = false;
    for(let i = 0; i < data.length; i++) {
        if (data[i].search == searchTerm) {
            final = true;
        }
    }
    return final;
}
let tableData = [];

async function readCSV() {
    tableData = [];

    //Read from file
    fs.createReadStream('../cab432/public/test.csv')
    .pipe(csv())
    .on('data', (row) => {
        tableData.push(row);
    })
    .on('end', () => {
       console.log("Table has been written: ");
       console.log(tableData);
    });
    return await Promise.resolve(tableData);
}

function updateCSV(word, value, data) {
        let exist = false;
        //Check the csv file for if the term already exists
        for(let i = 0; i < tableData.length; i++) {
                if (tableData[i].search == word) {
                    tableData[i].score = Number(tableData[i].score) + value;
                    tableData[i].total++;
                    exist = true;
                }
        }

        //If search term isnt in the database, push into the table data
        //console.log(checkCSV(word));
        exist = checkCSV(word, tableData);
        console.log(exist);
        if (exist !== true) {
            let obj ={};
            obj.search = word;
            obj.score = 1;
            obj.total = 1;
            tableData.push(obj);
            console.log("pushed new object, from updateCSV");
        }

        //console.clear();
        //console.log(data);
        saveCSV(tableData);
        return tableData;

}

function resetCSV() {
    //Reset CSV file to input new entries
        fs.writeFileSync('../cab432/public/test.csv', "search,score,total\n");
        //console.log('The CSV file was reset');

}

function saveCSV(tableData) {
    //Write the new data
    resetCSV();

    //remove duplicates 
    //Retrieved from https://stackoverflow.com/a/45440277
    tableData = tableData.reduce((unique, o) => {
        if(!unique.some(obj => obj.search === o.search)) {
          unique.push(o);
        }
        return unique;
    },[]);

    csvWriter.writeRecords(tableData)
    .then( ()=> {
        console.log('The CSV file was written Successfully');
        console.log(tableData);
    });
}

//Adds one record to the tableData
function addCSV(data) {
    let fullData = [];
    fullData.push( {'search':data.search, 'score': data.score, 'total': data.total} );
    //console.log("from addcsv: "+fullData);
    csvWriter.writeRecords(fullData)
    .then( ()=> {
        console.log("addCSV Finished");
        return readCSV();
    });
}




module.exports.sentimentalAnalysis = sentimentalAnalysis;
module.exports.updateCSV = updateCSV;
module.exports.saveCSV = saveCSV;
module.exports.readCSV = readCSV;
module.exports.resetCSV = resetCSV;
module.exports.addCSV = addCSV;
module.exports.checkCSV = checkCSV;