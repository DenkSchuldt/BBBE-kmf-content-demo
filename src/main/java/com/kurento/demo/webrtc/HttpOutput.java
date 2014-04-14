/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package com.kurento.demo.webrtc;

import com.kurento.kmf.content.HttpPlayerHandler;
import com.kurento.kmf.content.HttpPlayerService;
import com.kurento.kmf.content.HttpPlayerSession;
import com.kurento.kmf.media.HttpEndpoint;
import com.kurento.kmf.media.MediaPipeline;

/**
 * This handler allows a user to receive a shared streaming using a HttpEndpoint
 * @author Denny K. Schuldt
 */
@HttpPlayerService(path = "/httpOutput/*")
public class HttpOutput extends HttpPlayerHandler{
    
    @Override
    public void onContentRequest(HttpPlayerSession contentSession) throws Exception {
        for (WebRTCParticipant p : WebRtcInput.participants.values()){
            if(p.getUserName().equals(contentSession.getContentId())){
                // Media Pipeline
                MediaPipeline pipeline = p.webrtcEndpoint.getMediaPipeline();
                // Media Elements
                HttpEndpoint httpEndpoint = pipeline.newHttpGetEndpoint().build();
                // Connect
                p.webrtcEndpoint.connect(httpEndpoint);
                // Start
                contentSession.start(httpEndpoint);
                break;
            }
        }
    }
}
