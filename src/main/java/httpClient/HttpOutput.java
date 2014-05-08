
package httpClient;

import useful.WebRTCParticipant;
import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.HttpPlayerHandler;
import com.kurento.kmf.content.HttpPlayerService;
import com.kurento.kmf.content.HttpPlayerSession;
import com.kurento.kmf.media.HttpGetEndpoint;
import com.kurento.kmf.media.MediaPipeline;

/**
 * This handler allows a user to receive a shared streaming using a HttpEndpoint.
 * 
 * @author Denny K. Schuldt
 */
@HttpPlayerService(path = "/httpOutput/*")
public class HttpOutput extends HttpPlayerHandler{
   
    private MediaPipeline mp;
    
    @Override
    public void onContentRequest(HttpPlayerSession contentSession) throws Exception {
        
        if(mp == null){
            mp = WebRtcInput.mp;
        }
        
        for (WebRTCParticipant p : WebRtcInput.participants.values()){
            if(p.getUserName().equals(contentSession.getContentId())){
                // Media Elements
                HttpGetEndpoint httpGetEndpoint = mp.newHttpGetEndpoint().terminateOnEOS().build();
                // Connect
                p.webrtcEndpoint.connect(httpGetEndpoint);
                // Start
                contentSession.start(httpGetEndpoint);
                break;
            }
        }
    }
}
