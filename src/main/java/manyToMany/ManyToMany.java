
package manyToMany;

import useful.WebRTCParticipant;
import com.kurento.kmf.content.ContentEvent;
import com.kurento.kmf.content.WebRtcContentHandler;
import com.kurento.kmf.content.WebRtcContentService;
import com.kurento.kmf.content.WebRtcContentSession;
import com.kurento.kmf.media.MediaPipeline;
import com.kurento.kmf.media.MediaProfileSpecType;
import com.kurento.kmf.media.RecorderEndpoint;
import com.kurento.kmf.media.WebRtcEndpoint;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.servlet.http.HttpServletRequest;

/**
 * This handler allows a user to share and receive a stream using a WebRtcEndpoints,
 * and also record the input stream in a WEBM file.
 * 
 * @author Denny K. Schuldt
 */
@WebRtcContentService(path = "/manyToMany/*")
public class ManyToMany extends WebRtcContentHandler{
    
    public static final String EVENT_ON_JOINED = "onJoined";
    public static final String EVENT_ON_UNJOINED = "onUnjoined";
    public static String TARGET = "";

    public static Map<String, WebRTCParticipant> participants;
    public static MediaPipeline mp;
    private String http_session_id;
    
    @Override
    public synchronized void onContentRequest(WebRtcContentSession contentSession) throws Exception {
        
        HttpServletRequest http = contentSession.getHttpServletRequest();
        // Media Pipeline
        if (mp == null) {
            participants = new ConcurrentHashMap<String, WebRTCParticipant>();
            mp = contentSession.getMediaPipelineFactory().create();
            contentSession.releaseOnTerminate(mp);
        }
       
        String user_name = contentSession.getContentId();
        if(user_name == null || user_name.isEmpty()){
            user_name = contentSession.getSessionId();
        }
        
        http_session_id = http.getSession().getId();
        
        if(participants.containsKey(http_session_id)){
            for (WebRTCParticipant p : participants.values()) {
                if(p.getUserName().equals(user_name)){
                    MediaPipeline mp = p.webrtcEndpoint.getMediaPipeline();
                    WebRtcEndpoint newWebRtcEndpoint = mp.newWebRtcEndpoint().build();
                    contentSession.releaseOnTerminate(newWebRtcEndpoint);
                    p.webrtcEndpoint.connect(newWebRtcEndpoint);
                    contentSession.start(newWebRtcEndpoint);
                    break;
                }
            }
        }else{
            // Recording format
            MediaProfileSpecType mediaProfileSpecType = MediaProfileSpecType.WEBM; // mp4
            TARGET = "file:///tmp/" + user_name + ".webm"; // mp4
            // Media elements
            WebRtcEndpoint webRtcEndpoint = mp.newWebRtcEndpoint().build();
            RecorderEndpoint recorderEndPoint = mp.newRecorderEndpoint(TARGET).withMediaProfile(mediaProfileSpecType).build();
            // Participant
            WebRTCParticipant participant = new WebRTCParticipant(user_name,http_session_id,contentSession,webRtcEndpoint,recorderEndPoint);
            // Connect
            participant.webrtcEndpoint.connect(participant.recorderEndpoint);
            getUsersBroadcasting(participant);
            notifyJoined(participant);
            participants.put(http_session_id,participant);
            // Start
            contentSession.start(participant.webrtcEndpoint);
            participant.recorderEndpoint.record();
        }
    }
    
    @Override
    public void onSessionTerminated(WebRtcContentSession contentSession,int code, String reason) throws Exception {
        WebRTCParticipant participant = null;
        for (WebRTCParticipant p : participants.values()) {
            if (p.contentSession.equals(contentSession)) {
                participant = (WebRTCParticipant) participants.get(p.getHttpSessionId());
                break;
            }
        }
        notifyUnjoined(participant);
        participant.webrtcEndpoint.release();
        participant.recorderEndpoint.stop();
        participant.recorderEndpoint.release();
        participant.contentSession.terminate(200,"No error");
        participants.remove(participant.getHttpSessionId());
        if (participants.isEmpty()) {
            participants.clear();
        }
        super.onSessionTerminated(contentSession, code, reason);
    }
    
    /**
     * Get a notification for each existing producer
     * @param  user the name of the current user
     * @return true is the user name is already taken, or false if not.
     */
    public boolean userExists(final String user) {
        for (WebRTCParticipant p : participants.values()) {
            if (p.getUserName().equalsIgnoreCase(user)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get a notification for each existing producer
     * @param participant Producer who will receive the notifications
     */
    public void getUsersBroadcasting(WebRTCParticipant participant){        
        for (WebRTCParticipant p : participants.values()) {
            if (!p.getUserName().equalsIgnoreCase(participant.getUserName())) {
                participant.contentSession.publishEvent(new ContentEvent(EVENT_ON_JOINED,p.toString()));
            }
        }
    }
    
    /**
     * Notifies to all the clients that a participant has started broadcasting.
     * @param participant Producer to which clients may be subscribed
     */
    private void notifyJoined(WebRTCParticipant participant){
        for (WebRTCParticipant p : participants.values()) {
            if(!p.getHttpSessionId().equals(http_session_id))
                p.contentSession.publishEvent(new ContentEvent(EVENT_ON_JOINED,participant.toString()));
        }
    }
    
    /**
     * Notifies to all the clients that a participant has stoppped broadcasting.
     * @param participant Producer to which clients are subscribed
     */
    private void notifyUnjoined(WebRTCParticipant participant) {
        for (WebRTCParticipant p : participants.values()) {
            if(!p.getUserName().equals(participant.getUserName()))
                p.contentSession.publishEvent(new ContentEvent(EVENT_ON_UNJOINED, participant.toString()));
        }
    }
}
