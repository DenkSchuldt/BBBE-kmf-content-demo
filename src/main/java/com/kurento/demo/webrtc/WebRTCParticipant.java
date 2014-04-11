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

import com.kurento.kmf.content.WebRtcContentSession;
import com.kurento.kmf.media.RecorderEndpoint;
import com.kurento.kmf.media.WebRtcEndpoint;

/**
 * Participant for selectable one to many WebRTC video conference room.
 *
 * @author Miguel París Díaz (mparisdiaz@gmail.com)
 * @author Ivan Gracia (izanmail@gmail.com)
 * @author Boni Garcia (bgarcia@gsyc.es)
 * @since 4.0.1
 */
public class WebRTCParticipant {

    private String user_name;
    private String http_session_id;
    
    public final transient WebRtcContentSession contentSession;
    public final transient WebRtcEndpoint webrtcEndpoint;
    public final transient RecorderEndpoint recorderEndpoint;

    public WebRTCParticipant(String user_name, String http_session_id, WebRtcContentSession contentSession, WebRtcEndpoint webrtcEndpoint, RecorderEndpoint recorderEndpoint) {
        this.user_name = user_name;
        this.http_session_id = http_session_id;
        this.contentSession = contentSession;
        this.webrtcEndpoint = webrtcEndpoint;
        this.recorderEndpoint = recorderEndpoint;
    }

    public String getUserName() {
        return this.user_name;
    }

    public String getHttpSessionId() {
        return this.http_session_id;
    }
    
    @Override
    public String toString() {
        return "{\"name\":\""+this.user_name+"\",\"id\":\""+this.http_session_id+"\"}";
    }
}
