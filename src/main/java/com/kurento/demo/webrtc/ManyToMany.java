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
import com.google.gson.reflect.TypeToken;
import com.kurento.kmf.content.ContentCommand;
import com.kurento.kmf.content.ContentCommandResult;
import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.WebRtcContentHandler;
import com.kurento.kmf.content.WebRtcContentService;
import com.kurento.kmf.content.WebRtcContentSession;
import com.kurento.kmf.media.MediaPipeline;
import com.kurento.kmf.media.WebRtcEndpoint;
import static java.lang.reflect.Modifier.TRANSIENT;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.servlet.http.HttpServletRequest;

/**
 * This handler implements a video conference for two users using
 * WebRtcEnpoints, each user has his own MediaPipeline and then in a new
 * connection, each user will watch the remote stream of the other.
 *
 * @author Denny K. Schuldt
 */
@WebRtcContentService(path = "/manyToMany/*")
public class ManyToMany extends WebRtcContentHandler {
    
    public static final String COMMAND_GET_PARTICIPANTS = "getParticipants";
    public static final String COMMAND_SELECT = "selectParticipant";
    public static final String COMMAND_CONNECT = "connectParticipant";
    public static final String EVENT_ON_JOINED = "onJoined";
    public static final String EVENT_ON_UNJOINED = "onUnjoined";

    private Map<String, WebRTCParticipant> participants;
    private String sessionId, httpid;
    private static final Gson gson = new GsonBuilder().excludeFieldsWithModifiers(TRANSIENT).create();

    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {

        sessionId = contentSession.getSessionId();
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
            contentSession.setAttribute("participant", participant);
            participants.put(remoteSession,participant);
            notifyJoined(participant);
        }
    }

    /*@Override
    public ContentCommandResult onContentCommand(WebRtcContentSession session,ContentCommand command) throws Exception {
        String cmdType = command.getType();
        String cmdData = command.getData();
        getLogger().info("onContentCommand: ({}, {})", cmdType, cmdData);
        if (COMMAND_GET_PARTICIPANTS.equalsIgnoreCase(cmdType)) {
            String json = gson.toJson(participants.values());
            return new ContentCommandResult(json);
        } else if (COMMAND_SELECT.equalsIgnoreCase(cmdType)) {
            return new ContentCommandResult(Boolean.toString(selectParticipant(session, cmdData)));
        } else if (COMMAND_CONNECT.equalsIgnoreCase(cmdType)) {
            Type listType = new TypeToken<List<String>>(){}.getType();
            List<String> idList = gson.fromJson(cmdData, listType);
            if (idList.size() != 2) {
                return new ContentCommandResult(Boolean.FALSE.toString());
            }
            return new ContentCommandResult(Boolean.toString(connectParticipant(idList.get(0),idList.get(1))));
        }
        return super.onContentCommand(session, command);
    }*/
    
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
    
    private void notifyJoined(WebRTCParticipant participant){
        for (WebRTCParticipant p : participants.values()) {
            if(!p.getId().equals(httpid))
                p.contentSession.publishEvent(new ContentEvent(EVENT_ON_JOINED,participant.toString()));
        }
    }

    private boolean selectParticipant(WebRtcContentSession session,String partId) {
        WebRTCParticipant partSelected = participants.get(partId);
        if (partSelected == null) {
            getLogger().error("Participant {} does not exist", partId);
            return false;
        }
        partSelected.endpoint.connect(((WebRTCParticipant) session.getAttribute("participant")).endpoint);
        return true;
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

    private void notifyUnjoined(WebRTCParticipant participant) {
        String json = gson.toJson(participant);
        getLogger().info("Participant unjoined: {}", json);
        for (WebRTCParticipant p : participants.values()) {
            p.contentSession.publishEvent(new ContentEvent(EVENT_ON_UNJOINED, json));
        }
    }
}
