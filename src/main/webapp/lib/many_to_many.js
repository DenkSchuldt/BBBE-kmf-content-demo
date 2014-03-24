var conn, conn_2;
var urls = new Array();
var handler;
var idController = 1;
var name = "";

var Command = {
    GET_PARTICIPANTS : "getParticipants",
    SELECT : "selectParticipant",
    CONNECT : "connectParticipant",
};

var Event = {
    ON_JOINED : "onJoined",
    ON_UNJOINED : "onUnjoined",
};

window.onload = function() {
    console = new Console("console", console);
};

function terminate() {
    conn.terminate();
    location.reload();
}

function initConnection(conn) {
    console.log("Creating connection to " + handler);
    conn.on("start", function(event){});
    conn.on("terminate", function(event){
        //If user already exist.
        /*alert("User " + name + " is already in the room. Please select another name and try again.");
        $("#start").removeAttr("disabled");
        var local = $("#local");
        $(local).css("background","black");
        var remote = $("#videos video")[0];
        $(remote).css("background","black");*/
    });
    conn.on("localstream", function(event) {
        console.log("--------LOCAL SET!---------\n\n");
    });
    conn.on("remotestream", function(event) {
        $("#videos video").click(function(){
            var src1 = $("#oneLocal").attr("src");
            var src2 = $(this).attr("src");
            $("#oneLocal").attr("src",src2);
            $(this).attr("src",src1);
        });
        console.log("--------REMOTE SET!---------\n\n");
    });
    conn.on("mediaevent", function(event) {
        if(Event.ON_JOINED === event.type){
            console.log(event.data);
            var participant_data = jQuery.parseJSON(event.data);
            onJoined(participant_data.name);
        }else if(Event.ON_UNJOINED === event.type){
            var participant_data = JSON.parse(event.data);
            onUnjoined(participant_data);
        }else{
            console.info("MediaEvent: " + participant_data);
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
    $($("#videos video")[0]).attr("id",name);
    $("#start").attr("disabled","disabled");

    var local = $("#local");
    $(local).css("background","white center url('../img/spinner.gif') no-repeat");
    $(local).css("width","50%");

    var remote = $("#videos video")[0];
    $(remote).css("background","white center url('../img/spinner.gif') no-repeat");
    $(remote).css("width","300px");

    handler = "../manyToMany/" + name;
    var options = {
        localVideoTag: "local",
        remoteVideoTag: name
    };
    try {
        conn = new kwsContentApi.KwsWebRtcContent(handler, options);
        initConnection(conn);
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

function newVideo(name){
    var remote = document.createElement("video");
    $(remote).attr('autoplay','');
    $(remote).attr('controls','');
    $(remote).attr('id',name);
    $(remote).css("background","white center url('../img/spinner.gif') no-repeat");
    $(remote).css("width","300px");
    $("#videos").append(remote);
}

function newParticipant(name){
    var div = document.createElement("div");
    $(div).attr("id","new-stream-" + name);
    var label = document.createElement("label");
    $(label).html(name);
    $(div).append(label);
    var ok = document.createElement("div");
    $(ok).attr("id","ok");
    ok.name = name;
    $(ok).click(function(){
        //Accept participant
        newVideo(this.name);
        var newuser = "../manyToMany/" + this.name;
        var option = { remoteVideoTag: this.name };
        try {
            var connection = new kwsContentApi.KwsWebRtcContent(newuser, option);
            initConnection(connection);
        }
        catch(error) {
            console.error(error.message);
        }
        $("#new-stream-" + this.name).hide('slow', function(){ $("#new-stream-" + this.name).remove(); });
    });
    $(ok).html('<i class="fa fa-check"></i>');
    $(div).append(ok);
    var notOk = document.createElement("div");
    $(notOk).attr("id","notOk");
    notOk.name = name;
    $(notOk).click(function(){
        //Reject participant
        //Eliminar conexión
        $("#new-stream-" + this.name).hide('slow', function(){ $("#new-stream-" + this.name).remove(); });
    });
    $(notOk).html('<i class="fa fa-times"></i>');
    $(div).append(notOk);
    $("#new-streams").append(div);
}

function onJoined(participant) {
    newParticipant(participant);
    /*conn.execute(Command.GET_PARTICIPANTS,"", function(error, result) {
        removeAllParticipants('orig');
        removeAllParticipants('dest');

        // Remove all buttons and add new ones
        removeAllButtons();
        participantsList = JSON.parse(result);
        participantsList.forEach(function(item) {
            addParticipant(item, 'orig');
            addParticipant(item, 'dest');
            addButton(item);
        });
    });*/
}

function onUnjoined(participant){
    /*console.info(participant.name + " has gone");
    removeParticipant(participant, 'orig');
    removeParticipant(participant, 'dest');
    var e = document.getElementById(participant.id);
    e.parentElement.removeChild(e);
    if(participant.id == connected){
        connected = null;
    }*/
}

