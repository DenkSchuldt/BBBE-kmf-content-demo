/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package com.kurento.demo.webrtc;
import com.kurento.kmf.content.HttpPlayerHandler;
import com.kurento.kmf.content.HttpPlayerService;
import com.kurento.kmf.content.HttpPlayerSession;

/**
 *
 * @author Kal-EL
 */
@HttpPlayerService(path = "/player/*")
public class Player extends HttpPlayerHandler{
    @Override
    public void onContentRequest(HttpPlayerSession session) throws Exception {
        String path = "/tmp/video/" + session.getContentId();
        session.start(path);
    }
}
