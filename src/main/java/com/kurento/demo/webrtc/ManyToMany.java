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
import com.kurento.kmf.content.WebRtcContentHandler;
import com.kurento.kmf.content.WebRtcContentService;
import com.kurento.kmf.content.WebRtcContentSession;
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
@WebRtcContentService(path = "/manyToMany/*")
public class ManyToMany extends WebRtcContentHandler {
    
    public static final String EVENT_ON_JOINED = "onJoined";
    public static final String EVENT_ON_UNJOINED = "onUnjoined";
    
    public static String TARGET = "file:///tmp/";

    private Map<String, WebRTCParticipant> participants;
    private String http_session_id;

    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {

        HttpServletRequest http = contentSession.getHttpServletRequest();
        synchronized (this) {
            if (participants == null) {
                participants = new ConcurrentHashMap<String, WebRTCParticipant>();
            }
        }
       
        String user_name = contentSession.getContentId();
        if(user_name == null || user_name.isEmpty()){
            user_name = "no_name";
        }
        /*if(exists(user)){
            contentSession.terminate(403,"");
        }*/
        String remote_session = http.getSession().getId();

        if(participants.containsKey(remote_session)){
            for (WebRTCParticipant p : participants.values()) {
                if(p.getUserName().equals(user_name)){
                    MediaPipeline mp = p.webrtcEndpoint.getMediaPipeline();
                    contentSession.releaseOnTerminate(mp);
                    WebRtcEndpoint newWebRtcEndpoint = mp.newWebRtcEndpoint().build();
                    contentSession.releaseOnTerminate(newWebRtcEndpoint);
                    p.webrtcEndpoint.connect(newWebRtcEndpoint);
                    contentSession.start(newWebRtcEndpoint);
                    break;
                }
            }
        }else{
            http_session_id = remote_session;
            MediaPipeline mp = contentSession.getMediaPipelineFactory().create();
            contentSession.releaseOnTerminate(mp);
            // Recording format
            MediaProfileSpecType mediaProfileSpecType = MediaProfileSpecType.WEBM; // WEBM
            TARGET = TARGET + user_name + ".webm"; // mp4
            // Endpoint
            WebRtcEndpoint webRtcEndpoint = mp.newWebRtcEndpoint().build();
            RecorderEndpoint recorderEndPoint = mp.newRecorderEndpoint(TARGET).withMediaProfile(mediaProfileSpecType).build();
            TARGET = "file:///tmp/";
            // Participant
            WebRTCParticipant participant = new WebRTCParticipant(user_name,http_session_id,contentSession,webRtcEndpoint,recorderEndPoint);
            participant.webrtcEndpoint.connect(participant.recorderEndpoint);
            participants.put(http_session_id,participant);
            getUsersBroadcasting(participant);
            notifyJoined(participant);
            contentSession.start(participant.webrtcEndpoint);
            participant.recorderEndpoint.record();
        }
    }

    @Override
    public void onContentStarted(WebRtcContentSession contentSession) {
        for (WebRTCParticipant p : participants.values()) {
            if (p.contentSession.equals(contentSession)) {
                p.recorderEndpoint.record();
                contentSession.publishEvent(new ContentEvent("event","This is the Uri: " + p.recorderEndpoint.getUri()));
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
