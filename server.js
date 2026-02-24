const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Game rooms storage
const rooms = new Map();

// Helper functions
function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]              // Diagonals
  ];

  for (let pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function isBoardFull(board) {
  return board.every(cell => cell !== null);
}

function createRoom(roomId) {
  return {
    id: roomId,
    players: [],
    spectators: [],
    board: Array(9).fill(null),
    currentPlayer: 'X',
    gameStatus: 'waiting', // waiting, playing, finished
    winner: null,
    createdAt: new Date()
  };
}

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('/rooms', (req, res) => {
  const activeRooms = Array.from(rooms.values()).map(room => ({
    id: room.id,
    players: room.players.length,
    spectators: room.spectators.length,
    status: room.gameStatus
  }));
  res.json(activeRooms);
});

// Socket.io events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new room
  socket.on('create_room', (data) => {
    const roomId = data.roomId || `room_${Date.now()}`;
    const playerName = data.playerName || `Player_${socket.id.slice(0, 5)}`;

    if (rooms.has(roomId)) {
      socket.emit('error', { message: 'Room already exists' });
      return;
    }

    const room = createRoom(roomId);
    room.players.push({
      id: socket.id,
      name: playerName,
      symbol: 'X'
    });

    rooms.set(roomId, room);
    socket.join(roomId);

    socket.emit('room_created', { roomId, room });
    io.to(roomId).emit('room_updated', room);
  });

  // Join an existing room
  socket.on('join_room', (data) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const name = playerName || `Player_${socket.id.slice(0, 5)}`;

    if (room.players.length < 2) {
      const symbol = room.players.length === 0 ? 'X' : 'O';
      room.players.push({
        id: socket.id,
        name: name,
        symbol: symbol
      });

      if (room.players.length === 2) {
        room.gameStatus = 'playing';
      }
    } else {
      // Join as spectator
      room.spectators.push({
        id: socket.id,
        name: name
      });
    }

    socket.join(roomId);
    socket.emit('room_joined', { roomId, room });
    io.to(roomId).emit('room_updated', room);
  });

  // Handle player move
  socket.on('make_move', (data) => {
    const { roomId, position } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Validate move
    if (room.board[position] !== null) {
      socket.emit('error', { message: 'Cell already occupied' });
      return;
    }

    const currentPlayerObj = room.players.find(p => p.symbol === room.currentPlayer);
    if (currentPlayerObj.id !== socket.id) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Make the move
    room.board[position] = room.currentPlayer;

    // Check for winner
    const winner = checkWinner(room.board);
    if (winner) {
      room.gameStatus = 'finished';
      room.winner = winner;
      io.to(roomId).emit('game_over', {
        winner: winner,
        board: room.board,
        message: `Player ${winner} wins!`
      });
    } else if (isBoardFull(room.board)) {
      room.gameStatus = 'finished';
      io.to(roomId).emit('game_over', {
        winner: null,
        board: room.board,
        message: 'Game is a draw!'
      });
    } else {
      // Switch player
      room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
      io.to(roomId).emit('move_made', {
        position: position,
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    }
  });

  // Reset game
  socket.on('reset_game', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    room.board = Array(9).fill(null);
    room.currentPlayer = 'X';
    room.gameStatus = 'playing';
    room.winner = null;

    io.to(roomId).emit('game_reset', room);
  });

  // Leave room
  socket.on('leave_room', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) return;

    // Remove player or spectator
    room.players = room.players.filter(p => p.id !== socket.id);
    room.spectators = room.spectators.filter(s => s.id !== socket.id);

    if (room.players.length === 0 && room.spectators.length === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted`);
    } else {
      io.to(roomId).emit('room_updated', room);
    }

    socket.leave(roomId);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Clean up player from all rooms
    for (let [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);

      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
      }
      if (spectatorIndex !== -1) {
        room.spectators.splice(spectatorIndex, 1);
      }

      if (room.players.length === 0 && room.spectators.length === 0) {
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('room_updated', room);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});