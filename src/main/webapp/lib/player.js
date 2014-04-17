
var parameters = "",
    name = "",
    flag,
    conn, handler;

window.onload = function() {
    console = new Console("console", console);
    parameters = getUrlVars();
    name = parameters["name"];
    flag = parameters["flag"];
    if(flag === '0') $("#back").attr("href","./manyToMany.html");
    else if(flag === '1') $("#back").attr("href","./httpClient.html");
    $('#terminate').click(function(){
        terminate();
    });
    handler = "../player/" + name;
    var player = { remoteVideoTag: 'self-video' };
    try {
        conn = new kwsContentApi.KwsContentPlayer(handler,player);
        initConnection(conn);
    }
    catch(error) {
        console.error(error.message);
    }
};

/**
 * Called when the "Terminate" button is clicked.
 */
function terminate(){
    if (!conn) {
        alert("No connection to terminate.");
        return false;
    }
    conn.terminate();
    setTimeout(function(){
        if(flag === '0') window.location="./manyToMany.html";
        else if(flag === '1') window.location="./httpClient.html";
    },2000);
}

/**
 * Connection listener
 * @param {object} conn which is the actuall connection
 */
function initConnection(conn) {
    console.log("Creating connection to " + handler);
    conn.on("start", function(event){});
    conn.on("terminate", function(event){
        conn = null;
    });
    conn.on("localstream", function(event) {
        console.log("--------LOCAL SET!---------\n\n");
    });
    conn.on("remotestream", function(event) {
        console.log("--------REMOTE SET!---------\n\n");
    });
    conn.on("mediaevent", function(event) {
        console.info("MediaEvent: " + event.data);
    });
    conn.on("error", function(error) {
        console.error(error.message);
    });
}

/*
 * How to Get Url Parameters & Values using jQuery
 * @source http://w3lessons.info/2013/02/25/how-to-get-url-parameters-values-using-jquery/
 * @returns {getUrlVars.vars|Array}
 */
function getUrlVars(){
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}
