const ddDistribution = [
	[5, 756, 2491, 3636, 3112],
	[2, 99, 286, 382, 231],
];

const generateRandom = (dist) => {
	const s = dist.reduce((p, c) => p + c);
	let sum = 0;
	const x = Math.floor(Math.random() * s);
	return dist.findIndex((el) => {
		sum = sum + el;
		return sum >= x;
	});
};

const chars = 'abcdefghijklmnopqrstuvwxyz01234567890';
const letters = 'abcdefghijklmnopqrstuvwxyz';
const randomString = (len, str) => {
	let toReturn = '';
	for (var i = 0; i < len; i++) {
		toReturn = `${toReturn}${str.charAt(
			Math.floor(Math.random() * str.length)
		)}`;
	}
	return toReturn;
};

const lockTimeout = 250;
const clueTime = 3500;
const ddTime = 10000;
const FJTime = 31000;
const cluesPerRound = 30;

class Player {
	constructor(name, nameData, uid, socketId, key, isRemote) {
		this.name = name;
		this.nameData = Array.isArray(nameData) ? nameData : [];
		this.socketId = socketId;
		this.uid = uid || randomString(20, chars);
		this.score = 0;
		this.scoreHistory = [];
		this.locked = false;
		this.lockTimeout = null;
		this.key = key;
		this.isRemote = isRemote;
		this.finalWager = -1;
		this.finalResponse = '';
		this.finalCorrect = null;
	}

	isLocked() {
		return this.locked;
	}

	isRemote() {
		return this.isRemote;
	}

	setRemote(isRemote) {
		this.isRemote = isRemote;
	}

	setSocketId(id) {
		this.socketId = id;
	}

	getUID() {
		return this.uid;
	}

	getName() {
		return this.name;
	}

	getNameData() {
		return this.nameData;
	}

	getSocketId() {
		return this.socketId;
	}

	getScore() {
		return this.score;
	}

	getKey() {
		return this.key;
	}

	setKey(key) {
		this.key = key;
	}

	setName(name) {
		this.name = name;
	}

	setNameData(data) {
		this.nameData = Array.isArray(data) ? data : [];
	}

	setScore(score) {
		this.score = score;
	}

	setUID(uid) {
		this.uid = uid;
	}

	modifyScore(diff) {
		this.score = this.score + diff;
	}

	setFinalWager(wager) {
		if (wager < 0) throw new Error('Your final wager must be at least 0');
		else if (wager > this.getScore())
			throw new Error('Your final wager cannot exceed your score');
		this.finalWager = wager;
	}

	setFinalResponse(response) {
		if (!this.finalResponse) this.finalResponse = response;
		else throw new Error('You have already submitted a response');
	}

	getFinalWager() {
		return this.finalWager;
	}

	getFinalResponse() {
		return this.finalResponse;
	}

	getData() {
		const { name, socketId, uid, score, finalWager, finalResponse, key } = this;
		return {
			name,
			socketId,
			uid,
			score,
			finalWager,
			finalResponse,
			key,
		};
	}
}
/**
 * Input list:
 * - Start (start button)
 * - Player (any player buzzer)
 * - Host (the host button)
 * - Clue (a clue being selected)
 * - Correct/Incorrect (host indicating a correct/incorrect response)
 */

class Game {
	checkRoundOver() {
		const cluesUsed = this.gameState.board[this.gameState.round].reduce(
			(p, c) => {
				return p + c.clues.reduce((p2, c2) => p2 + (c2.selected ? 1 : 0), 0);
			},
			0
		);

		if (
			cluesUsed ===
				Math.floor(cluesPerRound / 2 && this.gameState.round === 0) ||
			cluesUsed === cluesPerRound
		)
			this.gameState.players.forEach((p) =>
				p.scoreHistory.unshift(p.getScore())
			);

		return !(
			this.gameState.board[this.gameState.round].some((cat) => {
				return cat.clues.some((cl) => !cl.selected);
			}) && cluesUsed < cluesPerRound
		);
	}

	getCluesLeft() {
		const round = this.gameState.round;
		if (round < 0 || round >= this.gameState.board.length - 1) return 0;

		const cluesSelected = this.gameState.board[round].reduce((p, c) => {
			return (
				p +
				c.clues.reduce((p2, c2) => {
					if (c2.selected) return p2 + 1;
					return p2;
				}, 0)
			);
		}, 0);

		return cluesPerRound - cluesSelected;
	}

	handleResponse(correct) {
		return () => {
			try {
				//someone has to be buzzed in, and there must be a selected clue
				if (this.gameState.buzzedIn < 0) return;
				const sc = this.gameState.selectedClue;
				if (sc.some((el) => el < 0)) return;
				const clue =
					this.gameState.board[this.gameState.round][sc[0]].clues[sc[1]];
				//adjust the score
				this.gameState.players[this.gameState.buzzedIn].modifyScore(
					correct ? clue.value : -clue.value
				);

				//a correct answer was given
				if (correct) {
					//unlock all buzzers
					this.unlockAll();
					//are there clues left?
					if (!this.checkRoundOver()) {
						//give control to the player that buzzed in and gave the correct response
						this.setGameState({
							state: 'select',
							control: this.gameState.buzzedIn,
							status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
								this.gameState.buzzedIn
							].getName()} to select a clue`,
						});
					}
					//round is over
					else {
						this.setGameState({
							state: 'betweenRounds',
							round: this.gameState.round + 1,
						});
					}
				}
				//an incorrect answer was given
				else {
					//lock this player out for the question
					this.gameState.players[this.gameState.buzzedIn].locked = true;
					//if any one is elibible, go back to clueLive
					if (this.gameState.players.some((p) => p.name && !p.isLocked())) {
						this.setGameState({
							state: 'clueLive',
							status: `Waiting for buzz`,
						});
						this.startClueTimer(clueTime, {
							buzzerArmed: false,
							buzzedIn: -1,
							state: 'clueTimedOut',
						});
					}
					//everyone is locked out - are there clues left?
					else if (!this.checkRoundOver()) {
						//unlock all buzzers
						this.unlockAll();
						//go back to select without changing control of board
						this.setGameState({
							state: 'select',
							status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
								this.gameState.control
							].getName()} to select a clue`,
						});
					} //round is over
					else {
						this.setGameState({
							state: 'betweenRounds',
							round: this.gameState.round + 1,
						});
					}
				}
			} catch (err) {
				return console.log(err);
			}
		};
	}

	handleDDResponse(correct) {
		this.stopClueTimer();
		const p = this.gameState.control;
		if (p < 0)
			throw new Error('Invalid game state - no player in control for DD');
		this.gameState.players[p].modifyScore(
			correct ? this.gameState.wager : -this.gameState.wager
		);
		//are there clues left?
		if (!this.checkRoundOver()) {
			//clear the wager
			this.setGameState({
				state: 'select',
				status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
					this.gameState.control
				].getName()} to select a clue`,
				wager: -1,
			});
		}
		//round is over
		else {
			this.setGameState({
				state: 'betweenRounds',
				round: this.gameState.round + 1,
				wager: -1,
			});
		}
	}

	handleFJResponse(correct) {
		if (this.gameState.fjStep % 4 !== 1) return;
		const { category, text, response } = this.gameState.board[2];
		const fjData = `${category.toUpperCase()}<br>${text}<br>${response}`;
		//player whose response we are judging
		const p = this.gameState.fjOrder[(this.gameState.fjStep - 1) / 4];
		const player = this.gameState.players[p];
		player.finalCorrect = correct;
		this.setGameState({
			fjStep: this.gameState.fjStep + 1,
			status: `${fjData}<br><br>${player.name}'s Final Jeopardy wager revealed. Press advance to continue.`,
		});
	}

	handleBuzz(p) {
		try {
			//if the player is locked, don't do anything
			if (this.gameState.players[p].isLocked()) return;

			//stop the clue timeout, set the game state
			this.stopClueTimer();
			const now = Date.now();
			this.setGameState({
				state: this.gameState.active ? 'buzz' : 'pregame',
				buzzedIn: p,
				buzzTime: now,
				currentTime: now,
				status: `${this.gameState.players[p].name} buzzed in`,
			});
		} catch (err) {
			return console.log(err);
		}
	}

	/**
	 * General Game States:
	 * - pregame: game has not started
	 * - boardIntro: fill board, show categories
	 * - select: waiting for active player to select a clue
	 * - showClue: clue is showing, but buzzer is not active
	 * - waitingDD: showing DD screen, waiting for a DD wager
	 * - DDLive: DD is live, buzzers not active
	 * - clueLive: clue is active, players may buzz in
	 * - buzz: a player is buzzed in
	 * - betweenRounds: a round has finished, waiting on host to start next round.
	 * - FJCategory: showing FJ category, waiting for wagers
	 * - showfJ: showing FJ clue, timer not live
	 * - FJLive: showing FJ clue, timer live
	 * - FJOver: progressing through FJ responses, wagers, and final scores
	 * - endGame: end of game
	 */

	stateMap = {
		all: {
			editPlayer: (ind, data) => {
				this.gameState.players[ind].setName(data.name);
				this.gameState.players[ind].setScore(data.score);
				this.updateGameState();
			},
		},
		//each state has a data attribute of game state attributes that are always true during that game state, but may change
		//from the immediately previous state
		//pregame: game has not started
		pregame: {
			data: {
				active: false,
				buzzerArmed: true,
				buzzTime: null,
				timeout: false,
				control: -1,
				wager: -1,
				selectedClue: [-1, -1],
				currentTime: null,
				modal: 'cancel-game-modal',
				modalDescription: 'Cancel game',
			},

			//representing an input when the game is in that state.
			//if the input is not valid from that state, then there is no function
			//for it. If it is a valid input, then the function will run and set the new game state.
			start: () => {
				if (
					this.gameState.players.length > 0 &&
					this.gameState.players.some((p) => p.getName() !== '')
				) {
					this.setGameState({
						state: 'boardIntro',
						round: 0,
						categoryShown: -2,
						status: 'Board intro - press advance to display next category',
					});
					// this.gameState.active = true;
					// this.gameState.state = 'betweenRounds';
					// this.gameState.round = 2;
					// this.gameState.players.forEach((p, i) => {
					// 	if (p.name) p.score = (i + 1) * 200;
					// });
					this.updateGameState();
				} else throw new Error('You must have at least one player.');
			},
			player: (p) => {
				if (this.gameState.buzzedIn === -1) this.handleBuzz(p);
				// this.setGameState({
				// 	buzzedIn: p,
				// });
			},
			host: () => {
				this.setGameState({
					buzzedIn: -1,
					status: this.pregameStatus,
				});
			},
		},
		//boardIntro: fill board, show categories
		boardIntro: {
			data: {
				active: true,
			},
			host: () => {
				if (
					this.gameState.categoryShown <
					this.gameState.board[this.gameState.round].length - 1
				) {
					this.setGameState({
						categoryShown: this.gameState.categoryShown + 1,
						status: `Press advance for next category`,
					});
				} else if (
					this.gameState.categoryShown ===
					this.gameState.board[this.gameState.round].length - 1
				) {
					const control = this.gameState.players.reduce((p, c, i) => {
						if (
							c.getName() !== '' &&
							c.getScore() < this.gameState.players[p].getScore()
						)
							return i;
						return p;
					}, 0);
					const roundNames = ['', 'Double ', 'Triple '];
					this.setGameState({
						control,
						state: 'select',
						message: `${this.gameState.players[control].getName()} starts the ${
							roundNames[this.gameState.round]
						}Jeopardy round.`,
						status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
							control
						].getName()} to select a clue`,
					});
				}
			},
		},
		//select: waiting for active player to select a clue
		select: {
			data: {
				buzzerArmed: false,
				buzzedIn: -1,
				buzzTime: null,
				wager: -1,
				selectedClue: [-1, -1],
				currentTime: null,
				timeout: false,
			},
			action: () => {
				this.gameState.players.forEach((p) => {
					p.locked = false;
				});
			},
			clue: (cat, row) => {
				const rd = this.gameState.round;
				const clue = this.gameState.board[rd][cat].clues[row];
				if (clue.selected) return;
				clue.selected = true;
				if (clue.dailyDouble)
					this.setGameState({
						state: 'waitingDD',
						playSound: true,
						selectedClue: [cat, row],
						status: `Waiting for Daily Double wager from ${this.gameState.players[
							this.gameState.control
						].getName()}`,
					});
				else
					this.setGameState({
						state: 'showClue',
						status: `Reading clue. Press advance to arm buzzers`,
						selectedClue: [cat, row],
					});
			},
		},
		//showClue: clue is showing, but buzzer is not active
		showClue: {
			//this only comes from the select state, and nothing changes between those states except for selected clue, which
			//is variable
			data: {},
			//the host activates the buzzers
			host: () => {
				//if the clue hasn't timed out, set it live on host input
				if (!this.gameState.timeout) {
					this.setGameState({
						state: 'clueLive',
					});
					this.startClueTimer(clueTime, {
						buzzerArmed: false,
						buzzedIn: -1,
						state: 'clueTimedOut',
						status: 'Clue timed out. Press advance to continue.',
					});
				}
				//go back to select screen or between rounds if the clue is timed out
				else {
					//are there clues left?
					if (!this.checkRoundOver()) {
						//back to the select screen
						this.setGameState({
							state: 'select',
							timeout: false,
							status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
								this.gameState.control
							].getName()} to select a clue`,
						});
					}
					//round is over
					else {
						this.setGameState({
							state: 'betweenRounds',
							round: this.gameState.round + 1,
						});
					}
				}
			},
			//a player tries to buzz but the clue isn't live
			player: (p) => {
				try {
					//if the clue is already timed out, do nothing
					if (this.gameState.timeout) return;
					//if the clue is not yet started, lock them out for a period
					this.lockPlayer(p, true);
					this.updateGameState(p);
				} catch (err) {
					return console.log(err);
				}
			},
		},
		//clueLive: clue is active, players may buzz in
		clueLive: {
			//can only come from showClue or buzz
			data: {
				buzzerArmed: true,
				buzzedIn: -1,
				buzzTime: null,
				currentTime: null,
				status: 'Waiting for buzz',
			},
			player: (p) => {
				this.handleBuzz(p);
			},
		},
		//clue timed out
		clueTimedOut: {
			data: {
				status: 'Clue timed out. Press "advance" to continue.',
			},
			host: () => {
				const state = this.gameState;
				if (this.checkRoundOver())
					this.setGameState({
						state: 'betweenRounds',
						round: state.round + 1,
						timeout: false,
					});
				else {
					this.setGameState({
						state: 'select',
						status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
							this.gameState.control
						].getName()} to select a clue`,
					});
					this.unlockAll();
				}
			},
		},
		//buzz: a player is buzzed in
		buzz: {
			//can only come from clueLive - buzzer is disarmed
			data: {
				buzzerArmed: false,
			},
			correct: this.handleResponse(true),
			incorrect: this.handleResponse(false),
		},
		//waitingDD: showing DD screen, waiting for a DD wager
		waitingDD: {
			data: { modal: 'dd-wager-modal', modalDescription: 'Enter DD Wager' },
			setWager: (wager) => {
				if (this.gameState.control === -1)
					throw new Error('Invalid game state');
				//make sure a valid wager has been submitted,
				const minWager = 5;
				const minMaxWager = (this.gameState.round + 1) * 1000;
				const p = this.gameState.players[this.gameState.control];
				const maxWager = Math.max(minMaxWager, p.getScore());
				if (wager < minWager || wager > maxWager)
					throw new Error(
						`Please submit a valid wager from $${minWager} to $${maxWager}`
					);
				//valid wager has been submitted - show the clue
				this.setGameState({
					wager,
					state: 'showDD',
				});
			},
		},
		//showDD: DD being read, no timer, no buzzers
		showDD: {
			data: {
				status: `Reading Daily Double clue - press advance to start timer`,
			},
			host: () => {
				this.setGameState({
					state: 'DDLive',
				});
				this.startClueTimer(ddTime, {
					state: 'DDTimedOut',
					timeout: true,
					playSound: true,
				});
			},
		},
		//DDLive: DD is live, buzzers not active
		DDLive: {
			data: {
				status: `Waiting for Daily Double response`,
			},
			correct: () => {
				this.handleDDResponse(true);
			},
			incorrect: () => {
				this.handleDDResponse(false);
			},
		},
		DDTimedOut: {
			data: {
				status:
					'Daily Double timed out. Indicate whether correct response was given to continue.',
			},
			correct: () => {
				this.handleDDResponse(true);
			},
			incorrect: () => {
				this.handleDDResponse(false);
			},
		},
		// betweenRounds: a round has finished, waiting on host to start next round.
		betweenRounds: {
			data: {
				control: -1,
				message: null,
				wager: -1,
				buzzerArmed: false,
				buzzedIn: -1,
				selectedClue: [-1, -1],
				timeout: false,
				status: `Between rounds. Press advance to continue`,
			},
			host: () => {
				//entering final jeopardy
				if (this.gameState.round === this.gameState.board.length - 1) {
					//make sure at least one player is eligible for FJ
					if (this.gameState.players.some((p) => p.getScore() > 0)) {
						this.setGameState({
							state: 'FJIntro',
							status: 'Introducing final Jeopardy. Press advance to continue.',
						});
					} else {
						this.setGameState({
							state: 'endGame',
							message: 'No player was eligible for Final Jeopardy.',
						});
					}
				}
				//entering next round
				else
					this.setGameState({
						state: 'boardIntro',
						categoryShown: -1,
					});
			},
		},
		FJIntro: {
			host: () => {
				this.setGameState({
					state: 'FJCategory',
					playSound: true,
				});
			},
		},
		//FJCategory: showing FJ category, waiting for wagers
		FJCategory: {
			data: {
				status: 'Showing Final Jeopardy category. Enter wagers.',
				data: { modal: 'fj-wager-modal', modalDescription: 'Enter FJ Wagers' },
			},
			host: () => {
				//make sure valid wagers have been submitted for anyone still in the game
				const inv = this.gameState.players.find(
					(p) =>
						p.getScore() > 0 &&
						(p.getFinalWager() < 0 || p.getFinalWager() > p.getScore())
				);
				if (inv)
					throw new Error(`Invalid or missing wager from ${inv.getName()}`);

				//valid wager has been submitted - show the clue
				this.setGameState({
					state: 'showFJ',
					status: `Showing Final Jeopardy - press advance to start timer.`,
				});
			},
			setWager: (wagers) => {
				//find any invalid wager
				const inv = wagers.find((w) => {
					//if the player index is valid
					if (w.player >= 0 && w.player < this.gameState.players.length) {
						//if the score is not positive, the wager is ignored
						//if the wager is in the correct range, we're good
						if (
							this.gameState.players[w.player].getScore() <= 0 ||
							(w.wager >= 0 &&
								w.wager <= this.gameState.players[w.player].getScore())
						) {
							this.gameState.players[w.player].finalWager = w.wager || 0;
							return false;
						}
					}
					//otherwise, this wager is invalid
					return true;
				});
				if (inv) {
					throw new Error(
						`Invalid wager data for player ${this.gameState.players[
							inv.player
						].getName()}`
					);
				} else {
					this.setGameState({
						state: 'showFJ',
					});
				}
			},
		},
		//showfJ: showing FJ clue, timer not live
		showFJ: {
			data: {
				status: `Showing Final Jeopardy - press advance to start timer.`,
			},
			host: () => {
				const fjOrder = this.gameState.players
					.map((p, i) => {
						return {
							...p,
							index: i,
						};
					})
					.filter((p) => p.score > 0)
					.sort((a, b) => {
						for (var i = 0; i < a.scoreHistory.length; i++) {
							const diff = a.scoreHistory[i] - b.scoreHistory[i];
							if (diff !== 0) return diff;
						}
						return a.index - b.index;
					})
					.map((el) => el.index);
				this.setGameState({
					state: 'FJLive',
					fjOrder,
					playSound: true,
				});
				this.startClueTimer(FJTime, {
					state: 'FJOver',
					fjStep: -1,
					fjLock: true,
				});
			},
		},
		//FJLive: showing FJ clue, timer live
		FJLive: {
			data: {
				status: `Final Jeopardy is live.`,
				modal: 'fj-response-modal',
				modalDescription: 'Enter FJ Responses',
			},
			setFJResponses: (responses) => {
				responses.forEach((res) => {
					this.gameState.players[res.player].finalResponse = res.response;
				});
				this.updateGameState();
			},
			setFJResponse: (player, response) => {
				if (player >= 0 && player < this.gameState.players.length) {
					this.gameState.players[player].finalResponse = response;
				}
			},
		},
		FJOver: {
			data: {
				status: `Final Jeopardy timer has expired. Host may finish entering responses.`,
				modal: 'fj-response-modal',
				modalDescription: 'Enter FJ Responses',
			},
			host: () => {
				const maxStep = this.gameState.fjOrder.length * 4 - 1;

				if (this.gameState.fjStep % 4 === 1) return;
				const { category, text, response } = this.gameState.board[2];
				const fjData = `${category.toUpperCase()}<br>${text}<br>${response}`;

				if (this.gameState.fjStep < maxStep) {
					const fjStep = this.gameState.fjStep + 1;
					const fjPlayer =
						this.gameState.players[
							this.gameState.fjOrder[Math.floor(fjStep / 4)]
						];
					const fjSubstep = fjStep % 4;

					const newStatus =
						fjSubstep === 0
							? `Revealing Final Jeopardy for ${fjPlayer.name}. Press advance to continue.`
							: fjSubstep === 1
							? `${fjPlayer.name}'s Final Jeopardy response revealed. Press correct/incorrect to set result.`
							: fjSubstep === 2
							? `${fjPlayer.name}'s Final Jeopardy wager revealed. Press advance to continue`
							: `${fjPlayer.name}'s result set. Press advance to continue.`;
					if (fjSubstep === 3) {
						const ind =
							this.gameState.fjOrder[Math.floor(this.gameState.fjStep / 4)];
						const p = this.gameState.players[ind];
						p.setScore(p.getScore() + (p.finalCorrect ? 1 : -1) * p.finalWager);
					}
					this.setGameState({
						fjStep,
						status: `${fjData}<br><br>${newStatus}`,
					});
				} else {
					const maxScore = this.gameState.players.reduce((p, c) => {
						if (c.score > p) return c.score;
						return p;
					}, 0);
					const winners = this.gameState.players
						.filter((p) => p.score === maxScore)
						.map((p) => p.name);

					const newStatus = `${winners.join(', ')} ${
						winners.length === 1 ? 'wins' : 'win'
					} with $${maxScore.toLocaleString('en')}`;
					this.setGameState({
						state: 'endGame',
						status: newStatus,
						message: 'The game has ended',
					});
				}
			},
			correct: () => {
				this.handleFJResponse(true);
			},
			incorrect: () => {
				this.handleFJResponse(false);
			},
		},
		endGame: {
			host: () => {
				this.gameState = null;
				this.updateGameState();
			},
		},
	};

	refreshJoinCode = () => {
		this.joinCode = randomString(4, letters);
		this.gameState.joinCode = this.joinCode;
	};

	constructor(board, host, io, socket, stateHandler) {
		this.id = randomString(20, chars);
		this.joinCode = randomString(4, letters);
		// this.joinCode = 'A';
		this.io = io;
		this.socket = socket;
		if (this.socket) {
			this.socket.on('update-game-state', (data) => {
				if (data.reset) {
					delete data.reset;
					if (this.stateHandler) this.stateHandler.setState(data);
				} else if (data.cancelGame && this.stateHandler)
					this.stateHandler.setState(null);
				else if (this.stateHandler) {
					const state = this.stateHandler.getState();
					const newState = {
						...state,
						...data,
					};
					this.stateHandler.setState(newState);
				}
				this.setGameState(data);
			});
		}
		this.stateHandler = stateHandler;
		this.isRemote = io ? true : false;
		this.clueTimeout = null;
		//randomly place the DDs by distribution
		const dd1c = Math.floor(Math.random() * board[0].length);
		const dd1r = generateRandom(ddDistribution[0]);

		const dd2c = [];
		for (var i = 0; i < board[1].length; i++) {
			if (Math.random() <= (2 - dd2c.length) / (board[1].length - i)) {
				dd2c.push(i);
			}
			if (dd2c.length === 2) break;
		}

		const dd2r = dd2c.map((el) => generateRandom(ddDistribution[1]));
		this.pregameStatus = `Pregame - ${
			this.isRemote
				? 'share join code or have players join locally'
				: 'enter player names on main screen'
		}, test the buzzers, then press "advance" when ready.${
			this.isRemote ? `<br><br>Join code: ${this.joinCode.toUpperCase()}` : ''
		}`;
		this.gameState = {
			active: false, //whether the game is active
			state: 'pregame',
			status: this.pregameStatus,
			joinCode: this.joinCode,
			isRemote: this.isRemote,
			buzzerArmed: false, //whether a buzz will be accepted
			buzzedIn: -1, //which player (0,1,2) is buzzed in, -1 if no one
			buzzTime: null,
			timeout: false,
			categoryShown: -2,
			control: -1, //which player has control of the board, -1 if no one
			wager: -1, //the DD wager for the active clue, -1 if N/A
			host, //host info (socket ID, UID)
			id: this.id,
			players: [], //player info (name, socketID, UID, key, score)
			board: board.map((r, i) => {
				if (i === 2) return r;
				else if (i === 0)
					return r.map((cat, j) => {
						return {
							...cat,
							clues: cat.clues.map((clue, k) => {
								return {
									...clue,
									value: (k + 1) * 200,
									selected: false,
									dailyDouble: k === dd1r && j === dd1c,
								};
							}),
						};
					});
				else if (i === 1)
					return r.map((cat, j) => {
						return {
							...cat,
							clues: cat.clues.map((clue, k) => {
								return {
									...clue,
									value: (k + 1) * 400,
									selected: false,
									dailyDouble:
										(k === dd2r[0] && j === dd2c[0]) ||
										(k === dd2r[1] && j === dd2c[1]),
								};
							}),
						};
					});
			}), //array of rounds. 0 and 1 are arrays of categories, each with an array of clues. 2 is FJ
			selectedClue: [-1, -1], //selected clue (category, row)
			currentTime: null,
			playSound: false,
			message: null,
			fjOrder: null,
			fjStep: -1,
			fjLock: false,
			fjPrefix: 'What is',
			round: -1,
			ddTime,
			clueTime,
			FJTime,
			modal: 'cancel-game-modal',
			modalDescription: 'Cancel game',
		};

		for (var i = 0; i < 3; i++) {
			this.addBlankPlayer();
		}
		// start in FJ for testing
		// this.gameState.active = true;
		// this.gameState.state = 'betweenRounds';
		// this.gameState.round = 2;
		// this.gameState.players.forEach((p, i) => {
		// 	p.score = (i + 1) * 200;
		// });
		/******************/

		this.updateGameState();
	}

	getId() {
		return this.id;
	}

	sanitizeGameState() {
		return {
			...this.gameState,
			currentTime: Date.now(),
			board: this.gameState.board.map((r, i) => {
				if (i === 2) return r;
				else if (Array.isArray(r)) {
					return r.map((cat, j) => {
						return {
							...cat,
							clues: cat.clues.map((clue) => {
								const temp = {
									...clue,
								};
								delete temp.dailyDouble;
								return temp;
							}),
						};
					});
				}
			}),
		};
	}

	getGameState(sanitize) {
		if (sanitize) return this.sanitizeGameState();
		return {
			...this.gameState,
			currentTime: Date.now(),
		};
	}

	getGameData(items) {
		const toReturn = {};
		items.forEach((item) => (toReturn[item] = this.gameState[item]));
		return toReturn;
	}

	//update the state handler.
	//if it's the host for a remote game (io is not null), send the new state
	updateGameState(player) {
		if (this.stateHandler) this.stateHandler.setState(this.gameState);
		if (this.io?.to) {
			if (
				(typeof player).toLowerCase() === 'number' &&
				player >= 0 &&
				player < this.gameState.players.length
			) {
				const p = this.gameState.players[player];
				if (!p.socketId)
					this.io
						.to(this.gameState.host.socketId)
						.emit('update-game-state', this.gameState);
				else this.io.to(p.socketId).emit('update-game-state', this.gameState);
			} else this.io.to(this.getId()).emit('update-game-state', this.gameState);
		}
		this.gameState.playSound = false;
	}

	isRemote() {
		return this.isRemote;
	}

	addPlayer(name, nameData, id) {
		if (this.gameState.players.length >= 3) return;
		const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
		const toAdd = new Player(
			name,
			nameData,
			id || randomString(20, chars),
			null,
			keys[this.gameState.players.length],
			false
		);
		this.gameState.players.push(toAdd);
		this.updateGameState();
	}

	addBlankPlayer() {
		this.addPlayer('', null, null);
	}

	acceptNewPlayer(data) {
		const ind = this.gameState.players.findIndex((p) => p.name === '');
		if (ind === -1) throw new Error('Game is full');
		else {
			const player = this.gameState.players[ind];
			player.setName(data.name);
			player.setNameData(data.nameData);
			player.setSocketId(data.socketId);
			player.setUID(data.uid);
			player.setRemote(true);
		}
	}

	resetPlayer(index) {
		if (this.gameState.players.length > index && index >= 0) {
			const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
			this.gameState.players[index].setName('');
			this.gameState.players[index].uid = randomString(20, chars);
			this.gameState.players[index].nameData = [];
			this.gameState.players[index].setKey(keys[index]);
			this.gameState.players[index].setRemote(this.isRemote);
			this.gameState.players[index].setSocketId(null);
			this.updateGameState();
		}
	}

	shufflePlayers() {
		if (this.gameState.active) return;
		const temp = this.gameState.players.map((p) => {
			return {
				player: p,
				order: Math.random(),
			};
		});
		temp.sort((a, b) => a.order - b.order);
		this.gameState.players = temp.map((p) => {
			return p.player;
		});
		this.updateGameState();
	}

	swapPlayers(a, b) {
		if (
			a >= this.gameState.players.length ||
			b >= this.gameState.players.length ||
			this.gameState.active
		)
			return;
		[this.gameState.players[a], this.gameState.players[b]] = [
			this.gameState.players[b],
			this.gameState.players[a],
		];
		this.updateGameState();
	}

	handleInput(...args) {
		if (args.length === 0) return;
		//the input
		const fn = args.shift();
		//the current game state
		const gs = this.gameState.state;
		//the function to run as a result
		let st = this.stateMap[gs];
		if (!st) throw new Error(`Invalid game state (${gs})`);
		let f = st[fn];
		if (!f) f = this.stateMap.all[fn];
		//invalid input for this state - don't do anything
		if (!f) return;
		f(...args);
	}

	setGameState(state) {
		let newData = {};
		let action;
		this.gameState.modal = '';
		this.gameState.modalDescription = '';
		//if we are entering a new general game state, populate the basic data
		if (state.state && state.gameState !== this.gameState.state) {
			const newState = state.state;
			if (this.stateMap[newState]?.data) {
				newData = this.stateMap[newState].data;
				if (this.stateMap[newState].action)
					action = this.stateMap[newState].action;
			}
		}
		this.gameState = {
			...this.gameState,
			...state,
			...newData,
		};
		if (action) action();
		this.updateGameState();
		if (this.gameState.message) this.gameState.message = '';
		if (this.gameState.playSound) this.gameState.playSound = false;
	}

	setPlayerScore(player, score) {
		if (player >= this.gameState.players.length) return this.gameState;
		else this.gameState.players[player].setScore(score);
		this.updateGameState();
	}

	setPlayerKey(player, key) {
		if (player >= this.gameState.players.length) return this.gameState;
		else this.gameState.players[player].setKey(key);
		this.updateGameState(player);
	}

	modifyPlayerScore(player, diff) {
		if (player >= this.gameState.players.length) return this.gameState;
		else this.gameState.players[player].modifyScore(diff);
		this.updateGameState();
	}

	lockPlayer(player, autoUnlock) {
		if (player >= 0 && player < this.gameState.players.length) {
			this.gameState.players[player].locked = true;
			this.updateGameState(player);
			if (autoUnlock)
				setTimeout(() => {
					this.gameState.players[player].locked = false;
				}, lockTimeout);
		}
	}

	unlockAll() {
		this.gameState.players.forEach((p) => {
			p.locked = false;
		});
		this.updateGameState();
	}

	unlockPlayer(player) {
		if (player >= 0 && player < this.gameState.players.length) {
			this.gameState.players[player].locked = false;
			this.updateGameState(player);
		}
	}

	unlockAll() {
		this.gameState.players.forEach((p) => {
			p.locked = false;
		});
		this.updateGameState();
	}

	handleClueTimeout(nextState) {
		if (this.clueTimeout) clearTimeout(this.clueTimeout);
		this.clueTimeout = null;
		this.setGameState({
			...nextState,
			timeout: true,
			playSound: nextState.state !== 'FJOver',
		});
		this.gameState.playSound = false;
	}

	startClueTimer(limit, nextState) {
		this.clueTimeout = setTimeout(() => {
			this.handleClueTimeout(nextState || null);
		}, limit);
	}

	stopClueTimer() {
		if (this.clueTimeout) clearTimeout(this.clueTimeout);
		this.clueTimeout = null;
	}

	setDDWager(wager) {
		if (this.gameState.state !== 'waitingDD') return;
		else if (this.gameState.control === -1) return;
		const player = this.gameState.players[this.gameState.control];
		if (wager < 5) throw new Error('Minimum wager is $5');
		const maxWager = Math.max(
			(this.gameState.round + 1) * 1000,
			player.getScore()
		);
		if (wager > maxWager) throw new Error(`Maximum wager is $${maxWager}`);
		this.gameState.wager = wager;
	}
}

try {
	module.exports = Game;
} catch (err) {}
