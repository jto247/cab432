const canvas = document.getElementById('myChart').getContext('2d');
var rule;

function showTweets() {
    var params = getHashParams();
    if (params.show) {
      rule = params.show;
    }

  
}

function findTweets() {
  rule = document.getElementById("searchBox").value;
  console.log(document.getElementById("searchBox").value);
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
  d3.csv("test.csv",function(dataset) {
    console.log(dataset);
    console.log(rule);
    if(dataset.search == rule) {
      labels.pop();
      labels.push(dataset.search);
      data.datasets[0].data.pop();
      data.datasets[0].data.push(dataset.score);
      myChart.update('none');
    }
  })

}, 2000);



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