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
import com.kurento.kmf.media.MediaPipeline;
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

    private Map<String, WebRTCParticipant> participants;
    private String httpid;

    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {

        HttpServletRequest http = contentSession.getHttpServletRequest();
        synchronized (this) {
            if (participants == null) {
                participants = new ConcurrentHashMap<String, WebRTCParticipant>();
            }
        }
       
        String user = contentSession.getContentId();
        if(user == null || user.isEmpty()){
            user = "null";
        }
        /*if(exists(user)){
            contentSession.terminate(403,"");
        }*/
        String remoteSession = http.getSession().getId();

        if(participants.containsKey(remoteSession)){
            for (WebRTCParticipant p : participants.values()) {
                if(p.getName().equals(user)){
                    MediaPipeline mp = p.endpoint.getMediaPipeline();
                    WebRtcEndpoint newWebRtcEndpoint = mp.newWebRtcEndpoint().build();
                    contentSession.releaseOnTerminate(newWebRtcEndpoint);
                    p.endpoint.connect(newWebRtcEndpoint);
                    contentSession.start(newWebRtcEndpoint);
                    break;
                }
            }
        }else{
            httpid = remoteSession;
            MediaPipeline mp = contentSession.getMediaPipelineFactory().create();
            contentSession.releaseOnTerminate(mp);
            WebRtcEndpoint we = mp.newWebRtcEndpoint().build();
            WebRTCParticipant participant = new WebRTCParticipant(user,remoteSession,we,contentSession);
            contentSession.releaseOnTerminate(participant.endpoint);
            participant.endpoint.connect(participant.endpoint);
            contentSession.start(participant.endpoint);
            participants.put(remoteSession,participant);
            getUsersBroadcasting(participant);
            notifyJoined(participant);
        }
    }

    @Override
    public void onSessionTerminated(WebRtcContentSession contentSession,int code, String reason) throws Exception {
        WebRTCParticipant participant = null;
        for (WebRTCParticipant p : participants.values()) {
            if (p.contentSession.equals(contentSession)) {
                participant = (WebRTCParticipant) participants.get(p.getId());
                break;
            }
        }
        notifyUnjoined(participant);
        if (participants.isEmpty()) {
            participants.clear();
        }
        super.onSessionTerminated(contentSession, code, reason);
    }
    
    public void getUsersBroadcasting(WebRTCParticipant participant){        
        for (WebRTCParticipant p : participants.values()) {
            if (!p.getName().equalsIgnoreCase(participant.getName())) {
                participant.contentSession.publishEvent(new ContentEvent(EVENT_ON_JOINED,p.toString()));
            }
        }
    }
    
    public boolean userExists(final String user) {
        for (WebRTCParticipant p : participants.values()) {
            if (p.getName().equalsIgnoreCase(user)) {
                return true;
            }
        }
        return false;
    }

    private void notifyJoined(WebRTCParticipant participant){
        for (WebRTCParticipant p : participants.values()) {
            if(!p.getId().equals(httpid))
                p.contentSession.publishEvent(new ContentEvent(EVENT_ON_JOINED,participant.toString()));
        }
    }
    
    private void notifyUnjoined(WebRTCParticipant participant) {
        for (WebRTCParticipant p : participants.values()) {
            if(!p.getName().equals(participant.getName()))
                p.contentSession.publishEvent(new ContentEvent(EVENT_ON_UNJOINED, participant.toString()));
        }
        participants.remove(participant.getId());
    }
}
