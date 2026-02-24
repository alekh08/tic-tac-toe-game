import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';

function Home() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGame = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    setIsCreating(true);
    const newRoomId = `room_${Date.now()}`;
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('gameMode', 'create');
    navigate(`/game/${newRoomId}`, { state: { playerName, isCreator: true } });
  };

  const handleJoinGame = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('gameMode', 'join');
    navigate(`/game/${roomId}`, { state: { playerName, isCreator: false } });
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="home-title">🎮 Tic Tac Toe</h1>
        <p className="home-subtitle">Play with Friends in Real-Time</p>

        <form className="home-form" onSubmit={handleCreateGame}>
          <div className="form-group">
            <label htmlFor="playerName">Your Name</label>
            <input
              type="text"
              id="playerName"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength="20"
            />
          </div>

          <button type="submit" className="btn btn-primary">
            ✨ Create Game
          </button>
        </form>

        <div className="divider">OR</div>

        <form className="home-form" onSubmit={handleJoinGame}>
          <div className="form-group">
            <label htmlFor="roomId">Room ID</label>
            <input
              type="text"
              id="roomId"
              placeholder="Enter room ID to join"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-secondary">
            🚪 Join Game
          </button>
        </form>

        <div className="home-info">
          <p>💡 <strong>Tip:</strong> Create a game and share the Room ID with your friend to play together!</p>
        </div>
      </div>
    </div>
  );
}

export default Home;