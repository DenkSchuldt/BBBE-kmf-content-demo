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
package com.kurento.demo.webrtc;

import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.WebRtcContentHandler;
import com.kurento.kmf.content.WebRtcContentService;
import com.kurento.kmf.content.WebRtcContentSession;
import com.kurento.kmf.media.HttpEndpoint;
import com.kurento.kmf.media.MediaPipeline;
import com.kurento.kmf.media.WebRtcEndpoint;

import static java.lang.reflect.Modifier.TRANSIENT;

import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import com.kurento.kmf.content.ContentCommand;
import com.kurento.kmf.content.ContentCommandResult;
import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.WebRtcContentHandler;
import com.kurento.kmf.content.WebRtcContentService;
import com.kurento.kmf.content.WebRtcContentSession;
import com.kurento.kmf.media.MediaPipeline;
import com.kurento.kmf.media.WebRtcEndpoint;
import com.kurento.demo.WebRTCParticipant;

/**
 * This handler implements a one to many video conference using WebRtcEnpoints;
 * the first session acts as "master", and the rest of concurrent sessions will
 * watch the "master" session in his remote stream; master's remote is a
 * loopback at the beginning, and it is changing with the stream of the each
 * participant in the conference.
 * 
 * @author Boni Garcia (bgarcia@gsyc.es)
 * @since 3.0.7
 * 
 * @Modified by Denny K. Schuldt
 */
@WebRtcContentService(path = "/multiUserStreaming/*")
public class multiUserStreaming extends WebRtcContentHandler {

    private WebRtcEndpoint firstWebRtcEndpoint;
    private HttpEndpoint firsthttpEndpoint;
    
    private String sessionId;

    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {

        if (firstWebRtcEndpoint == null) {
            MediaPipeline mp = contentSession.getMediaPipelineFactory().create();
            
            WebRtcEndpoint endpoint = mp.newWebRtcEndpoint().build();
            WebRTCParticipant participant = new WebRTCParticipant(Integer.toString(SelectableRoomHandler.globalId
                            .incrementAndGet()), name, endpoint, session);
            participant.endpoint.connect(participant.endpoint);
            session.start(participant.endpoint);
            session.setAttribute("participant", participant);
            participants.put(participant.getId(), participant);
            notifyJoined(participant);
            
            contentSession.releaseOnTerminate(mp);
            firstWebRtcEndpoint = mp.newWebRtcEndpoint().build();
            sessionId = contentSession.getSessionId();
            contentSession.releaseOnTerminate(firstWebRtcEndpoint);
            firstWebRtcEndpoint.connect(firstWebRtcEndpoint);
            contentSession.start(firstWebRtcEndpoint);
            
            contentSession.publishEvent(new ContentEvent("event","Bienvenido, usuario."));
	} else {
            MediaPipeline mp = firstWebRtcEndpoint.getMediaPipeline();
            WebRtcEndpoint newWebRtcEndpoint = mp.newWebRtcEndpoint().build();
            contentSession.releaseOnTerminate(newWebRtcEndpoint);
            firstWebRtcEndpoint.connect(newWebRtcEndpoint);
            newWebRtcEndpoint.connect(firstWebRtcEndpoint);
            contentSession.start(newWebRtcEndpoint);
            contentSession.publishEvent(new ContentEvent("event","Un nuevo usuario se ha conectado!"));
        }
    }

    @Override
    public void onContentStarted(WebRtcContentSession contentSession) {
        //Empty
    }

    @Override
    public void onSessionTerminated(WebRtcContentSession contentSession,int code, String reason) throws Exception {
        if (contentSession.getSessionId().equals(sessionId)) {
            getLogger().info("Terminating first WebRTC session");
            firstWebRtcEndpoint = null;
        }
        super.onSessionTerminated(contentSession, code, reason);
    }
}
