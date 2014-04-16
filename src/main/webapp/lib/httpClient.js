
var conn, handler, name;

var Event = {
    ON_JOINED : "onJoined",
    ON_UNJOINED : "onUnjoined",
    ON_REMOTE : "onRemote"
};

window.onload = function() {
    console = new Console("console", console);
};

function initConnection(conn,handler) {
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
        if(Event.ON_JOINED === event.type){
            console.log("Joined: " + event.data);
            var participant_data = jQuery.parseJSON(event.data);
            onJoined(participant_data.name);
            onJoined(participant_data.name, acceptBroadcast, hideNotification);
        }else if(Event.ON_UNJOINED === event.type){
            console.log("Unjoined: " + event.data);
            var participant_data = jQuery.parseJSON(event.data);
            onUnjoined(participant_data.name);
        }else if(Event.ON_REMOTE === event.type){
            console.log("Remote: " + event.data);
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
    player(name,1);
    $("#start").attr("disabled","disabled");
    var selfVideo = $(".self-video-small");
    $(selfVideo).css("background","white center url('../img/spinner.gif') no-repeat");
    $(selfVideo).attr("id",name);
    handler = "../webRtcInput/" + name;
    var producer = {
        localVideoTag: name,
        audio: "sendonly",
	video: "sendonly"
    };
    try {
        conn = new kwsContentApi.KwsWebRtcContent(handler,producer);
        initConnection(conn,handler);
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
 * Creates a new connection to receive the http stream of the selected producer.
 * @param {string} producer of the new stream
 */
function acceptBroadcast(producer){
    var broadcast = "../httpOutput/" + name;
    var option = { 
        remoteVideoTag: name,
        audio: "recvonly",
	video: "recvonly"
    };
    try {
        var connection = new kwsContentApi.KwsContentPlayer(broadcast, option);
        newVideoDiv(producer, connection);
        var remote = $("#"+producer);
        $(remote).css("background","white center url('../img/spinner.gif') no-repeat");
        initConnection(connection,broadcast);
    }
    catch(error) {
        console.error(error.message);
    }
    hideNotification(name);
}