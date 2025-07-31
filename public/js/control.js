let sh;
const sendInput = (input) => {};

const receiveGameState = (e) => {
	sh.setState(e.detail);
};

const gameContainer = document.querySelector('#game-container');
document.addEventListener('DOMContentLoaded', () => {
	if (!window.opener) return (location.href = '/');
	document.addEventListener('update-game-state', receiveGameState);
});
