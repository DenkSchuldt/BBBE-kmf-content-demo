
package httpClient;

import useful.WebRTCParticipant;
import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.HttpPlayerHandler;
import com.kurento.kmf.content.HttpPlayerService;
import com.kurento.kmf.content.HttpPlayerSession;
import com.kurento.kmf.media.HttpEndpoint;
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
        
        contentSession.publishEvent(new ContentEvent("event","Map size: " + WebRtcInput.participants.size()));
        contentSession.publishEvent(new ContentEvent("event","ContentSession content Id: " + contentSession.getContentId()));
        for (WebRTCParticipant p : WebRtcInput.participants.values()){
            contentSession.publishEvent(new ContentEvent("event","WebRTCParticipant name: " + p.getUserName()));
            if(p.getUserName().equals(contentSession.getContentId())){
                contentSession.publishEvent(new ContentEvent("event","Names are equal."));
                // Media Elements
                HttpEndpoint httpEndpoint = mp.newHttpGetEndpoint().build();
                // Connect
                p.webrtcEndpoint.connect(httpEndpoint);
                // Start
                contentSession.start(httpEndpoint);
                contentSession.publishEvent(new ContentEvent("event","Connection stablished"));
                break;
            }else{
                contentSession.publishEvent(new ContentEvent("event","Names are different."));
            }
        }
    }
}
