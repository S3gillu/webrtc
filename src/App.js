import React, { Component } from 'react';
import './App.css';
import Video from './video';

class App extends Component {
  render() {
    return (
      <div className="jumbotron">
        <header className="App-header">
          <h1 className="App-title">Welcome to Video Chat Module</h1>
          <h2>Realtime communication with WebRTC + ReactJS</h2>
        </header>
        <h3>Here it is</h3>
        &darr;
        <Video />
      </div>
    );
  }
}
export default App;
