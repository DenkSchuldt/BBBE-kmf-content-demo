var conn;
var urls = new Array();
var handler;
var idController = 1;
var name = "";

var Event = {
    ON_JOINED : "onJoined",
    ON_UNJOINED : "onUnjoined",
    ON_REMOTE : "onRemote"
};

window.onload = function() {
    console = new Console("console", console);
};

function player(){
    $("#player").click(function(){
        var path = '../webrtc/player.html?name=' + name;
        window.location.href = path;
    });
}

function terminate() {
    if (conn == null) {
        alert("Connection is not established");
        return false;
    }
    $("#player").fadeIn('slow');
    $("#"+name).removeAttr("src");
    $("#terminate").attr("disabled","disabled");
    $("#start").removeAttr("disabled");
    conn.terminate();
}

function initConnection(conn,handler) {
    console.log("Creating connection to " + handler);
    conn.on("start", function(event){});
    conn.on("terminate", function(event){
        $($("#local")).css("background","black");
        $("#"+name).css("background","black");
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

function start() {
    name = $("#name").val();
    if(!name){
        alert("You must specify your name.");
        return;
    }
    name = checkName(name);
    if(!name) name = "user";
    player(name);
    $("#start").attr("disabled","disabled");
    var local = $(".multi-local");
    $(local).css("background","white center url('../img/spinner.gif') no-repeat");
    $(local).attr("id",name);
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

function checkName(name){
    var x = 0;
    for(var i=0;i<name.length;i++){
        var x = name.charCodeAt(i);
        if(!((x>64&&x<91)||(x>96&&x<123))){
            name = name.replace(name.charAt(i),"");
        }
    }
    return name;
}

function newVideoTag(name){
    var video = document.createElement("video");
    $(video).attr('id',name);
    $(video).css("background","white center url('../img/spinner.gif') no-repeat");
    $(video).attr('autoplay','');
    $(video).attr('controls','');
    $("#videos").append(video);
}

function newNotification(name){
    var div = document.createElement("div");
    $(div).attr("id","new-stream-" + name);
    var label = document.createElement("label");
    $(label).html(name);
    $(div).append(label);
    var accept = document.createElement("div");
    $(accept).attr("id","ok");
    $(accept).html('<i class="fa fa-check"></i>');
    accept.name = name;
    $(accept).click(function(){
        acceptBroadcast(this.name);
    });   
    $(div).append(accept);
    var reject = document.createElement("div");
    $(reject).attr("id","notOk");
    $(reject).html('<i class="fa fa-times"></i>');
    reject.name = name;
    $(reject).click(function(){
        hideNotification(this.name);
    });
    $(div).append(reject);
    $("#new-streams").append(div);
}

function acceptBroadcast(name){
    newVideoTag(name);
    var broadcast = "../httpOutput/" + name;
    var option = { 
        remoteVideoTag: name,
        audio: "recvonly",
	video: "recvonly"
    };
    try {
        var connection = new kwsContentApi.KwsContentPlayer(broadcast, option);
        initConnection(connection,broadcast);
    }
    catch(error) {
        console.error(error.message);
    }
    hideNotification(name);
}

function hideNotification(name){
    $("#new-stream-"+name).hide('slow', function(){ 
        $("#new-stream-"+name).remove(); 
    });
}

function onJoined(participant) {
    newNotification(participant);
}

function onUnjoined(participant){
    var div = document.createElement("div");    
    $(div).attr("id","left");
    $(div).html("<strong>"+participant+"</strong> has stopped broadcasting");
    $("#videos").append(div);
    $("#"+participant).hide('slow', function(){
        $("#"+participant).remove();
        $("#left").show('slow');
        $("#left").css('display',"inline-block");
    });
    setTimeout(function(){
        $("#left").hide('slow', function(){
           $("#left").remove();
        });
        clearInterval(this);
    },6000);
}

