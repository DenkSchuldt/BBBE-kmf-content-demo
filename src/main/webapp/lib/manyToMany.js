
var conn, handler, name;

var Event = {
    ON_JOINED : "onJoined",
    ON_UNJOINED : "onUnjoined"
};

window.onload = function() {
    console = new Console("console", console);
};

function initConnection(conn, handler) {
    console.log("Creating connection to " + handler);
    conn.on("start", function(event) {
        console.log("Connection started");
    });
    conn.on("terminate", function(event) {
        console.log("Connection terminated");
    });
    conn.on("localstream", function(event) {
        console.info("LocalStream set");
    });
    conn.on("remotestream", function(event) {
        console.info("RemoteStream set");
    });
    conn.on("mediaevent", function(event) {
        if(Event.ON_JOINED === event.type){
            console.log(event.data);
            var participant_data = jQuery.parseJSON(event.data);
            onJoined(participant_data.name, acceptBroadcast, hideNotification);
        }else if(Event.ON_UNJOINED === event.type){
            var participant_data = jQuery.parseJSON(event.data);
            onUnjoined(participant_data.name);
        }else{
            console.info("MediaEvent: " + event.data);
        }
    });
    conn.on("error", function(error) {
        console.error(error.message);
    });
}

/**
 * Called when the "Start" button is clicked.
 */
function start() {
    name = $("#name").val();
    if(!name){
        alert("You must specify your name.");
        return;
    }
    name = checkName(name);
    if(!name) name = "user";
    player(name,0);
    $("#start").attr("disabled","disabled");
    var selfVideo = $(".self-video-small");
    $(selfVideo).css("background","white center url('../img/spinner.gif') no-repeat");
    $(selfVideo).attr("id",name);
    handler = "../manyToMany/" + name;
    var producer = {
        localVideoTag: name,
        audio: "sendonly",
	video: "sendonly"
    };
    try {
        conn = new kwsContentApi.KwsWebRtcContent(handler,producer);
        initConnection(conn, handler);
    }
    catch(error) {
        console.error(error.message);
    }
}

/**
 * Called when the "Terminate" button is clicked.
 */
function terminate() {
    if (!conn) {
        alert("No connection to terminate.");
        return false;
    }
    $("#player").fadeIn('slow');
    $("#"+name).removeAttr("src");
    $("#terminate").attr("disabled","disabled");
    $("#start").removeAttr("disabled");
    conn.terminate();
}

/**
 * Creates a new connection to receive the stream of the selected producer.
 * @param {string} producer of the new stream
 */
function acceptBroadcast(producer){
    var broadcast = "../manyToMany/" + producer;
    var option = { 
        remoteVideoTag: producer,
        audio: "recvonly",
	video: "recvonly"
    };
    try {
        var connection = new kwsContentApi.KwsWebRtcContent(broadcast, option);
        newVideoDiv(producer, connection);
        var remote = $("#"+producer);
        $(remote).css("background","white center url('../img/spinner.gif') no-repeat");
        initConnection(connection,broadcast);
    }
    catch(error) {
        console.error(error.message);
    }
    hideNotification(producer);
}