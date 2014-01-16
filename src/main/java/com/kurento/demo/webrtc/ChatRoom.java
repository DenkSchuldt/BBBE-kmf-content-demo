/*
 * (C) Copyright 2013 Kurento (http://kurento.org/)
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

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import com.kurento.kmf.content.WebRtcContentSession;

/**
 * 
 * @author Boni García (bgarcia@gsyc.es)
 * @version 1.0.0
 * 
 */
public class ChatRoom {

	private static ChatRoom singleton = null;

	// private ConcurrentMap<String, WebRtcEndpoint> sharedMap;
	private ConcurrentMap<String, WebRtcContentSession> sharedMap;

	private ChatRoom() {
		// sharedMap = new ConcurrentHashMap<String, WebRtcEndpoint>();
		sharedMap = new ConcurrentHashMap<String, WebRtcContentSession>();
	}

	public static ChatRoom getSingleton() {
		if (singleton == null) {
			singleton = new ChatRoom();
		}
		return singleton;
	}

	public ConcurrentMap<String, WebRtcContentSession> getSharedMap() {
		// public ConcurrentMap<String, WebRtcEndpoint> getSharedMap() {
		return sharedMap;
	}

}
