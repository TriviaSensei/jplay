const { v4: uuidV4 } = require('uuid');
const pingInterval = 1000;
const pingTimeout = 500;
const Game = require('../public/js/utils/Game');
// const userTimeout = 5 * 60 * 1000;
const userTimeout = 2000;

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

const sanitizeData = (game) => {
	const toReturn = {
		...game,
	};
	delete toReturn.id;
	delete toReturn.host.socketId;
	toReturn.gameState.players.forEach((p) => {
		delete p.socketId;
	});
	return toReturn;
};

const getGameForUser = (id) => {
	return activeGames.find(
		(g) => g.host.uid === id || g.gameState.players.some((p) => p.uid === id)
	);
};

const setSocketId = (uid, socketId) => {
	const g = getGameForUser(uid);
	if (!g) return null;
	if (g.host.uid === uid) g.host.socketId = socketId;
	else
		g.gameState.players.some((p) => {
			if (p.uid === uid) {
				p.socketId = socketId;
				return true;
			}
			return false;
		});
	return g;
};

const removeGame = (id) => {
	activeGames = activeGames.filter((g) => {
		return g.id !== id;
	});
};

const socket = async (http, server) => {
	io = require('socket.io')(http, {
		pingInterval,
		pingTimeout,
	});
	io.listen(server);

	io.on('connection', async (socket) => {
		//get the user, see if they're reconnecting or something
		console.log(
			`A user has connected from ${socket.handshake.address} with socket ID ${socket.id}`
		);
		io.to(socket.id).emit('ack-connection', null);
		//user sends this to get a new UUID
		socket.on('request-id', (data, cb) => {
			return cb({
				status: 'OK',
				id: uuidV4(),
			});
		});
		//user sends this to get their gamestate back
		socket.on('verify-id', (data, cb) => {
			const activeGame = getGameForUser(data.id);
			//if we didn't find a game, then the player isn't part of one
			if (!activeGame)
				return cb({ status: 'OK', id: uuidV4(), gameState: null });
			//otherwise, send the gamestate back to the player
			else {
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

		socket.on('create-game', (data, cb) => {
			const g = new Game(
				data.rounds,
				{ uid: data.uid, socketId: socket.id },
				socket,
				null
			);
			cb({ status: 'OK', gameState: g.getGameState() });
		});

		socket.on('cancel-game', (data, cb) => {
			cb({ status: 'OK' });
		});

		socket.on('join-game', (data, cb) => {
			const gameToJoin = availableGames.find((g) => {
				return g.gameManager.getMatchId() === data.matchId;
			});
			if (!gameToJoin) return cb({ status: 'fail', message: 'Game not found' });
			cb({ status: 'OK' });
			joinGame(gameToJoin);
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
};

module.exports = socket;
