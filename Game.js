import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import GameBoard from '../components/GameBoard';
import GameInfo from '../components/GameInfo';
import '../styles/Game.css';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [gameStatus, setGameStatus] = useState('waiting');
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState('');
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    const playerName = localStorage.getItem('playerName') || `Player_${Math.random().toString(36).substr(2, 9)}`;
    const isCreator = location.state?.isCreator || false;

    newSocket.on('connect', () => {
      console.log('Connected to server');

      if (isCreator) {
        newSocket.emit('create_room', { roomId, playerName });
      } else {
        newSocket.emit('join_room', { roomId, playerName });
      }
    });

    newSocket.on('room_created', (data) => {
      console.log('Room created:', data);
      setRoom(data.room);
      setPlayerSymbol('X');
      setMessage('Waiting for opponent...');
    });

    newSocket.on('room_joined', (data) => {
      console.log('Room joined:', data);
      setRoom(data.room);
      const player = data.room.players.find(p => p.id === newSocket.id);
      setPlayerSymbol(player?.symbol || null);
      setMessage(data.room.players.length === 2 ? 'Game Started!' : 'Waiting for opponent...');
    });

    newSocket.on('room_updated', (updatedRoom) => {
      console.log('Room updated:', updatedRoom);
      setRoom(updatedRoom);
      setBoard(updatedRoom.board);
      setCurrentPlayer(updatedRoom.currentPlayer);
      setGameStatus(updatedRoom.gameStatus);

      if (updatedRoom.players.length === 2 *
