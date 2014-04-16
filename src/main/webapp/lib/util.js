/**
 * Replace any character which is not a letter with a blank space.
 * @param {string} name to be processed
 * @return {string} The processed name.
 */
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

/**
 * Sets the onClick event to the player button.
 * @param {string} producer of the stream
 * @param {int} integer for knowing which is the return page.
 */
function player(producer,integer){
    $("#player").click(function(){
        var path = './player.html?name=' + producer + '&flag=' + integer;
        window.location.href = path;
    });
}

/**
 * Creates a new video division which also contains the name of the producer,
 * and a button to finish that connection.
 * @param {string} producer of the stream
 * @param {object} connection of the stream
 */
function newVideoDiv(producer, connection){
    var videoDiv = document.createElement("div");
    $(videoDiv).attr('class','video-div');
    $(videoDiv).attr('id',producer+'-video-div');
    var titleBar = document.createElement("div");
        $(titleBar).attr('class','title-bar');
    var name = document.createElement("label");
        $(name).attr('class','name');
        $(name).html(producer);
    var close = document.createElement("input");
        $(close).attr('class','close');
        $(close).attr('type','button');
        $(close).attr('value','Cancel');
        close.connection = connection;
        close.producer = producer;
        $(close).click(function(){
            this.connection.terminate();
            $("#"+producer+'-video-div').hide('slow', function(){
                $("#"+producer+'-video-div').remove();
            });
        });
    $(titleBar).append(name);
    $(titleBar).append(close);
    var video = document.createElement("video");
        $(video).attr('id',producer);
        $(video).attr('autoplay','');
        $(video).attr('controls','');    
    $(videoDiv).append(titleBar);
    $(videoDiv).append(video);
    $("#video-divs").append(videoDiv);
}

/**
 * Creates a new notification which is showed when a new producer is available.
 * @param {string} producer of the stream
 * @param {function} acceptFunc for accepting the stream
 * @param {function} rejectFunc for rejecting the stream
 */
function newNotification(producer, acceptFunc, rejectFunc){
    var notification = document.createElement("div");
        $(notification).attr('class','new-stream');
        $(notification).attr("id","new-stream-" + producer);
    var name = document.createElement("label");
        $(name).html(producer);
    $(notification).append(name);
    var accept = document.createElement("div");
        $(accept).attr("class","accept");
        $(accept).html('<i class="fa fa-check"></i>');
        accept.producer = producer;
        accept.func = acceptFunc;
        $(accept).click(function(){
            this.func(this.producer);
        });   
    $(notification).append(accept);
    var reject = document.createElement("div");
        $(reject).attr("class","reject");
        $(reject).html('<i class="fa fa-times"></i>');
        reject.producer = producer;
        reject.func = rejectFunc;
        $(reject).click(function(){
            this.func(this.producer);
        });
    $(notification).append(reject);
    $("#new-streams").append(notification);
}

/**
 * Hides a notification
 * @param {string} producer of the stream
 */
function hideNotification(producer){
    $("#new-stream-"+producer).hide('slow', function(){ 
        $("#new-stream-"+producer).remove(); 
    });
}

/**
 * Creates a new notification which is showed when a new producer is available.
 * @param {string} producer who has joined to the pipeline
 * @param {function} acceptFunc for accepting the stream
 * @param {function} rejectFunc for rejecting the stream
 */
function onJoined(producer, acceptFunc, rejectFunc) {
    newNotification(producer, acceptFunc, rejectFunc);
}

/**
 * Removes the video div of a producer who has terminated his connection,
 * and appends a message.
 * @param {string} producer of the stream
 */
function onUnjoined(producer){
    var unjoined = document.createElement("div");    
    $(unjoined).attr("class","unjoined");
    $(unjoined).html("<strong>"+producer+"</strong> has stopped broadcasting");
    $("#video-divs").append(unjoined);
    $("#"+producer+'-video-div').hide('slow', function(){
        $("#"+producer+'-video-div').remove();
        $(".unjoined").show('slow');
        $(".unjoined").css('display',"inline-block");
    });
    setTimeout(function(){
        $(".unjoined").hide('slow', function(){
           $(".unjoined").remove();
        });
        clearInterval(this);
    },6000);
}
