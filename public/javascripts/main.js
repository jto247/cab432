
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