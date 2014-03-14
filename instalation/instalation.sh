#!/bin/bash
echo "Dentro de 5s se iniciara el script. [Cerrar terminar para cancelar]"
sleep 5s
sudo apt-get install openjdk-7-jdk -y
sudo wget http://download.jboss.org/jbossas/7.1/jboss-as-7.1.1.Final/jboss-as-7.1.1.Final.tar.gz
sudo tar xfvz jboss-as-7.1.1.Final.tar.gz && sudo mv jboss-as-7.1.1.Final /opt/jboss
sudo adduser --system jboss && sudo addgroup jboss
sudo chown -R jboss:jboss /opt/jboss/
sudo adduser --system jboss && sudo addgroup jboss
sudo chown -R jboss:jboss /opt/jboss/

sudo cp ./init/jboss7 /etc/init.d/jboss7

sudo chmod 755 /etc/init.d/jboss7

sudo cp ./default/jboss7 /etc/default/jboss7

sudo update-rc.d jboss7 defaults
sudo apt-get install python-software-properties
sudo add-apt-repository ppa:kurento/kurento
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install libevent-dev kurento
sudo update-rc.d kurento defaults
sudo wget https://ci.kurento.com/video/video.tar.gz --no-check-certificate
sudo tar xfvz video.tar.gz && sudo mv video/ /opt/video && sudo chown -R jboss:jboss /opt/video
sudo wget https://ci.kurento.com/apps/fi-lab-demo.war --no-check-certificate
sudo mv fi-lab-demo.war /opt/jboss/standalone/deployments && sudo chown -R jboss:jboss /opt/jboss/standalone/deployments/fi-lab-demo.war
sudo /etc/init.d/jboss7 start

echo "Open a browser and verify that the default root web page work properly: http://<Service_IP_address>:8080/"

sudo /etc/init.d/kurento start

echo "Open a Chrome or Firefox web browser and type the URL: http://<Replace_with_KMS_IP_Address>:8080/fi-lab-demo/"


