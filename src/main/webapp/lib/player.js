
var parameters = "",
    name = "",
    conn, handler;

window.onload = function() {
    console = new Console("console", console);
    parameters = getUrlVars();
    name = parameters["name"];
    $(".multi-local").attr("id",name);
    $('#terminate').click(function(){
        
    });
    handler = "../player/" + name;
    var player = { remoteVideoTag: name };
    try {
        conn = new kwsContentApi.KwsContentPlayer(handler,player);
        initConnection(conn);
    }
    catch(error) {
        console.error(error.message);
    }
};

function terminate(){
    if (conn == null) {
        alert("No connection to terminate.");
        return false;
    }
    conn.terminate();
    setTimeout(function(){
        window.location="../manyToMany.html";
    },2000);
}

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
