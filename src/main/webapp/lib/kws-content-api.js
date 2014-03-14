!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.kwsContentApi=e():"undefined"!=typeof global?global.kwsContentApi=e():"undefined"!=typeof self&&(self.kwsContentApi=e())}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * (C) Copyright 2013 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 */


var EventEmitter = require("events").EventEmitter;

var XMLHttpRequest = require("xmlhttprequest");
var RpcBuilder     = require("kws-rpc-builder");


MAX_FRAMERATE = 15;


/**
 * @constructor
 * @abstract
 *
 * @param {String} url: URL of the WebRTC endpoint server.
 * @param {Object} options: optional configuration parameters
 *   {Enum('inactive', 'sendonly', 'recvonly', 'sendrecv')} audio: audio stream mode
 *   {Enum('inactive', 'sendonly', 'recvonly', 'sendrecv')} video: video stream mode
 *   {[Object]} iceServers: array of objects to initialize the ICE servers. It
 *     structure is the same as an Array of WebRTC RTCIceServer objects.
 *
 * @throws RangeError
 */
function Content(url, options)
{
  EventEmitter.call(this);

  var self = this;


  ERROR_NO_REMOTE_VIDEO_TAG = -1;


  /**
   * Decode the mode of the streams
   *
   * @private
   *
   * @param {Object} options: constraints to update and decode
   * @param {String} type: name of the constraints to decode
   *
   * @returns {Object}
   *
   * @throws RangeError
   */
  function decodeMode(options, type)
  {
    var result = {};

    // If not defined, set send & receive by default
    options[type] = options[type] || 'sendrecv';

    switch(options[type])
    {
      case 'sendrecv':
        result.local  = true;
        result.remote = true;
      break;

      case 'sendonly':
        result.local  = true;
        result.remote = false;
      break;

      case 'recvonly':
        result.local  = false;
        result.remote = true;
      break;

      case 'inactive':
        result.local  = false;
        result.remote = false;
      break;

      default:
        throw new RangeError("Invalid "+type+" media mode");
    }

    return result;
  }

  // We can't disable both audio and video on a stream, raise error
  if(options.audio == 'inactive' && options.video == 'inactive')
    throw new RangeError("At least one audio or video must to be enabled");

  // Audio media
  this._audio = decodeMode(options, "audio");

  // Video media
  this._video = decodeMode(options, "video");

  if(this._video.local)
      this._video.local =
      {
        "mandatory":
        {
          "maxFrameRate": options.maxFrameRate || MAX_FRAMERATE
        }
      };

  // Init the KwsWebRtcContent object

  var _sessionId = null;
  var pollingTimeout = null;
  var terminatedByServer = false;


  this.__defineGetter__('sessionId', function()
  {
    return _sessionId;
  });


  var rpc = new RpcBuilder();


  function doRPC(method, params, callback)
  {
    var xhr = new XMLHttpRequest();

    // Set XmlHttpRequest error callback
    xhr.addEventListener('error', function(error)
    {
      self.emit('error', error);
    });

    // Connect to Content Server
    xhr.open('POST', url);

    // Send request
    xhr.send(rpc.encodeJSON(method, params, callback));

    // Register callback for the Application Server
    xhr.addEventListener('load', function()
    {
      rpc.decodeJSON(this.responseText);
    });
  };


  function close()
  {
//    xhr.abort();

    _sessionId = null;
  };

  self.on('error',     close);
  self.on('terminate', close);


  // Error dispatcher functions

  var MAX_ALLOWED_ERROR_TRIES = 10;

  var error_tries = 0;


  // RPC calls

  // Start

  this._start = function(params, success)
  {
    if(this.sessionId)
      throw new SyntaxError("Connection already open");

    doRPC('start', params, function(error, result)
    {
      error = error || result.rejected;

      if(error)
        return self.emit('error', error);

      _sessionId = result.sessionId;

      success(result);
    });
  };


  // Pool

  /**
   * Pool for events dispatched on the server pipeline
   *
   * @private
   */
  function pollMediaEvents()
  {
    if(!self.sessionId)
      return;

    var params =
    {
      sessionId: self.sessionId
    };

    function success(result)
    {
      error_tries = 0;

      // Content events
      if(result.contentEvents)
        for(var i=0, data; data=result.contentEvents[i]; i++)
          self.emit('mediaevent', data);

      // Control events
      if(result.controlEvents)
        for(var i=0, data; data=result.controlEvents[i]; i++)
        {
          var type = data.type;

          switch(type)
          {
            case "sessionTerminated":
              terminatedByServer = true;
              self.emit('terminate', Content.REASON_SERVER_ENDED_SESSION);
            break;

            case "sessionError":
              self.emit('error', data.data);
            break;

            default:
              console.warn("Unknown control event type: "+type);
          }
        };

      // Check if we should keep polling events
      if(pollingTimeout != 'stopped')
         pollingTimeout = setTimeout(pollMediaEvents, 0);
    };

    function failure(error)
    {
      // A poll error has occurred, retry it
      if(error_tries < MAX_ALLOWED_ERROR_TRIES)
      {
        if(pollingTimeout != 'stopped')
           pollingTimeout = setTimeout(pollMediaEvents, Math.pow(2, error_tries));

        error_tries++;
      }

      // Max number of poll errors achieved, raise error
      else
        terminateConnection('error', error);
    };

    doRPC('poll', params, function(error, result)
    {
      if(error)
        failure(error)
      else
        success(result)
    });
  };

  this.on('start', pollMediaEvents);


  /**
   * Terminate the connection with the WebRTC media server
   */
  function terminateConnection(action, reason)
  {
    // Stop polling
    clearTimeout(pollingTimeout);
    pollingTimeout = 'stopped';

    if(terminatedByServer)
      return;

    // Notify to the WebRTC endpoint server
    if(self.sessionId)
    {
      var params =
      {
        sessionId: self.sessionId,
        reason: reason
      };

      doRPC('terminate', params, function()
      {
        self.emit(action, reason);
      });

      _sessionId = null;
    };
  };


  //
  // Methods
  //

  /**
   * @private
   */
  this._setRemoteVideoTag = function(src)
  {
    var remoteVideo = document.getElementById(options.remoteVideoTag);
    if(remoteVideo)
    {
      remoteVideo.src = src;

      return remoteVideo;
    };

    var msg = "Requested remote video tag '" + options.remoteVideoTag
            + "' is not available";

    var error = new Error(msg);
        error.code = ERROR_NO_REMOTE_VIDEO_TAG;

    self.emit('error', error);
  };


  /**
   * Send a command to be executed on the server
   *
   * @param {string} type - The command to execute
   * @param {*} data - Data needed by the command
   * @param {} callback - Function executed after getting a result or an error
   */
  this.execute = function(type, data, callback)
  {
    if(!this.sessionId)
      throw new SyntaxError("Connection needs to be open");

    var params =
    {
      sessionId: this.sessionId,
      command:
      {
        type: type,
        data: data
      }
    };

    doRPC('execute', params, function(error, result)
    {
      if(callback)
         callback(error, result.commandResult);
    });
  }

  /**
   * Close the connection
   */
  this.terminate = function()
  {
    terminateConnection('terminate', Content.REASON_USER_ENDED_SESSION);
  };
};
Content.prototype.__proto__   = EventEmitter.prototype;
Content.prototype.constructor = Content;


Content.REASON_USER_ENDED_SESSION =
{
  code: 1,
  message: "User ended session"
};
Content.REASON_SERVER_ENDED_SESSION =
{
  code: 2,
  message: "Server ended session"
};


module.exports = Content;

},{"events":6,"kws-rpc-builder":7,"xmlhttprequest":8}],2:[function(require,module,exports){
/*
 * (C) Copyright 2013 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 */


var Content = require("./Content");


/**
 * @constructor
 *
 * @param {String} url: URL of the WebRTC endpoint server.
 * @param {Object} options: optional configuration parameters
 *   {Enum('inactive', 'sendonly', 'recvonly', 'sendrecv')} audio: audio stream mode
 *   {Enum('inactive', 'sendonly', 'recvonly', 'sendrecv')} video: video stream mode
 *   {[Object]} iceServers: array of objects to initialize the ICE servers. It
 *     structure is the same as an Array of WebRTC RTCIceServer objects.
 *
 * @throws RangeError
 */
function KwsContentPlayer(url, options)
{
  options = options || {};

  Content.call(this, url, options);

  var self = this;


  // RPC calls

  // Start

  /**
   * Request a connection with the webRTC endpoint server
   *
   * @private
   */
  function start()
  {
    /**
     * Callback when connection is succesful
     *
     * @private
     *
     * @param {Object} response: JsonRPC response
     */
    function success(result)
    {
      // Remote streams
      if(self._video.remote)
      {
        var url = result.url;
        if(options.remoteVideoTag)
        {
          var remoteVideo = self._setRemoteVideoTag(url);

          remoteVideo.addEventListener('ended', function()
          {
            self.terminate();
          })
        }
        else
          console.warn("No remote video tag available, successful terminate event due to remote end will be no dispatched");

        self.emit('remotestream', {url: url});
      };

      // Notify we created the connection successfully
      self.emit('start');
    };


    var params =
    {
      constraints:
      {
        audio: options.audio,
        video: options.video
      }
    };

    self._start(params, success);
  };

  // Mode set to only receive a stream, not send it
  start();


  function close(reason)
  {
    if(reason == Content.REASON_SERVER_ENDED_SESSION)
      return;

    var remoteVideo = document.getElementById(options.remoteVideoTag);
    if(remoteVideo) {
        remoteVideo.src = '';
        remoteVideo.removeAttribute('src');
    }
  };

  this.on('error',     close);
  this.on('terminate', close);
};
KwsContentPlayer.prototype.__proto__   = Content.prototype;
KwsContentPlayer.prototype.constructor = KwsContentPlayer;


module.exports = KwsContentPlayer;
},{"./Content":1}],3:[function(require,module,exports){
/*
 * (C) Copyright 2013 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 */


var Content = require("./Content");

var XMLHttpRequest = require("xmlhttprequest");


function drop(event)
{
  event.stopPropagation();
  event.preventDefault();

  this._filesContainer = event.dataTransfer;
};
function dragover(event)
{
  event.stopPropagation();
  event.preventDefault();

  event.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
};

/**
 * Upload a file to a Media Server
 * 
 * @constructor
 * 
 * @param {string} url - URL of the Connect Server endpoint
 * @param {KwsContentUploader} [options]
 */
function KwsContentUploader(url, options)
{
  options = options || {};

  Content.call(this, url, options);

  var self = this;


  // XmlHttpRequest object used to upload the files
  var xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('error', function(error)
  {
    self.emit('error', error);
  });
  xhr.upload.addEventListener('load', function(event)
  {
    console.log(event);
    self.emit('localfile');
//    self.emit('localfile', file);
  });


  /**
   * Request to the content server the URL where to upload the file
   */
  function start()
  {
    function success(result)
    {
      // Connect to Media Server and set the url where to upload the file
      xhr.open('POST', result.url);


      function sendFiles(container)
      {
        var files = container.files;
        if(files)
          self.send(files);
      };


      // Set events on elements (if specified)

      // Input tag
      if(options.inputTag)
      {
        var input = document.getElementById(options.inputTag);
        if(!input)
          throw new SyntaxError("ID "+options.inputTag+" was not found");

        input.addEventListener('change', function(event)
        {
          sendFiles(input);
        });

        // Send previously selected files
        sendFiles(input);
      };

      // Drag & Drop area
      if(options.dragdropTag)
      {
        var div = document.getElementById(options.dragdropTag);
        if(!div)
          throw new SyntaxError("ID "+options.dragdropTag+" was not found");

        // Set events if they were not set before
        div.addEventListener('drop', drop);
        div.addEventListener('dragover', dragover);

        // Send previously dropped files
        if(div._filesContainer)
          sendFiles(div._filesContainer);
      };

      self.emit('start');
    };


    var params =
    {
      constraints:
      {
        audio: 'sendonly',
        video: 'sendonly'
      }
    };

    self._start(params, success);
  };

  start();


  //
  // Methods
  //

  /**
   * Upload a file
   * 
   * @param {File} file - media file to be uploaded to the server
   */
  this.send = function(file)
  {
    if(!this.sessionId)
      throw new SyntaxError("Connection with media server is not stablished");

    // Fileset
    if(file instanceof FileList)
    {
      // Fileset with several files
      if(file.lenght > 1)
      {
        var formData = new FormData();
        for(var i=0, f; f=file[i]; i++)
          formData.append("file_"+i, f);
        file = formData;
      }
      // Fileset with zero or one files
      else
        file = file[0];
    }

    // Forced usage of FormData
    else if(options.useFormData)
    {
      var formData = new FormData();
      formData.append("file", file);
      file = formData;
    }

    // Send the file
    xhr.send(file);
  };
};
KwsContentUploader.prototype.__proto__   = Content.prototype;
KwsContentUploader.prototype.constructor = KwsContentUploader;

KwsContentUploader.initDragDrop = function(id)
{
  var div = document.getElementById(id);
  if(!div)
    throw new SyntaxError("ID "+id+" was not found");

  div.addEventListener('drop', drop);
  div.addEventListener('dragover', dragover);
};


/**
 * @typedef {object} KwsContentUploader
 * @property {Boolean} [useFormData] - select if files should be uploaded as raw
 *   Blobs or inside a FormData object
 * @property {string} [inputTag] - ID of the input tag that will host the file
 * @property {string} [dragdropTag] - ID of the element where to drop the files
 */


module.exports = KwsContentUploader;

},{"./Content":1,"xmlhttprequest":8}],4:[function(require,module,exports){
/*
 * (C) Copyright 2013 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 */


var Content = require("./Content");


/**
 * @constructor
 *
 * @param {String} url: URL of the WebRTC endpoint server.
 * @param {Object} options: optional configuration parameters
 *   {Enum('inactive', 'sendonly', 'recvonly', 'sendrecv')} audio: audio stream mode
 *   {Enum('inactive', 'sendonly', 'recvonly', 'sendrecv')} video: video stream mode
 *   {[Object]} iceServers: array of objects to initialize the ICE servers. It
 *     structure is the same as an Array of WebRTC RTCIceServer objects.
 *
 * @throws RangeError
 */
function KwsWebRtcContent(url, options)
{
  options = options || {};

  Content.call(this, url, options);

  var self = this;


  var pc = null;


  function onerror(error)
  {
    self.emit('error', error);
  };


  /**
   * Request a connection with the webRTC endpoint server
   *
   * @private
   *
   * @param {MediaStream | undefined} localStream: stream locally offered
   */
  function initRtc(localStream)
  {
    // Create the PeerConnection object
    var iceServers = options.iceServers
                  || [{url: 'stun:'+'stun.l.google.com:19302'}];

    pc = new RTCPeerConnection
    (
      {iceServers: iceServers},
      {optional: [{DtlsSrtpKeyAgreement: true}]}
    );

    // Add the local stream if defined
    if(localStream)
      pc.addStream(localStream);

    var mediaConstraints =
    {
      mandatory:
      {
        OfferToReceiveAudio: self._audio.remote,
        OfferToReceiveVideo: self._video.remote
      }
    };

    pc.createOffer(function(offer)
    {
      // Set the peer local description
      pc.setLocalDescription(offer,
      function()
      {
        console.info("LocalDescription correctly set");
      },
      onerror);
    },
    onerror,
    mediaConstraints);

    // PeerConnection events

    pc.onicecandidate = function(event)
    {
      // We are still generating the candidates, don't send the SDP yet.
      if(event.candidate)
        return;

      start();
    };

    // Dispatch 'close' event if signaling gets closed
    pc.onsignalingstatechange = function(event)
    {
      if(pc.signalingState == "closed")
        self.emit('terminate');
    };
  }


  // RPC calls

  // Start

  /**
   * Request a connection with the webRTC endpoint server
   *
   * @private
   */
  function start()
  {
    /**
     * Callback when connection is succesful
     *
     * @private
     *
     * @param {Object} response: JsonRPC response
     */
    function success(result)
    {
      function success2()
      {
        // Local streams
        if(self._video.local)
        {
          var streams = pc.getLocalStreams();

          if(streams && streams[0])
          {
            var stream = streams[0];
            var url = URL.createObjectURL(stream);

            if(options.localVideoTag)
            {
              var localVideo = document.getElementById(options.localVideoTag);

              if(localVideo)
              {
                localVideo.muted = true;
                localVideo.src = url;
              }
              else
              {
                var msg = "Requested local video tag '"+options.localVideoTag
                        + "' is not available";
                onerror(new Error(msg));
                return
              };
            };

            self.emit('localstream', {stream: stream, url: url});
          }
          else
          {
            onerror(new Error("No local streams are available"));
            return
          }
        };

        // Remote streams
        if(self._video.remote)
        {
          var streams = pc.getRemoteStreams();

          if(streams && streams[0])
          {
            var stream = streams[0];
            var url = URL.createObjectURL(stream);

            if(options.remoteVideoTag)
            {
              var remoteVideo = self._setRemoteVideoTag(url);

            }
            else
              console.warn("No remote video tag available, successful terminate event due to remote end will be no dispatched");

            self.emit('remotestream', {stream: stream, url: url});
          }
          else
          {
            self.emit('error', new Error("No remote streams are available"));
            return
          }
        };

        // Notify we created the connection successfully
        self.emit('start');
      };

      console.debug('answer: '+result.sdp);

      // Set answer description and init local environment
      pc.setRemoteDescription(new RTCSessionDescription(
      {
        type: 'answer',
        sdp: result.sdp
      }),
      success2,
      onerror);
    };


    var params =
    {
      sdp: pc.localDescription.sdp,
      constraints:
      {
        audio: options.audio,
        video: options.video
      }
    };

    console.debug('offer: '+params.sdp);

    self._start(params, success);
  };


  /**
   * Terminate the connection with the WebRTC media server
   */
  function close()
  {
    if(pc.signalingState == "closed")
      return;

    // Close the PeerConnection
    pc.close();
  };

  this.on('error',     close);
  this.on('terminate', close);


  // Mode set to send local audio and/or video stream
  if(this._audio.local || this._video.local)
    getUserMedia({'audio': this._audio.local, 'video': this._video.local},
    function(stream)
    {
      console.log('User has granted access to local media.');

      initRtc(stream);
    },
    onerror);

  // Mode set to only receive a stream, not send it
  else
    initRtc();
};
KwsWebRtcContent.prototype.__proto__   = Content.prototype;
KwsWebRtcContent.prototype.constructor = KwsWebRtcContent;


module.exports = KwsWebRtcContent;
},{"./Content":1}],5:[function(require,module,exports){
/*
 * (C) Copyright 2013 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 */

/**
 * @module kwsContentApi
 *
 * @copyright 2013 Kurento (http://kurento.org/)
 * @license LGPL
 */

var KwsContentPlayer   = require('./KwsContentPlayer');
var KwsContentUploader = require('./KwsContentUploader');
var KwsWebRtcContent   = require('./KwsWebRtcContent');


exports.KwsContentPlayer   = KwsContentPlayer;
exports.KwsContentUploader = KwsContentUploader;
exports.KwsWebRtcContent   = KwsWebRtcContent;
},{"./KwsContentPlayer":2,"./KwsContentUploader":3,"./KwsWebRtcContent":4}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],7:[function(require,module,exports){
/*
 * (C) Copyright 2014 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 */

//
// JsonRPC 2.0 pack & unpack
//

/**
 * Pack a JsonRPC 2.0 message
 *
 * @param {Object} message - object to be packaged. It requires to have all the
 *   fields needed by the JsonRPC 2.0 message that it's going to be generated
 *
 * @return {String} - the stringified JsonRPC 2.0 message
 */
function pack(message)
{
  var result =
  {
    jsonrpc: "2.0"
  };

  if(message.method)
  {
    result.method = message.method;

    if(message.params)
      result.params = message.params;
  };

  var id = message.id;
  if(id != undefined)
  {
    result.id = id;

    if(message.error)
      result.error = message.error;
    else if(message.value)
      result.value = message.value;
  };

  return JSON.stringify(result);
};

/**
 * Unpack a JsonRPC 2.0 message
 *
 * @param {String} message - string with the content of the JsonRPC 2.0 message
 *
 * @throws {TypeError} - Invalid JsonRPC version
 *
 * @return {Object} - object filled with the JsonRPC 2.0 message content
 */
function unpack(message)
{
  if(typeof message == 'string')
    message = JSON.parse(message);

  var version = message.jsonrpc;
  if(version != "2.0")
    throw new TypeError("Invalid JsonRPC version: "+version);

  return message;
};


//
// RPC message classes
//

/**
 * Representation of a RPC notification
 *
 * @class
 *
 * @constructor
 *
 * @param {String} method -method of the notification
 * @param params - parameters of the notification
 */
function RpcNotification(method, params)
{
  Object.defineProperty(this, 'method', {value: method, enumerable: true});
  Object.defineProperty(this, 'params', {value: params, enumerable: true});
};


//
// RPC-Builder
//

/**
 * @class
 *
 * @constructor
 */
function RpcBuilder()
{
  var requestID = 0;

  var requests  = {};
  var responses = {};


  /**
   * Representation of a RPC request
   *
   * @class
   * @extends RpcNotification
   *
   * @constructor
   *
   * @param {String} method -method of the notification
   * @param params - parameters of the notification
   * @param {Integer} id - identifier of the request
   */
  function RpcRequest(method, params, id)
  {
    RpcNotification.call(this, method, params);

    var previousResponse = responses[id];

    Object.defineProperty(this, 'duplicated',
    {
      value: Boolean(previousResponse)
    });

    /**
     * Generate a response to this message
     *
     * @param {Error} error
     * @param {*} value
     *
     * @returns {string}
     */
    this.response = function(error, value)
    {
      if(previousResponse)
        return previousResponse;

      var message = pack(
      {
        id:    id,
        error: error,
        value: value
      });

      responses[id] = message;

      return message;
    };
  };
  RpcRequest.prototype.__proto__   = RpcNotification.prototype;
  RpcRequest.prototype.constructor = RpcRequest;


  //
  // JsonRPC 2.0
  //

  /**
   * Generates and encode a JsonRPC 2.0 message
   *
   * @param {String} method -method of the notification
   * @param params - parameters of the notification
   * @param [callback] - function called when a response to this request is
   *   received. If not defined, a notification will be send instead
   *
   * @returns {string} A raw JsonRPC 2.0 request or notification string
   */
  this.encodeJSON = function(method, params, callback)
  {
    if(params instanceof Function)
    {
      if(callback != undefined)
        throw new SyntaxError("There can't be parameters after callback");

      callback = params;
      params = undefined;
    };

    var message =
    {
      method: method,
      params: params
    };

    if(callback)
    {
      var id = requestID++;
      message.id = id;

      requests[id] = callback;
    };

    return pack(message);
  };

  /**
   * Decode and process a JsonRPC 2.0 message
   *
   * @param {string} message - string with the content of the JsonRPC 2.0 message
   *
   * @returns {RpcNotification|RpcRequest|undefined} - the representation of the
   *   notification or the request. If a response was processed, it will return
   *   `undefined` to notify that it was processed
   *
   * @throws {TypeError} - Message is not defined
   */
  this.decodeJSON = function(message)
  {
    if(!message)
      throw new TypeError("Message is not defined");

    message = unpack(message);

    var id     = message.id;
    var method = message.method;
    var params = message.params;

    if(id != undefined)
    {
      // Request
      if(method)
        return new RpcRequest(method, params, id);

      // Response
      var request = requests[id];
      if(request)
      {
        var result = message.result;
        var error  = message.error;

        var result_undefined = result === undefined;
        var error_undefined  = error  === undefined;

        // Process request if only result or error is defined, not both or none
        if(result_undefined ^ error_undefined)
        {
          delete requests[id];

          request(error, result);
          return;
        };

        // Invalid response message
        if(result_undefined && error_undefined)
          throw new TypeError("No result or error is defined");
        throw new TypeError("Both result and error are defined");
      };

      // Request not found for this response
      throw new TypeError("No callback was defined for this message");
    };

    // Notification
    if(method)
      return new RpcNotification(method, params);

    throw new TypeError("Invalid message");
  };


  //
  // XML-RPC
  //

  /**
   * Generates and encode a XML-RPC message
   *
   * @param {String} method -method of the notification
   * @param params - parameters of the notification
   * @param [callback] - function called when a response to this request is
   *   received. If not defined, a notification will be send instead
   *
   * @returns {string} A raw JsonRPC 2.0 request or notification string
   */
  this.encodeXML = function(method, params, callback)
  {
    throw new TypeError("Not yet implemented");
  };

  /**
   * Decode and process a XML-RPC message
   *
   * @param {string} message - string with the content of the JsonRPC 2.0 message
   *
   * @returns {RpcNotification|RpcRequest|undefined} - the representation of the
   *   notification or the request. If a response was processed, it will return
   *   `undefined` to notify that it was processed
   *
   * @throws {TypeError}
   */
  this.decodeXML = function(message)
  {
    throw new TypeError("Not yet implemented");
  };
};


RpcBuilder.RpcNotification = RpcNotification;


module.exports = RpcBuilder;
},{}],8:[function(require,module,exports){
module.exports = XMLHttpRequest;
},{}]},{},[5])
(5)
});
;