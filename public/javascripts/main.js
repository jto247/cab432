function showTweets() {
    const params = getHashParams();
    //Check if there are any tweets sent back from server
    const checkTweets = params.tweets;
    if (checkTweets) {
        //Split tweet param into an array
        const tweets = params.tweets.split(",");
    }
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

  $.get( "test.csv", function(CSVdata) {
    let array = CSVdata.replaceAll("\r\n", ',').split(',');
    for (let i = 0; i < array.length; i++) {
        if (i % 3 === 0 && i !== 0) {
            labels.push(array[i]);
            data.datasets[0].data.push(array[i+1]/array[i+2]);
        }
    }
 });

 console.log(data);

 const config = {
    type: 'bar',
    data: data,
    options: {
        responsive: true
    }
  };
  const ctx = document.getElementById('myChart').getContext('2d');
  const myChart = new Chart(
    ctx,
    config
  );