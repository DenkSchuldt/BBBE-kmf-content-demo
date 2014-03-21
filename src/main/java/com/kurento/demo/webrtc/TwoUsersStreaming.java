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
import java.util.HashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;


/**
 * This handler implements a video conference for two users using WebRtcEnpoints,
 * each user has his own MediaPipeline and then in a new connection, each user will
 * watch the remote stream of the other.
 * 
 * @author Denny K. Schuldt
 */
@WebRtcContentService(path = "/twoUsersStreaming/*")
public class TwoUsersStreaming extends WebRtcContentHandler {

    private HashMap<String,WebRtcEndpoint> hosts;
    private String sessionId;
    
    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {
       
        sessionId = contentSession.getSessionId();
        HttpServletRequest http = contentSession.getHttpServletRequest();
        
        if(hosts == null) hosts = new HashMap<String,WebRtcEndpoint>();
        
        String remoteSession = http.getSession().getId();
        contentSession.publishEvent(new ContentEvent("mediaevent","Esta es la IP del visitante: " + http.getRemoteAddr()));
        contentSession.publishEvent(new ContentEvent("mediaevent","Esta es la sesion: " + remoteSession));
        
        if(hosts.containsKey(remoteSession)){
            if(hosts.size() != 1) remoteSession = getDifferentSession(remoteSession);
            WebRtcEndpoint we = (WebRtcEndpoint) hosts.get(remoteSession);
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
            hosts.put(remoteSession, we);
        }
    }

    @Override
    public void onContentStarted(WebRtcContentSession contentSession) {
        //Empty
    }

    @Override
    public void onSessionTerminated(WebRtcContentSession contentSession,int code, String reason) throws Exception {
        if (contentSession.getSessionId().equals(sessionId)) {
            hosts.clear();
            hosts = null;
        }
        super.onSessionTerminated(contentSession, code, reason);
    }
    
    public String getDifferentSession(String value){
        String newSession = "";
        for (Map.Entry pairs : hosts.entrySet()) {
            if(!value.equals(pairs.getKey())){
                newSession = (String) pairs.getKey();
                break;
            }
            newSession = value;
        }
        return newSession;
    }
}
