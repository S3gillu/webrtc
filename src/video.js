import React, { Component } from 'react';

let localPeerConnection;
let remotePeerConnection;
let localStream;
let remoteStream;

// Define initial start time of the call (defined as connection between peers).
let startTime = null;

class VideoCall extends Component {

    constructor(props) {
        super(props);
        this.state = {
            start: true,
            call: false,
            hangup: false
        }
    }

    componentDidMount() {
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        localVideo.addEventListener('loadedmetadata', this.logVideoLoaded.bind(this));
        remoteVideo.addEventListener('loadedmetadata', this.logVideoLoaded.bind(this));
        remoteVideo.addEventListener('onresize', this.logResizedVideo.bind(this));
    }

    // Add behavior for video streams.
    // Logs a message with the id and size of a video element.
    logVideoLoaded = (event) => {
        const video = event.target;
        this.trace(`${video.id} videoWidth: ${video.videoWidth}px, ` +
            `videoHeight: ${video.videoHeight}px.`);
    }

    logResizedVideo = (event) => {
        this.logVideoLoaded(event);
        if (startTime) {
            const elapsedTime = window.performance.now() - startTime;
            startTime = null;
            this.trace(`Setup time: ${elapsedTime.toFixed(3)}ms.`);
        }
    }

    // Handles start button action: creates local MediaStream.
    startAction = () => {
        const mediaStreamConstraints = {
            video: true,
            audio: true
        };
        this.setState({
            start: false,
            call: true
        });
        navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
            .then(this.gotLocalMediaStream.bind(this)).catch(this.handleLocalMediaStreamError.bind(this));
        this.trace('Requesting local stream.');
    }

    // Sets the MediaStream as the video element src.
    gotLocalMediaStream = (mediaStream) => {
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = mediaStream;
        localStream = mediaStream;
        this.trace('Received local stream.');
    }


    // Handles error by logging a message to the console.
    handleLocalMediaStreamError = (error) => {
        this.trace(`navigator.getUserMedia error: ${error.toString()}.`);
    }

    // Handles call button action: creates peer connection.
    callAction = () => {
        // Set up to exchange only video.
        const offerOptions = {
            offerToReceiveVideo: 1,
        };

        this.setState({
            hangup: true,
            call: false
        });
        this.trace('Starting call.');
        startTime = window.performance.now();

        // Get local media stream tracks.
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        if (videoTracks.length > 0) {
            this.trace(`Using video device: ${videoTracks[0].label}.`);
        }
        if (audioTracks.length > 0) {
            this.trace(`Using audio device: ${audioTracks[0].label}.`);
        }
        const servers = null;  // Allows for RTC server configuration.

        // Create peer connections and add behavior.
        localPeerConnection = new RTCPeerConnection(servers);
        this.trace('Created local peer connection object localPeerConnection.');

        localPeerConnection.addEventListener('icecandidate', this.handleConnection.bind(this));
        localPeerConnection.addEventListener(
            'iceconnectionstatechange', this.handleConnectionChange.bind(this));

        remotePeerConnection = new RTCPeerConnection(servers);
        this.trace('Created remote peer connection object remotePeerConnection.');

        remotePeerConnection.addEventListener('icecandidate', this.handleConnection.bind(this));
        remotePeerConnection.addEventListener(
            'iceconnectionstatechange', this.handleConnectionChange.bind(this));
        remotePeerConnection.addEventListener('addstream', this.gotRemoteMediaStream.bind(this));

        // Add local stream to connection and create offer to connect.
        localPeerConnection.addStream(localStream);
        this.trace('Added local stream to localPeerConnection.');

        this.trace('localPeerConnection createOffer start.');
        localPeerConnection.createOffer(offerOptions)
            .then(this.createdOffer.bind(this)).catch(this.setSessionDescriptionError.bind(this));
    }

    handleConnection = (event) => {
        const peerConnection = event.target;
        const iceCandidate = event.candidate;
        if (iceCandidate) {
            const newIceCandidate = new RTCIceCandidate(iceCandidate);
            const otherpeer = this.getOtherPeer(peerConnection);
            otherpeer.addIceCandidate(newIceCandidate)
                .then(() => {
                    this.handleConnectionSuccess(peerConnection);
                })
                .catch((error) => {
                    this.handleConnectionFailure(peerConnection, error);
                })

            this.trace(`${this.getPeerName(peerConnection)} ICE candidate:\n` +
                `${event.candidate.candidate}.`);
        }
    }

    handleConnectionChange = (event) => {
        const peerConnection = event.target;
        console.log('ICE state change event: ', event);
        this.trace(`${this.getPeerName(peerConnection)} ICE state: ` +
            `${peerConnection.iceConnectionState}.`);
    }

    // Logs offer creation and sets peer connection session descriptions.
    createdOffer = (description) => {
        this.trace(`Offer from localPeerConnection:\n${description.sdp}`);

        this.trace('localPeerConnection setLocalDescription start.');
        localPeerConnection.setLocalDescription(description)
            .then(() => {
                this.setLocalDescriptionSuccess(localPeerConnection);
            }).catch(this.setSessionDescriptionError.bind(this));

        this.trace('remotePeerConnection setRemoteDescription start.');
        remotePeerConnection.setRemoteDescription(description)
            .then(() => {
                this.setRemoteDescriptionSuccess(remotePeerConnection);
            }).catch(this.setSessionDescriptionError.bind(this));

        this.trace('remotePeerConnection createAnswer start.');
        remotePeerConnection.createAnswer()
            .then(this.createdAnswer.bind(this))
            .catch(this.setSessionDescriptionError.bind(this));

    }

    // Logs answer to offer creation and sets peer connection session descriptions.
    createdAnswer = (description) => {
        this.trace(`Answer from remotePeerConnection:\n${description.sdp}.`);

        this.trace('remotePeerConnection setLocalDescription start.');
        remotePeerConnection.setLocalDescription(description)
            .then(() => {
                this.setLocalDescriptionSuccess(remotePeerConnection);
            }).catch(this.setSessionDescriptionError.bind(this));

        this.trace('localPeerConnection setRemoteDescription start.');
        localPeerConnection.setRemoteDescription(description)
            .then(() => {
                this.setRemoteDescriptionSuccess(localPeerConnection);
            }).catch(this.setSessionDescriptionError.bind(this));

    }

    // Logs success when localDescription is set.
    setLocalDescriptionSuccess = (peerConnection) => {
        this.setDescriptionSuccess(peerConnection, 'setLocalDescription');
    }

    // Logs success when setting session description.
    setDescriptionSuccess = (peerConnection, functionName) => {
        const peerName = this.getPeerName(peerConnection);
        this.trace(`${peerName} ${functionName} complete.`);
    }

    // Logs error when setting session description fails.
    setSessionDescriptionError = (error) => {
        this.trace(`Failed to create session description: ${error.toString()}.`);
    }

    // Logs success when remoteDescription is set.
    setRemoteDescriptionSuccess(peerConnection) {
        this.setDescriptionSuccess(peerConnection, 'setRemoteDescription');
    }

    // Handles remote MediaStream success by adding it as the remoteVideo src.               
    gotRemoteMediaStream = (event) => {
        const mediaStream = event.stream;
        const remoteVideo = document.getElementById('remoteVideo');
        remoteVideo.srcObject = mediaStream;
        remoteStream = mediaStream;
        this.trace('Remote peer connection received remote stream.');
    }

    // Gets the "other" peer connection.
    getOtherPeer = (peerConnection) => {
        return (peerConnection === localPeerConnection) ?
            remotePeerConnection : localPeerConnection;
    }

    // Gets the name of a certain peer connection.                                    
    getPeerName = (peerConnection) => {
        return (peerConnection === localPeerConnection) ?
            'localPeerConnection' : 'remotePeerConnection';
    }

    // Logs that the connection succeeded.
    handleConnectionSuccess = (peerConnection) => {
        this.trace(`${this.getPeerName(peerConnection)} addIceCandidate success.`);
    };

    // Logs that the connection failed.
    handleConnectionFailure = (peerConnection, error) => {
        this.trace(`${this.getPeerName(peerConnection)} failed to add ICE Candidate:\n` +
            `${error.toString()}.`);
    }

    // Handles hangup action: ends up call, closes connections and resets peers.
    hangupAction = () => {
        this.setState({
            hangup: false,
            call: true
        });
        localPeerConnection.close();
        remotePeerConnection.close();
        localPeerConnection = null;
        remotePeerConnection = null;
        this.trace('Ending Call');
    }

    // Logs an action (text) and the time when it happened on the console.
    trace = (text) => {
        text = text.trim();
        const now = (window.performance.now() / 1000).toFixed(3);
        console.log(now, text);
    }


    render() {
        return (
            <div className="jumbotron">
                <video id='localVideo' autoPlay playsInline style={{ maxWidth: '100%', width: '320px' }}></video>
                <video id='remoteVideo' autoPlay playsInline style={{ maxWidth: '100%', width: '320px' }}></video>
                <div>
                    <button type="button" className="btn btn-info" id='startButton' onClick={this.startAction.bind(this)} disabled={!this.state.start}>Start Camera</button>
                    &nbsp;
                    <button type="button" className="btn btn-success" id='callButton' onClick={this.callAction.bind(this)} disabled={!this.state.call}>Call</button>
                    &nbsp;
                    <button type="button" className="btn btn-danger" id='hangupButton' disabled={!this.state.hangup} onClick={this.hangupAction.bind(this)}>Hangup</button>
                </div>
                <hr style={{ color: 'black' }} />
                <p>Created with <i className="fa fa-heart" style={{ color: 'red' }}></i> by shubham saurabh </p>
            </div>
        );
    }
}

export default VideoCall;