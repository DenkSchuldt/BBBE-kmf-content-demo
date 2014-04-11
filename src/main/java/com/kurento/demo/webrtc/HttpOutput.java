/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package com.kurento.demo.webrtc;

import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.HttpPlayerHandler;
import com.kurento.kmf.content.HttpPlayerService;
import com.kurento.kmf.content.HttpPlayerSession;
import com.kurento.kmf.media.HttpGetEndpoint;
import com.kurento.kmf.media.MediaPipeline;
import com.kurento.kmf.media.MediaProfileSpecType;
import com.kurento.kmf.media.PlayerEndpoint;

/**
 *
 * @author kalel_000
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
                HttpGetEndpoint httpEndpoint = pipeline.newHttpGetEndpoint()
                                                .withDisconnectionTimeout(1000)
                                                .withMediaProfile(MediaProfileSpecType.WEBM).build();
                // Connect
                PlayerEndpoint playerEndpoint = pipeline.newPlayerEndpoint("file:///tmp/"+p.getUserName()+".webm").build();
                playerEndpoint.connect(httpEndpoint);
                // Start
                contentSession.start(httpEndpoint);
                contentSession.publishEvent(new ContentEvent("onRemote","{\"name\":\""+p.getUserName()+"\",\"url\":\""+httpEndpoint.getUrl()+"\"}"));
                playerEndpoint.play();
                break;
            }
        }
    }

    @Override
    public void onContentStarted(HttpPlayerSession contentSession){
    }
}
