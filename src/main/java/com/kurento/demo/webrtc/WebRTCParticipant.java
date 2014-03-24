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

    private String name;
    private String id;

    public final transient WebRtcEndpoint endpoint;
    public final transient WebRtcContentSession contentSession;

    public WebRTCParticipant(String name, String httpid, WebRtcEndpoint endpoint, WebRtcContentSession session) {
        this.name = name;
        this.id = httpid;
        this.endpoint = endpoint;
        this.contentSession = session;
    }

    public String getName() {
        return name;
    }

    public String getId() {
        return id;
    }
    
    @Override
    public String toString() {
        return"{\"name\":\""+this.name+"\",\"id\":\""+this.id+"\"}";
    }
}
