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

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.WebRtcContentHandler;
import com.kurento.kmf.content.WebRtcContentService;
import com.kurento.kmf.content.WebRtcContentSession;
import com.kurento.kmf.media.MediaPipeline;
import com.kurento.kmf.media.WebRtcEndpoint;
import static java.lang.reflect.Modifier.TRANSIENT;
import java.util.HashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;

/**
 * This handler implements a video conference for two users using
 * WebRtcEnpoints, each user has his own MediaPipeline and then in a new
 * connection, each user will watch the remote stream of the other.
 *
 * @author Denny K. Schuldt
 */
@WebRtcContentService(path = "/manyToMany/*")
public class manyToMany extends WebRtcContentHandler {

    public static final String EVENT_ON_JOINED = "onJoined";
    public static final String EVENT_ON_UNJOINED = "onUnjoined";

    private HashMap<String, WebRTCParticipant> participants;
    private String sessionId;
    private static final Gson gson = new GsonBuilder().excludeFieldsWithModifiers(TRANSIENT).create();

    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {

        sessionId = contentSession.getSessionId();
        HttpServletRequest http = contentSession.getHttpServletRequest();

        if(participants == null){
            participants = new HashMap<String, WebRTCParticipant>();
        }
        String user = contentSession.getContentId();
        if(user == null || user.isEmpty()){
            user = "null";
        }
        if(exists(user)){
            contentSession.terminate(403, "Please select another name and try again.");
        }

        String remoteSession = http.getSession().getId();
        contentSession.publishEvent(new ContentEvent("mediaevent", "Esta es la IP del visitante: " + http.getRemoteAddr()));
        contentSession.publishEvent(new ContentEvent("mediaevent", "Esta es la sesion: " + remoteSession));

        if(participants.containsKey(remoteSession)){
            if(participants.size() != 1){
                remoteSession = getDifferentSession(remoteSession);
            }
            WebRtcEndpoint we = (WebRtcEndpoint) participants.get(remoteSession);
            MediaPipeline mp = we.getMediaPipeline();
            WebRtcEndpoint newWebRtcEndpoint = mp.newWebRtcEndpoint().build();
            contentSession.releaseOnTerminate(newWebRtcEndpoint);
            we.connect(newWebRtcEndpoint);
            contentSession.start(newWebRtcEndpoint);
        }else{
            MediaPipeline mp = contentSession.getMediaPipelineFactory().create();
            contentSession.releaseOnTerminate(mp);
            WebRtcEndpoint we = mp.newWebRtcEndpoint().build();
            contentSession.releaseOnTerminate(we);
            we.connect(we);
            contentSession.start(we);
            //participants.put(remoteSession, we);
        }
    }

    @Override
    public void onContentStarted(WebRtcContentSession contentSession){}

    @Override
    public void onSessionTerminated(WebRtcContentSession contentSession,int code, String reason) throws Exception {
        if (contentSession.getSessionId().equals(sessionId)) {
            participants.clear();
            participants = null;
        }
        super.onSessionTerminated(contentSession, code, reason);
    }
    
    

    private boolean exists(final String user) {
        for (WebRTCParticipant p : participants.values()) {
            if (p.getName().equalsIgnoreCase(user)) {
                return true;
            }
        }
        return false;
    }

    public String getDifferentSession(String value) {
        String newSession = "";
        for (Map.Entry pairs : participants.entrySet()) {
            if (!value.equals(pairs.getKey())) {
                newSession = (String) pairs.getKey();
                break;
            }
            newSession = value;
        }
        return newSession;
    }
    
    private boolean connectParticipant(String origId, String destId) {
        WebRTCParticipant orig = participants.get(origId);
        if(orig == null){
            getLogger().error("Participant {} does not exist", origId);
            return false;
        }
        WebRTCParticipant dest = participants.get(destId);
        if(dest == null){
            getLogger().error("Participant {} does not exist", destId);
            return false;
        }
        orig.endpoint.connect(dest.endpoint);
        return true;
    }
    
    private void notifyJoined(WebRTCParticipant participant){
        String json = gson.toJson(participant);
        getLogger().info("Participant joined: {}", json);
        for (WebRTCParticipant p : participants.values()) {
            p.session.publishEvent(new ContentEvent(EVENT_ON_JOINED, json));
        }
    }

    private void notifyUnjoined(WebRTCParticipant participant) {
        String json = gson.toJson(participant);
        getLogger().info("Participant unjoined: {}", json);
        for (WebRTCParticipant p : participants.values()) {
            p.session.publishEvent(new ContentEvent(EVENT_ON_UNJOINED, json));
        }
    }
}
