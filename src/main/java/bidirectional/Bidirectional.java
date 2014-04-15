
package bidirectional;

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
 * each user has his own MediaPipeline and then in a new connection, the users will
 * receive the remote stream of each other.
 * 
 * @author Denny K. Schuldt
 */
@WebRtcContentService(path = "/bidirectional/*")
public class Bidirectional extends WebRtcContentHandler {

    private HashMap<String,WebRtcEndpoint> hosts;
    private String sessionId;
    
    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {
       
        sessionId = contentSession.getSessionId();
        HttpServletRequest http = contentSession.getHttpServletRequest();
        
        if(hosts == null) hosts = new HashMap<String,WebRtcEndpoint>();
        
        String remoteSession = http.getSession().getId();
        contentSession.publishEvent(new ContentEvent("mediaevent","Remote Id: " + http.getRemoteAddr()));
        contentSession.publishEvent(new ContentEvent("mediaevent","Local Id: " + remoteSession));
        
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
    public void onSessionTerminated(WebRtcContentSession contentSession,int code, String reason) throws Exception {
        if (contentSession.getSessionId().equals(sessionId)) {
            hosts.clear();
            hosts = null;
        }
        super.onSessionTerminated(contentSession, code, reason);
    }
    
    /**
     * Get a different http session id.
     * @param  session current http session id
     * @return a different http session from the given one.
     */
    public String getDifferentSession(String session){
        String newSession = "";
        for (Map.Entry pairs : hosts.entrySet()) {
            if(!session.equals(pairs.getKey())){
                newSession = (String) pairs.getKey();
                break;
            }
            newSession = session;
        }
        return newSession;
    }
}
