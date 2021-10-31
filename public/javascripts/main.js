const canvas = document.getElementById('myChart').getContext('2d');

function showTweets() {


  
}

function findTweets() {
    window.location.replace("search/" + "?rules=" + encodeURI(document.getElementById("searchBox").value));
}

function stopStream() {
  alert("yes");
  window.location.replace("search/" + "?rules=stopstream");
}

//debugging - delete later
function resetCSV() {
  window.location.replace("search/" + "?rules=resetcsv");
}

//Getting the queries from params
function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while ( e = r.exec(q)) {
       hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}

const labels = [];

const data = {
  labels: labels,
  datasets: [{
    label: 'Dataset',
    data: [],
    backgroundColor: 'rgb(255, 99, 132)',
    borderColor: 'rgb(255, 99, 132)',
  }]
};

var timer;

//Keep updating the dataset
//FIND A WAY TO RESET THE DATASET BEFORE UPDATING PLEASE
timer = setInterval(function() {
  //reset labels and data doesn't work that well, find something better
  for (let i =0; i < labels.length;i++) {
    labels.pop();
    data.datasets[0].data.pop();
  }
  d3.csv("test.csv",function(dataset) {
    console.log(dataset);
    //labels.pop();
    labels.push(dataset.search);
    data.datasets[0].data.push(dataset.score/dataset.total);
    myChart.update();
  })

}, 1000);



const config = {
  type: 'bar',
  data: data,
  options: {
      responsive: true
  }
};
const myChart = new Chart(
  canvas,
  config
);