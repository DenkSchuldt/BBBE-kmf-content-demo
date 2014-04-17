/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package manyToMany;

import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.HttpPlayerHandler;
import com.kurento.kmf.content.HttpPlayerService;
import com.kurento.kmf.content.HttpPlayerSession;
import com.kurento.kmf.media.HttpGetEndpoint;
import com.kurento.kmf.media.MediaPipeline;
import com.kurento.kmf.media.PlayerEndpoint;

/**
 * This handler allows a user to reproduce a previously recorded WEBM file.
 * 
 * @author Denny K. Schuldt
 */
@HttpPlayerService(path = "/player/*")
public class Player extends HttpPlayerHandler{

    @Override
    public void onContentRequest(HttpPlayerSession contentSession) throws Exception {
        String file_name = contentSession.getContentId();
        file_name = "file:///tmp/" + file_name + ".webm";
        // Media Pipeline
        MediaPipeline mp = contentSession.getMediaPipelineFactory().create();
        contentSession.releaseOnTerminate(mp);
        // Media Elements
        PlayerEndpoint playerEndpoint = mp.newPlayerEndpoint(file_name).build();
        contentSession.releaseOnTerminate(playerEndpoint);
        contentSession.setAttribute("player",playerEndpoint);
        HttpGetEndpoint httpGetEndpoint = mp.newHttpGetEndpoint().terminateOnEOS().build();
        contentSession.releaseOnTerminate(httpGetEndpoint);
        // Connect
        playerEndpoint.connect(httpGetEndpoint);
        // Start
        contentSession.start(httpGetEndpoint);
        playerEndpoint.play();
    }
    
    @Override
    public void onSessionTerminated(HttpPlayerSession contentSession, int code, String reason)throws Exception {
        PlayerEndpoint playerEndpoint = (PlayerEndpoint) contentSession.getAttribute("player");
        playerEndpoint.stop();
        super.onSessionTerminated(contentSession, code, reason);
    }    
}
