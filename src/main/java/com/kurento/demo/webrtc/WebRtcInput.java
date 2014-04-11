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
 */

package com.kurento.demo.webrtc;

import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.HttpPlayerHandler;
import com.kurento.kmf.content.HttpPlayerService;
import com.kurento.kmf.content.HttpPlayerSession;
import com.kurento.kmf.content.WebRtcContentHandler;
import com.kurento.kmf.content.WebRtcContentService;
import com.kurento.kmf.content.WebRtcContentSession;
import com.kurento.kmf.media.HttpGetEndpoint;
import com.kurento.kmf.media.MediaPipeline;
import com.kurento.kmf.media.MediaProfileSpecType;
import com.kurento.kmf.media.RecorderEndpoint;
import com.kurento.kmf.media.WebRtcEndpoint;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.servlet.http.HttpServletRequest;

/**
 * This handler implements a video conference for many users using
 * WebRtcEnpoints, each user has his own MediaPipeline and then in a new
 * connection, each user will watch the remote stream of the other.
 *
 * @author Denny K. Schuldt
 */
@WebRtcContentService(path = "/webRtcInput/*")
public class WebRtcInput extends WebRtcContentHandler {
    
    public static final String EVENT_ON_JOINED = "onJoined";
    public static final String EVENT_ON_UNJOINED = "onUnjoined";
    public static String TARGET = "";

    public static Map<String, WebRTCParticipant> participants;
    private String http_session_id;
    private MediaPipeline mp;    
    
    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {
        
        HttpServletRequest http = contentSession.getHttpServletRequest();
        
        if (mp == null) {
            participants = new ConcurrentHashMap<String, WebRTCParticipant>();
            mp = contentSession.getMediaPipelineFactory().create();
            contentSession.releaseOnTerminate(mp);
        }
       
        String user_name = contentSession.getContentId();
        if(user_name == null || user_name.isEmpty()){
            user_name = contentSession.getSessionId();
        }

        http_session_id = http.getSession().getId();
        // Recording format
        MediaProfileSpecType mediaProfileSpecType = MediaProfileSpecType.WEBM; // mp4
        TARGET = "file:///tmp/" + user_name + ".webm"; // mp4
        // Endpoint
        WebRtcEndpoint webRtcEndpoint = mp.newWebRtcEndpoint().build();
        RecorderEndpoint recorderEndPoint = mp.newRecorderEndpoint(TARGET).withMediaProfile(mediaProfileSpecType).build();
        // Participant
        WebRTCParticipant participant = new WebRTCParticipant(user_name,http_session_id,contentSession,webRtcEndpoint,recorderEndPoint);
        participant.webrtcEndpoint.connect(participant.recorderEndpoint);
        getUsersBroadcasting(participant);
        notifyJoined(participant);
        participants.put(http_session_id,participant);

        contentSession.start(participant.webrtcEndpoint);
        participant.recorderEndpoint.record();
    }

    @Override
    public void onContentStarted(WebRtcContentSession contentSession) {
        for (WebRTCParticipant p : participants.values()) {
            if (p.contentSession.equals(contentSession)) {
                p.recorderEndpoint.record();
                break;
            }
        }
    }
    
    @Override
    public void onSessionTerminated(WebRtcContentSession contentSession,int code, String reason) throws Exception {
        WebRTCParticipant participant = null;
        for (WebRTCParticipant p : participants.values()) {
            if (p.contentSession.equals(contentSession)) {
                participant = (WebRTCParticipant) participants.get(p.getHttpSessionId());
                break;
            }
        }
        notifyUnjoined(participant);
        participant.webrtcEndpoint.release();
        participant.recorderEndpoint.stop();
        participant.recorderEndpoint.release();
        participant.contentSession.terminate(200,"No error");
        participants.remove(participant.getHttpSessionId());
        if (participants.isEmpty()) {
            participants.clear();
        }
        super.onSessionTerminated(contentSession, code, reason);
    }
    
    public boolean userExists(final String user) {
        for (WebRTCParticipant p : participants.values()) {
            if (p.getUserName().equalsIgnoreCase(user)) {
                return true;
            }
        }
        return false;
    }

    public void getUsersBroadcasting(WebRTCParticipant participant){        
        for (WebRTCParticipant p : participants.values()) {
            if (!p.getUserName().equalsIgnoreCase(participant.getUserName())) {
                participant.contentSession.publishEvent(new ContentEvent(EVENT_ON_JOINED,p.toString()));
            }
        }
    }
    
    private void notifyJoined(WebRTCParticipant participant){
        for (WebRTCParticipant p : participants.values()) {
            if(!p.getHttpSessionId().equals(http_session_id))
                p.contentSession.publishEvent(new ContentEvent(EVENT_ON_JOINED,participant.toString()));
        }
    }
    
    private void notifyUnjoined(WebRTCParticipant participant) {
        for (WebRTCParticipant p : participants.values()) {
            if(!p.getUserName().equals(participant.getUserName()))
                p.contentSession.publishEvent(new ContentEvent(EVENT_ON_UNJOINED, participant.toString()));
        }
    }
}
