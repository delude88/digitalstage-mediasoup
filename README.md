
## Requirements

Since we are using node.js, npm and mediasoup you need to have the following frameworks installed first:

### Linux, Unix or macos
- node version >= v8.6.0
- python version 2 or 3
- make
- gcc and g++ >= 4.9 or clang

### Windows

- node version >= v8.6.0
- python version 2
- Visual Studio >= 2015

For more information please see: https://mediasoup.org/documentation/v3/mediasoup/installation/

## Install

To get started, checkout the repository and install all dependencies first:

    git clone https://github.com/delude88/digitalstage-mediasoup.git
    cd digitalstage-mediasoup
    cd client
    npm install
    cd ..
    cd server
    npm install
    
Then you can start the server by using

    cd server
    npm dev
    
Go ahead and open another terminal and start the client's webserver by

    cd client
    npm dev

Then open a modern browser (we recommend Google Chrome) and open

    http://localhost:3000/

### Google Chrome hints
Google Chrome will restrict the connection to the server, since we are using self-signed SSL certificates, so enable the usage of insecure localhost,
by opening the following link inside Google Chrome and enable the flag "allow insecure localhost":

    chrome://flags/#allow-insecure-localhost
    
### Firefox hints
If you are using e.g. Firefox instead, navigate to the following page:

    https://localhost:3001
    
Then a warning page should appear. Continue by accepting the insecure certificate. This will create an exception for localhost:3001 and thus the client application should work.
