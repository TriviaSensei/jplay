const { v4: uuidV4 } = require('uuid');
const pingInterval = 200;
const pingTimeout = 60000;
const gameTimeout = 300000;
const Game = require('../public/js/utils/Game');

const catchSocketErr = (fn) => {
	return (data, cb) => {
		try {
			fn(data, cb);
		} catch (err) {
			return cb({ status: 'fail', message: err.message });
		}
	};
};

let io;

/**
 * {
 * 		id: asfasfasfs-asdf23rtg324-f113,
 * 		joinCode: 'ABCD',
 * 		host: {
 * 			uid: alwkejfewafwe-f32r2,
 * 			socketId: fweafwefawe
 * 		},
 * 		gameState: {
 * 			...
 * 			players: [
 * 				{
 * 					name: "Chuck",
 * 					uid: awefwea-f42t4234r-fsfdsfsd,
 * 					socketId: asdfasdfsadf,
 * 					lastDisconnect,
 * 					score: 0
 * 				},
 * 				...
 * 			]
 * 		}
 * }
 */
let activeGames = [];
let timeouts = [];

const sanitizeData = (game) => {
	return game.gameState;
};

const getGameForUser = (id) => {
	return activeGames.find(
		(g) =>
			(g.gameState.host?.uid && g.gameState.host.uid === id) ||
			g.gameState.players.some((p) => p.uid === id)
	);
};

const setSocketId = (uid, socketId) => {
	const g = getGameForUser(uid);

	if (!g) return null;
	if (g.gameState.host.uid === uid) g.gameState.host.socketId = socketId;
	else
		g.gameState.players.some((p) => {
			if (p.uid === uid) {
				p.setSocketId(socketId);
				return true;
			}
			return false;
		});
	return g;
};

const getGameById = (id) => {
	return activeGames.find((g) => g.id === id);
};

const getGameByPlayer = (uid) => {
	return activeGames.find(
		(g) =>
			g.gameState.host.uid === uid ||
			g.gameState.players.some((p) => p.uid === uid)
	);
};

const getGameForSocketId = (id) => {
	return activeGames.find(
		(g) =>
			g.gameState.host.socketId === id ||
			g.gameState.players.some((p) => p.socketId === id)
	);
};

const socket = async (http, server) => {
	io = require('socket.io')(http, {
		pingInterval,
		pingTimeout,
		maxHttpBufferSize: 1.3e7,
	});

	io.on('connection', async (socket) => {
		const sendError = (message) => {
			io.to(socket.id).emit('error', { message });
		};

		//get the user, see if they're reconnecting or something
		console.log(
			`A user has connected from ${socket.handshake.address} with socket ID ${socket.id}`
		);
		io.to(socket.id).emit('ack-connection', null);
		//user sends this to get a new UUID
		socket.on('request-id', (data, cb) => {
			console.log(`Requesting new ID`);
			return cb({
				status: 'OK',
				id: uuidV4(),
			});
		});
		//user sends this to get their gamestate back
		socket.on('verify-id', (data, cb) => {
			console.log(`Verifying id: ${data.id}`);
			const activeGame = getGameForUser(data.id);
			//if we didn't find a game, then the player isn't part of one
			if (!activeGame)
				return cb({ status: 'OK', id: uuidV4(), gameState: null });
			//otherwise, send the gamestate back to the player
			else {
				console.log(`Setting new socket ID (${socket.id}) for user ${data.id}`);
				setSocketId(data.id, socket.id);
				socket.join(activeGame.id);
				cb({
					status: 'OK',
					id: data.id,
					gameState: sanitizeData(activeGame),
				});
			}
		});

		const joinGame = (code) => {
			const game = activeGames.find(
				(g) => g.joinCode.toLowerCase() === code.toLowerCase()
			);
		};

		const removeGame = (gameId) => {
			io.to(gameId).emit('game-timeout', null);
			activeGames = activeGames.filter((g) => g.id !== gameId);
			timeouts = timeouts.filter((to) => to.id !== gameId);
		};

		const resetGameTimeout = (gameId) => {
			if (gameTimeout < 1) return;
			const to = timeouts.find((t) => t.id === gameId);
			if (!to)
				timeouts.push({
					id: gameId,
					timeout: setTimeout(() => removeGame(gameId), gameTimeout),
				});
			else {
				clearTimeout(to.timeout);
				to.timeout = setTimeout(() => removeGame(gameId), gameTimeout);
			}
		};

		//Things the host can emit
		socket.on('create-game', (data, cb) => {
			const g = new Game(
				data.rounds,
				{ uid: data.uid, socketId: socket.id, keys: data.hostKeys },
				io,
				null,
				null,
				process.env.NODE_ENV
			);
			console.log('creating game');
			resetGameTimeout(g.id);
			while (
				activeGames.some((gm) => gm.gameState.joinCode === g.gameState.joinCode)
			) {
				g.refreshJoinCode();
			}
			console.log(`Game ${g.gameState.id} created`);
			activeGames.push(g);
			socket.join(g.id);
			cb({ status: 'OK', gameState: g.getGameState() });
		});

		socket.on('cancel-game', (data, cb) => {
			const game = getGameForSocketId(socket.id);
			if (!game)
				return cb({ status: 'fail', message: 'You are not part of a game' });
			else if (game.gameState.host.socketId !== socket.id)
				return cb({
					status: 'fail',
					message: 'Only the host may cancel a game',
				});

			socket.to(game.id).emit('game-cancelled', null);
			activeGames = activeGames.filter((g) => g.id !== game.id);
			return cb({ status: 'OK' });
		});

		socket.on('edit-player', (data, cb) => {
			const game = getGameByPlayer(data.uid);
			if (!game)
				return cb({ status: 'fail', message: 'You are not part of a game' });
			resetGameTimeout(game.id);
			//if it's not the host doing the editing, return an error
			if (game.gameState.host.uid !== data.uid)
				return cb({
					status: 'fail',
					message: 'Only the host may edit players.',
				});

			const player = game.gameState.players[data.player];
			if (!data.name && !player.getName())
				return cb({ status: 'fail', message: 'You must specify a name' });
			if (data.name) player.setName(data.name);
			if (data.nameData) player.setNameData(data.nameData);
			if (data.key) player.setKey(data.key);
			player.isRemote = false;

			game.updateGameState();
			cb({ status: 'OK', gameState: game.getGameState() });
		});

		socket.on('edit-game-data', (data, cb) => {
			const game = getGameForSocketId(socket.id);
			if (!game)
				return cb({ status: 'fail', message: 'You are not part of a game' });
			resetGameTimeout(game.id);
			//if it's not the host doing the editing, return an error
			if (game.gameState.host.socketId !== socket.id)
				return cb({
					status: 'fail',
					message: 'Only the host may edit game data.',
				});

			game.gameState = {
				...game.gameState,
				...data.gameData,
			};

			socket.to(game.id).emit('update-game-state', game.getGameState());
			cb({
				status: 'OK',
				gameState: game.getGameState(),
			});
		});

		//game input
		socket.on(
			'game-input',
			catchSocketErr((data, cb) => {
				if (!Array.isArray(data) || data.length === 0)
					return cb({ status: 'fail', message: 'Invalid input' });
				const inp = data[0];
				let game = getGameForSocketId(socket.id);
				if (!game) throw new Error('You are not in a game');
				resetGameTimeout(game.id);
				//host input
				if (['host', 'correct', 'incorrect', 'start', 'clue'].includes(inp)) {
					if (game.gameState.host.socketId !== socket.id)
						throw new Error('Only the host may issue this command');
				}

				game.handleInput(...data);
				cb({ status: 'OK' });
				if (game.gameState.state === 'endGame') {
					activeGames = activeGames.filter((g) => g.id !== game.getId());
				}
			})
		);

		//Things players can emit
		socket.on('join-game', (data, cb) => {
			const game = activeGames.find(
				(g) => g.joinCode.toLowerCase() === data.joinCode.toLowerCase()
			);

			if (!game) return cb({ status: 'fail', message: 'Game not found' });

			resetGameTimeout(game.id);
			try {
				game.acceptNewPlayer({
					...data,
					socketId: socket.id,
				});
				socket.join(game.id);
				cb({ status: 'OK', gameState: game.gameState });
				socket
					.to(game.id)
					.emit('update-game-state', game.getGameData(['players']));
			} catch (err) {
				cb({ status: 'fail', message: err.message });
			}
		});

		socket.on('buzz', (cb) => {
			const g = getGameForSocketId(socket.id);
			if (!g) return cb({ status: 'fail', message: 'You are not in a game' });

			const ind = g.gameState.players.findIndex(
				(p) => p.socketId === socket.id
			);
			g.handleInput('player', ind);
			resetGameTimeout(g.id);
			cb({ status: 'OK' });
		});

		socket.on('save-fj-wager', (data, cb) => {
			const game = getGameForSocketId(socket.id);
			if (!game)
				return cb({ status: 'fail', message: 'You are not in a game' });
			resetGameTimeout(game.id);
			const ind = game.gameState.players.findIndex(
				(p) => p.socketId === socket.id
			);
			if (ind < 0) return cb({ status: 'fail', message: 'Player not found' });
			const wager = Number(data.wager);
			if (isNaN(wager))
				return cb({ status: 'fail', message: 'Your wager must be a number' });
			if (wager < 0 || wager > game.gameState.players[ind].score)
				return cb({ status: 'fail', message: 'Invalid wager' });
			else if (wager !== Math.floor(wager))
				return cb({
					status: 'fail',
					message: 'You can only wager a whole number',
				});

			game.gameState.players[ind].finalWager = data.wager;
			game.updateGameState();
			cb({ status: 'OK' });
		});

		socket.on('save-fj-response', (data, cb) => {
			const game = getGameForSocketId(socket.id);
			if (!game)
				return cb({ status: 'fail', message: 'You are not in a game' });
			resetGameTimeout(game.id);

			const ind = game.gameState.players.findIndex(
				(p) => p.socketId === socket.id
			);
			if (ind < 0) return cb({ status: 'fail', message: 'Player not found' });

			game.gameState.players[ind].finalResponse = data.response;
			game.updateGameState();
			cb({ status: 'OK' });
		});

		//spectate game
		socket.on('spectate-game', (data, cb) => {
			const game = activeGames.find(
				(g) => g.joinCode.toLowerCase() === data.joinCode.toLowerCase()
			);

			if (!game) return cb({ status: 'fail', message: 'Game not found' });

			game.gameState.spectators.push(data.uid);
			socket.join(game.id);
			cb({ status: 'OK', gameState: game.gameState });
		});
		socket.on('unspectate-game', (data, cb) => {
			//remove the player from the spectators of the game
			const game = activeGames.find((g) => {
				let toReturn = false;
				g.gameState.spectators = g.gameState.spectators.filter((s) => {
					if (s === data.uid) {
						toReturn = true;
						return false;
					}
					return true;
				});
				return toReturn;
			});
			if (!game)
				return cb({ status: 'fail', message: 'You are not in a game' });

			socket.leave(game.id);
			return cb({ status: 'OK' });
		});

		socket.on('disconnect', (reason) => {
			console.log(`a user has disconnected (${reason})`);
		});

		socket.on('log-game-state', (data, cb) => {
			const user = getConnectedUser(socket.id);
			if (!user) return cb({ status: 'fail', message: 'User not found' });

			const game = activeGames.find((g) => {
				return g.gameManager.getMatchId() === user.matchId;
			});
			if (!game) return cb({ status: 'fail', message: 'Game not found' });

			const result = game.gameManager.sanitizeGameState(null);
			cb({ status: 'OK' });
			console.log(JSON.stringify(result));
		});
	});

	io.listen(server);
};

module.exports = socket;
